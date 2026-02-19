"""
고깃집 재고관리 합성 데이터 시드 스크립트
- 12개 품목 생성 (이미 있으면 스킵)
- 과거 60일치 트랜잭션 삽입
- idempotent: 기존 이력 있으면 스킵
"""
import sys
import random
from datetime import datetime, timedelta, date, timezone

sys.path.insert(0, '/Volumes/ORICO/clawd/clawd-ops/projects/inventory-app/backend')

from sqlalchemy import text
from app.core.database import engine, SessionLocal
from app.models.base import Base
from app.models import Item, Inventory, Transaction, TransactionType, ItemCategory

# ── 품목 정의 ────────────────────────────────────────────────────
ITEMS_DEF = [
    {"name": "삼겹살",       "category": ItemCategory.MEAT,      "unit": "kg",  "unit_price": 18000, "min_stock": 5,  "barcode": "8801234000001"},
    {"name": "목살",         "category": ItemCategory.MEAT,      "unit": "kg",  "unit_price": 16000, "min_stock": 3,  "barcode": "8801234000002"},
    {"name": "소갈비",       "category": ItemCategory.MEAT,      "unit": "kg",  "unit_price": 35000, "min_stock": 2,  "barcode": "8801234000003"},
    {"name": "상추",         "category": ItemCategory.VEGETABLE, "unit": "kg",  "unit_price":  3000, "min_stock": 2,  "barcode": "8801234000004"},
    {"name": "깻잎",         "category": ItemCategory.VEGETABLE, "unit": "kg",  "unit_price":  5000, "min_stock": 1,  "barcode": "8801234000005"},
    {"name": "마늘",         "category": ItemCategory.VEGETABLE, "unit": "kg",  "unit_price":  8000, "min_stock": 1,  "barcode": "8801234000006"},
    {"name": "쌈장",         "category": ItemCategory.SAUCE,     "unit": "kg",  "unit_price":  4000, "min_stock": 2,  "barcode": "8801234000007"},
    {"name": "된장찌개베이스","category": ItemCategory.SAUCE,     "unit": "kg",  "unit_price":  6000, "min_stock": 1,  "barcode": "8801234000008"},
    {"name": "소주",         "category": ItemCategory.DRINK,     "unit": "박스", "unit_price": 25000, "min_stock": 3,  "barcode": "8801234000009"},
    {"name": "맥주",         "category": ItemCategory.DRINK,     "unit": "박스", "unit_price": 30000, "min_stock": 2,  "barcode": "8801234000010"},
    {"name": "일회용장갑",   "category": ItemCategory.OTHER,     "unit": "박스", "unit_price":  5000, "min_stock": 2,  "barcode": "8801234000011"},
    {"name": "키친타올",     "category": ItemCategory.OTHER,     "unit": "롤",  "unit_price":  1500, "min_stock": 5,  "barcode": "8801234000012"},
]

# 요일별 소비 배율 (0=월 ~ 6=일)
WEEKDAY_PATTERN = {
    "삼겹살":       [0.8, 0.9, 1.0, 1.1, 1.5, 2.0, 1.8],
    "목살":         [0.7, 0.8, 0.9, 1.0, 1.4, 1.8, 1.6],
    "소갈비":       [0.5, 0.6, 0.7, 0.8, 1.2, 1.5, 1.3],
    "상추":         [0.9, 1.0, 1.0, 1.1, 1.4, 1.8, 1.6],
    "깻잎":         [0.8, 0.9, 0.9, 1.0, 1.3, 1.6, 1.5],
    "마늘":         [1.0, 1.0, 1.0, 1.0, 1.2, 1.5, 1.3],
    "쌈장":         [0.9, 0.9, 1.0, 1.0, 1.3, 1.7, 1.5],
    "된장찌개베이스":[1.0, 1.0, 1.0, 1.0, 1.1, 1.3, 1.2],
    "소주":         [0.8, 0.9, 1.0, 1.2, 2.0, 2.5, 2.2],
    "맥주":         [0.7, 0.8, 0.9, 1.1, 1.8, 2.3, 2.0],
    "일회용장갑":   [1.0, 1.0, 1.0, 1.0, 1.2, 1.4, 1.3],
    "키친타올":     [1.0, 1.0, 1.0, 1.0, 1.1, 1.3, 1.2],
}

# 기본 일일 소비량
DAILY_BASE = {
    "삼겹살": 5.0,  "목살": 3.0,  "소갈비": 2.0,
    "상추": 3.0,    "깻잎": 1.5,  "마늘": 2.0,
    "쌈장": 2.0,    "된장찌개베이스": 1.0,
    "소주": 2.0,    "맥주": 1.5,
    "일회용장갑": 0.5, "키친타올": 1.0,
}

SEED_DAYS = 60


