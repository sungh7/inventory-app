"""
고깃집 재고관리 데모 데이터 시드 스크립트
- reset 모드 지원: 기존 업무 데이터 초기화 후 재생성
- 품목 / 공급업체 / 직원 / 메뉴 / 레시피 / 판매 / 재고 / 트랜잭션 생성
- 최근 기준으로 살아있는 데모 데이터를 만들어 앱 화면이 비지 않도록 구성

사용 예시:
  python seed_data.py --reset
  python seed_data.py
"""
import argparse
import random
import sys
from datetime import date, datetime, time, timedelta, timezone

sys.path.insert(0, '/Volumes/ORICO/clawd/clawd-ops/projects/inventory-app/backend')

from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models import (
    Inventory,
    Item,
    ItemCategory,
    Menu,
    Order,
    OrderItem,
    PushToken,
    RecipeItem,
    Sale,
    Staff,
    Supplier,
    Transaction,
    TransactionType,
    User,
)

SEED_DAYS = 60
UTC = timezone.utc
NOW = datetime.now(UTC)
TODAY = NOW.date()

SUPPLIERS_DEF = [
    {"name": "한우축산유통", "contact": "010-1111-1111", "email": "meat@example.com", "memo": "육류 납품"},
    {"name": "초록농산", "contact": "010-2222-2222", "email": "veg@example.com", "memo": "채소/쌈채소"},
    {"name": "도매식자재", "contact": "010-3333-3333", "email": "supply@example.com", "memo": "양념/소모품"},
    {"name": "주류마트", "contact": "010-4444-4444", "email": "drink@example.com", "memo": "주류 납품"},
]

ITEMS_DEF = [
    {"name": "삼겹살", "category": ItemCategory.MEAT, "unit": "kg", "unit_price": 18000, "min_stock": 8, "barcode": "8801234000001", "supplier": "한우축산유통"},
    {"name": "목살", "category": ItemCategory.MEAT, "unit": "kg", "unit_price": 16000, "min_stock": 5, "barcode": "8801234000002", "supplier": "한우축산유통"},
    {"name": "소갈비", "category": ItemCategory.MEAT, "unit": "kg", "unit_price": 35000, "min_stock": 3, "barcode": "8801234000003", "supplier": "한우축산유통"},
    {"name": "상추", "category": ItemCategory.VEGETABLE, "unit": "kg", "unit_price": 3000, "min_stock": 2, "barcode": "8801234000004", "supplier": "초록농산"},
    {"name": "깻잎", "category": ItemCategory.VEGETABLE, "unit": "kg", "unit_price": 5000, "min_stock": 1, "barcode": "8801234000005", "supplier": "초록농산"},
    {"name": "마늘", "category": ItemCategory.VEGETABLE, "unit": "kg", "unit_price": 8000, "min_stock": 1, "barcode": "8801234000006", "supplier": "초록농산"},
    {"name": "쌈장", "category": ItemCategory.SAUCE, "unit": "kg", "unit_price": 4000, "min_stock": 2, "barcode": "8801234000007", "supplier": "도매식자재"},
    {"name": "된장찌개베이스", "category": ItemCategory.SAUCE, "unit": "kg", "unit_price": 6000, "min_stock": 1, "barcode": "8801234000008", "supplier": "도매식자재"},
    {"name": "소주", "category": ItemCategory.DRINK, "unit": "박스", "unit_price": 25000, "min_stock": 3, "barcode": "8801234000009", "supplier": "주류마트"},
    {"name": "맥주", "category": ItemCategory.DRINK, "unit": "박스", "unit_price": 30000, "min_stock": 2, "barcode": "8801234000010", "supplier": "주류마트"},
    {"name": "일회용장갑", "category": ItemCategory.OTHER, "unit": "박스", "unit_price": 5000, "min_stock": 2, "barcode": "8801234000011", "supplier": "도매식자재"},
    {"name": "키친타올", "category": ItemCategory.OTHER, "unit": "롤", "unit_price": 1500, "min_stock": 5, "barcode": "8801234000012", "supplier": "도매식자재"},
]

