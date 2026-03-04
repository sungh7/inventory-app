"""Seed dev DB with a small scenario dataset for AI forecast/smart-order demo.

Usage (from backend/):
  python -m scripts.seed_ai_demo

Notes:
- Uses DATABASE_URL from app/core/config.py (.env supported)
- Safe for dev only (will upsert by barcode/name, and append transactions)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import random

from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models import Item, Inventory, Transaction, TransactionType, Staff


def upsert_staff(db, name: str = "데모직원") -> Staff:
    staff = db.query(Staff).filter(Staff.name == name).first()
    if staff:
        return staff
    staff = Staff(name=name, role="staff", pin=None, is_active=True)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


def upsert_item(db, *, name: str, barcode: str, category: str, unit: str, unit_price: float, min_stock: float) -> Item:
    item = db.query(Item).filter(Item.barcode == barcode).first()
    if not item:
        item = Item(
            name=name,
            barcode=barcode,
            category=category,
            unit=unit,
            unit_price=unit_price,
            min_stock=min_stock,
        )
        db.add(item)
        db.commit()
        db.refresh(item)

    # inventory
    inv = item.inventory
    if not inv:
        inv = Inventory(item_id=item.id, quantity=0)
        db.add(inv)
        db.commit()
        db.refresh(inv)

    return item


def set_inventory(db, item: Item, qty: float):
    inv = item.inventory
    inv.quantity = float(qty)
    db.add(inv)
    db.commit()


def add_out_transactions(db, *, item: Item, staff_id: int, days: int, base_daily: float, jitter: float = 0.25):
    """Create OUT transactions distributed over `days` back from now."""
    now = datetime.now(timezone.utc)

    for d in range(days):
        day = now - timedelta(days=(days - d))
        # some days have no usage
        if random.random() < 0.12:
            continue
        qty = base_daily * (1 + random.uniform(-jitter, jitter))
        qty = max(qty, 0)
        tx = Transaction(
            item_id=item.id,
            type=TransactionType.OUT,
            quantity=float(round(qty, 3)),
            unit_price=None,
            expiry_date=None,
            memo="데모 사용량",
            staff_id=staff_id,
            created_at=day,
        )
        db.add(tx)

    db.commit()


def main():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        staff = upsert_staff(db)

        # Scenario: 작은 매장(샌드위치/카페) 기준 5개 핵심 재료
        items = [
            ("닭가슴살", "880000000001", "meat", "kg", 12000, 3.0, 2.5),
            ("양상추", "880000000002", "vegetable", "kg", 6500, 2.0, 1.2),
            ("토마토", "880000000003", "vegetable", "kg", 7000, 2.0, 0.8),
            ("마요네즈", "880000000004", "sauce", "ea", 4500, 4.0, 1.0),
            ("콜라", "880000000005", "drink", "ea", 1200, 24.0, 10.0),
        ]

        seeded = []
        for name, barcode, category, unit, unit_price, min_stock, base_daily in items:
            item = upsert_item(
                db,
                name=name,
                barcode=barcode,
                category=category,
                unit=unit,
                unit_price=unit_price,
                min_stock=min_stock,
            )
            seeded.append((item, base_daily))

        # set current stock to create at least some reorder candidates
        set_inventory(db, seeded[0][0], 1.0)   # 닭가슴살 (부족)
        set_inventory(db, seeded[1][0], 0.6)   # 양상추 (부족)
        set_inventory(db, seeded[2][0], 1.2)   # 토마토
        set_inventory(db, seeded[3][0], 2.0)   # 마요
        set_inventory(db, seeded[4][0], 30.0)  # 콜라

        # add 45 days history
        for item, base_daily in seeded:
            add_out_transactions(db, item=item, staff_id=staff.id, days=45, base_daily=base_daily)

        print("✅ Seed complete")
        print("- Visit /dashboard/ai to see forecast and smart-order")
        print("- Barcodes for demo items:")
        for item, _ in seeded:
            print(f"  {item.name}: {item.barcode}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