def main():
    random.seed(42)
    db = SessionLocal()
    Base.metadata.create_all(bind=engine)

    try:
        # ── 1. 품목 생성 / 조회 ──────────────────────────────
        item_map = {}  # name → Item
        created_items = 0

        for idef in ITEMS_DEF:
            existing = db.query(Item).filter(Item.barcode == idef["barcode"]).first()
            if existing:
                item_map[idef["name"]] = existing
                print(f"  [SKIP] 품목 이미 존재: {idef['name']} (id={existing.id})")
            else:
                item = Item(
                    name=idef["name"],
                    category=idef["category"],
                    unit=idef["unit"],
                    unit_price=idef["unit_price"],
                    min_stock=idef["min_stock"],
                    barcode=idef["barcode"],
                )
                db.add(item)
                db.flush()
                item_map[idef["name"]] = item
                created_items += 1
                print(f"  [CREATE] 품목: {idef['name']} (id={item.id})")

        db.commit()

        # ── 2. 기존 이력 확인 (60일 이상 오래된 트랜잭션 있으면 스킵) ──
        cutoff_check = datetime.now(tz=timezone.utc) - timedelta(days=SEED_DAYS - 5)
        first_item = list(item_map.values())[0]
        existing_old_tx = db.query(Transaction).filter(
            Transaction.item_id == first_item.id,
            Transaction.created_at < cutoff_check,
        ).count()

        if existing_old_tx > 0:
            print(f"\n이미 {SEED_DAYS}일치 이력 존재 → 트랜잭션 삽입 스킵")
            _ensure_inventory(db, item_map)
            db.commit()
            return

        # ── 3. 과거 60일치 트랜잭션 생성 ──────────────────────
        today = date.today()
        total_tx = 0

        for name, item in item_map.items():
            pattern = WEEKDAY_PATTERN[name]
            base_qty = DAILY_BASE[name]
            weekly_consumed = []  # 7일치 누적 (입고 계산용)

            for day_offset in range(SEED_DAYS, 0, -1):
                tx_date = today - timedelta(days=day_offset)
                wd = tx_date.weekday()  # 0=월, 6=일
                tx_dt = datetime(tx_date.year, tx_date.month, tx_date.day, 
                                  random.randint(18, 22), random.randint(0, 59), 0,
                                  tzinfo=timezone.utc)

                # ── 7일마다 입고 ──
                if day_offset % 7 == 0 and day_offset <= SEED_DAYS:
                    # 7일치 예상 소비 × 1.2배
                    week_sum = sum(
                        base_qty * pattern[(today - timedelta(days=day_offset - i)).weekday()]
                        for i in range(7)
                    )
                    in_qty = round(week_sum * 1.2, 2)
                    in_dt = datetime(tx_date.year, tx_date.month, tx_date.day,
                                      9, random.randint(0, 30), 0,
                                      tzinfo=timezone.utc)
                    db.execute(text("""
                        INSERT INTO transactions (item_id, type, quantity, memo, created_at)
                        VALUES (:item_id, :type, :quantity, :memo, :created_at)
                    """), {
                        "item_id": item.id,
                        "type": TransactionType.IN.name,   # 'IN' (enum name, not value)
                        "quantity": in_qty,
                        "memo": "정기 입고",
                        "created_at": in_dt.isoformat(),
                    })
                    total_tx += 1

                # ── 출고 (OUT) ──
                noise = random.uniform(0.9, 1.1)
                out_qty = round(base_qty * pattern[wd] * noise, 3)
                db.execute(text("""
                    INSERT INTO transactions (item_id, type, quantity, memo, created_at)
                    VALUES (:item_id, :type, :quantity, :memo, :created_at)
                """), {
                    "item_id": item.id,
                    "type": TransactionType.OUT.name,      # 'OUT'
                    "quantity": out_qty,
                    "memo": "일일 사용",
                    "created_at": tx_dt.isoformat(),
                })
                total_tx += 1
                weekly_consumed.append(out_qty)

                # ── 5% 확률 폐기 (DISPOSE) ──
                if random.random() < 0.05:
                    dispose_qty = round(out_qty * random.uniform(0.05, 0.15), 3)
                    dispose_dt = datetime(tx_date.year, tx_date.month, tx_date.day,
                                          23, random.randint(0, 59), 0,
                                          tzinfo=timezone.utc)
                    db.execute(text("""
                        INSERT INTO transactions (item_id, type, quantity, memo, created_at)
                        VALUES (:item_id, :type, :quantity, :memo, :created_at)
                    """), {
                        "item_id": item.id,
                        "type": TransactionType.DISPOSE.name,  # 'DISPOSE'
                        "quantity": dispose_qty,
                        "memo": "품질 불량 폐기",
                        "created_at": dispose_dt.isoformat(),
                    })
                    total_tx += 1

            print(f"  [TX] {name}: 트랜잭션 삽입 완료")

        db.commit()

        # ── 4. 현재 재고 세팅 (3~5일치 재고) ──────────────────
        _ensure_inventory(db, item_map)
        db.commit()

        print(f"\n✅ 시드 완료: 품목 {created_items}개 생성, 트랜잭션 총 {total_tx}건 삽입")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def _ensure_inventory(db, item_map):
    """현재 재고: 3~5일치 재고 수준으로 세팅"""
    for name, item in item_map.items():
        pattern = WEEKDAY_PATTERN[name]
        base_qty = DAILY_BASE[name]
        # 3~5일치 평균 소비량
        days_stock = random.uniform(3, 5)
        avg_pattern = sum(pattern) / 7
        current_qty = round(base_qty * avg_pattern * days_stock, 2)

        inv = db.query(Inventory).filter(Inventory.item_id == item.id).first()
        if inv:
            inv.quantity = current_qty
        else:
            inv = Inventory(item_id=item.id, quantity=current_qty)
            db.add(inv)

    print("  [INV] 현재 재고 세팅 완료")


if __name__ == "__main__":
    print("=== 고깃집 재고 시드 데이터 삽입 시작 ===\n")
    main()