WEEKDAY_PATTERN = {
    "삼겹살": [0.8, 0.9, 1.0, 1.1, 1.5, 2.0, 1.8],
    "목살": [0.7, 0.8, 0.9, 1.0, 1.4, 1.8, 1.6],
    "소갈비": [0.5, 0.6, 0.7, 0.8, 1.2, 1.5, 1.3],
    "상추": [0.9, 1.0, 1.0, 1.1, 1.4, 1.8, 1.6],
    "깻잎": [0.8, 0.9, 0.9, 1.0, 1.3, 1.6, 1.5],
    "마늘": [1.0, 1.0, 1.0, 1.0, 1.2, 1.5, 1.3],
    "쌈장": [0.9, 0.9, 1.0, 1.0, 1.3, 1.7, 1.5],
    "된장찌개베이스": [1.0, 1.0, 1.0, 1.0, 1.1, 1.3, 1.2],
    "소주": [0.8, 0.9, 1.0, 1.2, 2.0, 2.5, 2.2],
    "맥주": [0.7, 0.8, 0.9, 1.1, 1.8, 2.3, 2.0],
    "일회용장갑": [1.0, 1.0, 1.0, 1.0, 1.2, 1.4, 1.3],
    "키친타올": [1.0, 1.0, 1.0, 1.0, 1.1, 1.3, 1.2],
}

DAILY_BASE = {
    "삼겹살": 5.0, "목살": 3.0, "소갈비": 2.0,
    "상추": 3.0, "깻잎": 1.5, "마늘": 2.0,
    "쌈장": 2.0, "된장찌개베이스": 1.0,
    "소주": 2.0, "맥주": 1.5,
    "일회용장갑": 0.5, "키친타올": 1.0,
}

STAFF_DEF = [
    {"name": "민수", "role": "manager", "pin": "1234"},
    {"name": "지은", "role": "staff", "pin": "2345"},
    {"name": "현우", "role": "staff", "pin": "3456"},
]

MENU_DEF = [
    {
        "name": "삼겹살 1인분",
        "category": "main",
        "sell_price": 17000,
        "description": "대표 메뉴",
        "recipe": {"삼겹살": 0.18, "상추": 0.03, "깻잎": 0.01, "마늘": 0.01, "쌈장": 0.015},
    },
    {
        "name": "목살 1인분",
        "category": "main",
        "sell_price": 16000,
        "description": "담백한 목살",
        "recipe": {"목살": 0.18, "상추": 0.03, "깻잎": 0.01, "마늘": 0.01, "쌈장": 0.015},
    },
    {
        "name": "소갈비 1인분",
        "category": "main",
        "sell_price": 28000,
        "description": "프리미엄 메뉴",
        "recipe": {"소갈비": 0.2, "상추": 0.03, "깻잎": 0.01, "마늘": 0.01, "쌈장": 0.02},
    },
    {
        "name": "된장찌개",
        "category": "side",
        "sell_price": 8000,
        "description": "식사 메뉴",
        "recipe": {"된장찌개베이스": 0.18, "마늘": 0.01},
    },
    {
        "name": "소주 1병",
        "category": "drink",
        "sell_price": 5000,
        "description": "주류",
        "recipe": {"소주": 0.05},
    },
    {
        "name": "맥주 1병",
        "category": "drink",
        "sell_price": 6000,
        "description": "주류",
        "recipe": {"맥주": 0.04},
    },
]

SALE_PATTERN = {
    "삼겹살 1인분": [6, 7, 8, 9, 12, 18, 15],
    "목살 1인분": [4, 5, 6, 7, 10, 14, 11],
    "소갈비 1인분": [1, 1, 2, 2, 3, 5, 4],
    "된장찌개": [2, 2, 3, 3, 5, 7, 6],
    "소주 1병": [3, 4, 5, 6, 10, 14, 12],
    "맥주 1병": [2, 3, 4, 5, 8, 11, 10],
}


def dt_on(day: date, hour_minute_range: tuple[int, int] = (9, 11)) -> datetime:
    hour = random.randint(*hour_minute_range)
    minute = random.randint(0, 59)
    return datetime.combine(day, time(hour, minute), tzinfo=UTC)


def clone_created_at(obj, value: datetime):
    obj.created_at = value.replace(tzinfo=None) if value.tzinfo else value


def reset_database(db):
    preserved_users = [
        {
            "username": u.username,
            "hashed_password": u.hashed_password,
            "role": u.role,
            "is_active": u.is_active,
        }
        for u in db.query(User).all()
    ]

    db.close()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    for u in preserved_users:
        db.add(User(**u))
    db.commit()
    return db


def seed_suppliers(db):
    result = {}
    for data in SUPPLIERS_DEF:
        obj = Supplier(**data)
        db.add(obj)
        db.flush()
        result[obj.name] = obj
    return result


def seed_items(db, suppliers):
    result = {}
    for data in ITEMS_DEF:
        item = Item(
            name=data["name"],
            category=data["category"],
            unit=data["unit"],
            unit_price=data["unit_price"],
            min_stock=data["min_stock"],
            barcode=data["barcode"],
            supplier_id=suppliers[data["supplier"]].id,
        )
        db.add(item)
        db.flush()
        result[item.name] = item
        db.add(Inventory(item_id=item.id, quantity=0.0))
    return result


def seed_staff(db):
    result = []
    for data in STAFF_DEF:
        staff = Staff(**data)
        db.add(staff)
        db.flush()
        result.append(staff)
    return result


def seed_transactions(db, items, staff):
    total = 0
    for name, item in items.items():
        pattern = WEEKDAY_PATTERN[name]
        base_qty = DAILY_BASE[name]
        today_buffer = 1.5 if name in {"삼겹살", "상추", "소주"} else 1.0

        for day_offset in range(SEED_DAYS - 1, -1, -1):
            tx_date = TODAY - timedelta(days=day_offset)
            wd = tx_date.weekday()

            if day_offset % 7 == 0:
                week_sum = sum(base_qty * pattern[(tx_date - timedelta(days=i)).weekday()] for i in range(7))
                in_qty = round(week_sum * random.uniform(1.18, 1.35), 2)
                expiry = None
                if name in {"삼겹살", "목살", "소갈비", "상추", "깻잎", "마늘"}:
                    expiry = tx_date + timedelta(days=random.randint(2, 6))
                tx = Transaction(
                    item_id=item.id,
                    type=TransactionType.IN,
                    quantity=in_qty,
                    unit_price=item.unit_price,
                    expiry_date=expiry,
                    memo="정기 입고",
                    staff_id=staff[0].id,
                )
                clone_created_at(tx, dt_on(tx_date, (8, 10)))
                db.add(tx)
                total += 1

            out_qty = round(base_qty * pattern[wd] * random.uniform(0.9, 1.12) * today_buffer, 3)
            tx = Transaction(
                item_id=item.id,
                type=TransactionType.OUT,
                quantity=out_qty,
                memo="일일 사용",
                staff_id=random.choice(staff).id,
            )
            clone_created_at(tx, dt_on(tx_date, (18, 22)))
            db.add(tx)
            total += 1

            if random.random() < 0.07:
                dispose_qty = round(out_qty * random.uniform(0.05, 0.12), 3)
                tx = Transaction(
                    item_id=item.id,
                    type=TransactionType.DISPOSE,
                    quantity=dispose_qty,
                    memo="품질 불량 폐기",
                    staff_id=random.choice(staff).id,
                )
                clone_created_at(tx, dt_on(tx_date, (22, 23)))
                db.add(tx)
                total += 1

    return total


def seed_menus_and_recipes(db, items):
    menus = {}
    for data in MENU_DEF:
        menu = Menu(
            name=data["name"],
            category=data["category"],
            sell_price=data["sell_price"],
            description=data["description"],
            is_active=1,
        )
        db.add(menu)
        db.flush()
        for item_name, qty in data["recipe"].items():
            db.add(RecipeItem(menu_id=menu.id, item_id=items[item_name].id, quantity=qty))
        menus[menu.name] = menu
    return menus


def _menu_unit_cost(db, menu_id: int) -> float:
    total = 0.0
    recipe_rows = db.query(RecipeItem).filter(RecipeItem.menu_id == menu_id).all()
    for ri in recipe_rows:
        item = db.query(Item).filter(Item.id == ri.item_id).first()
        total += (item.unit_price if item else 0.0) * ri.quantity
    return round(total, 2)


def seed_sales(db, menus, staff):
    total_sales = 0
    for day_offset in range(20, -1, -1):
        sale_date = TODAY - timedelta(days=day_offset)
        wd = sale_date.weekday()
        day_boost = 1.25 if day_offset == 0 else 1.0

        for menu_name, menu in menus.items():
            base = SALE_PATTERN[menu_name][wd]
            qty = max(0, int(round(base * random.uniform(0.85, 1.15) * day_boost)))
            if qty == 0:
                continue

            recipe_rows = db.query(RecipeItem).filter(RecipeItem.menu_id == menu.id).all()
            unit_cost = _menu_unit_cost(db, menu.id)

            sale = Sale(
                menu_id=menu.id,
                quantity=qty,
                unit_cost=unit_cost,
                total_cost=round(unit_cost * qty, 2),
                total_revenue=round(menu.sell_price * qty, 2),
                memo="데모 판매 데이터",
                staff_id=random.choice(staff).id,
            )
            clone_created_at(sale, dt_on(sale_date, (12, 21)))
            db.add(sale)
            total_sales += 1

            for ri in recipe_rows:
                out_qty = round(ri.quantity * qty, 3)
                tx = Transaction(
                    item_id=ri.item_id,
                    type=TransactionType.OUT,
                    quantity=out_qty,
                    memo=f"판매: {menu.name} {qty}건",
                    staff_id=sale.staff_id,
                )
                clone_created_at(tx, dt_on(sale_date, (12, 21)))
                db.add(tx)

    return total_sales


def reconcile_sale_costs(db):
    for sale in db.query(Sale).all():
        unit_cost = _menu_unit_cost(db, sale.menu_id)
        sale.unit_cost = unit_cost
        sale.total_cost = round(unit_cost * sale.quantity, 2)


def set_inventory_levels(db, items):
    urgent_names = {"삼겹살", "일회용장갑", "키친타올"}

    for name, item in items.items():
        inv = db.query(Inventory).filter(Inventory.item_id == item.id).first()
        pattern = WEEKDAY_PATTERN[name]
        avg_pattern = sum(pattern) / len(pattern)
        base = DAILY_BASE[name]

        if name in urgent_names:
            qty = round(item.min_stock * random.uniform(0.55, 0.95), 2)
        else:
            qty = round(base * avg_pattern * random.uniform(4.5, 8.5), 2)

        inv.quantity = qty

        if name == "삼겹살":
            inv.expiry_date = TODAY + timedelta(days=2)
        elif name == "상추":
            inv.expiry_date = TODAY + timedelta(days=5)
        else:
            inv.expiry_date = None


def seed_demo_order(db, items):
    low_items = db.query(Inventory).all()
    selected = []
    for inv in low_items:
        item = db.query(Item).filter(Item.id == inv.item_id).first()
        if item and inv.quantity <= item.min_stock:
            selected.append((item, inv))

    if not selected:
        return None

    supplier_id = selected[0][0].supplier_id
    order = Order(supplier_id=supplier_id, memo="데모 발주서", expected_date=TODAY + timedelta(days=1))
    db.add(order)
    db.flush()

    for item, inv in selected:
        db.add(OrderItem(
            order_id=order.id,
            item_id=item.id,
            quantity=round(max(item.min_stock * 2, item.min_stock - inv.quantity + 3), 2),
            unit_price=item.unit_price,
        ))
    return order


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reset', action='store_true', help='기존 DB를 초기화하고 데모 데이터를 재생성')
    return parser.parse_args()


def main():
    args = parse_args()
    random.seed(42)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.reset:
            print('=== 기존 DB 초기화 후 재시드 ===')
            db = reset_database(db)
        else:
            existing_items = db.query(Item).count()
            existing_tx = db.query(Transaction).count()
            if existing_items > 0 or existing_tx > 0:
                print('기존 데이터가 이미 존재합니다. 깨끗한 데모 데이터를 원하면 --reset 옵션을 사용하세요.')
                return

        suppliers = seed_suppliers(db)
        items = seed_items(db, suppliers)
        staff = seed_staff(db)
        tx_count = seed_transactions(db, items, staff)
        menus = seed_menus_and_recipes(db, items)
        sales_count = seed_sales(db, menus, staff)
        db.flush()
        reconcile_sale_costs(db)
        set_inventory_levels(db, items)
        order = seed_demo_order(db, items)

        db.commit()

        print(f'품목 {db.query(Item).count()}개')
        print(f'공급업체 {db.query(Supplier).count()}개')
        print(f'직원 {db.query(Staff).count()}개')
        print(f'메뉴 {db.query(Menu).count()}개 / 레시피 {db.query(RecipeItem).count()}개')
        print(f'트랜잭션 {db.query(Transaction).count()}건 (신규 기본 생성 {tx_count}건 이상)')
        print(f'판매 {db.query(Sale).count()}건 (일자별 집계 row {sales_count}건)')
        if order:
            print(f'데모 발주서 생성: order #{order.id}')
        print('✅ 데모 데이터 시드 완료')
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == '__main__':
    main()
