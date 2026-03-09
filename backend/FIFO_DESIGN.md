# FIFO 재고 관리 설계 (Batch 시스템)

## 현재 문제

**현재 재고 모델:**
```python
class Inventory:
    item_id: int
    quantity: float
    expiry_date: date | None  # 단일 유통기한만 저장
```

**문제점:**
1. 여러 배치(입고 차수)의 재고가 섞여 있을 때 구분 불가
2. 입고 시 유통기한을 덮어씀 (이전 배치 정보 손실)
3. 출고 시 어떤 배치부터 차감해야 하는지 알 수 없음
4. FIFO (선입선출) 원칙 적용 불가

---

## 제안: Batch 모델 도입

### 새 테이블: `inventory_batches`

```python
class InventoryBatch(Base, TimestampMixin):
    """재고 배치 (입고 차수별 관리)"""
    __tablename__ = "inventory_batches"

    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Float, nullable=False)  # 현재 남은 수량
    initial_quantity = Column(Float, nullable=False)  # 초기 입고 수량
    unit_price = Column(Float, default=0.0)  # 입고 단가
    expiry_date = Column(Date, nullable=True)  # 유통기한
    received_at = Column(DateTime, default=datetime.utcnow)  # 입고일

    item = relationship("Item", back_populates="batches")
    transactions = relationship("Transaction", back_populates="batch")
```

### Transaction 변경

```python
class Transaction(Base, TimestampMixin):
    __tablename__ = "transactions"
    
    # 기존 필드 유지
    item_id = Column(Integer, ForeignKey("items.id"))
    type = Column(Enum(TransactionType))
    quantity = Column(Float)
    
    # 추가
    batch_id = Column(Integer, ForeignKey("inventory_batches.id"), nullable=True)
    batch = relationship("InventoryBatch", back_populates="transactions")
```

### Inventory 테이블 (옵션)

**옵션 1: 유지 (총합 캐시)**
```python
class Inventory:
    item_id: int
    quantity: float  # SUM(InventoryBatch.quantity)로 계산된 캐시
    # expiry_date 제거 (각 batch에서 관리)
```

**옵션 2: 제거**
- `Item`에서 직접 `batches` 관계로 접근
- 총 재고량은 `SUM(batches.quantity)`로 계산

---

## 로직 변경

### 입고 (TransactionType.IN)

```python
@router.post("/transactions/")
def create_transaction(payload: TransactionCreate, db: Session):
    if payload.type == TransactionType.IN:
        # 새 배치 생성
        batch = InventoryBatch(
            item_id=payload.item_id,
            quantity=payload.quantity,
            initial_quantity=payload.quantity,
            unit_price=payload.unit_price or 0,
            expiry_date=payload.expiry_date,
        )
        db.add(batch)
        db.flush()
        
        # Transaction에 batch_id 연결
        tx = Transaction(
            item_id=payload.item_id,
            type=TransactionType.IN,
            quantity=payload.quantity,
            batch_id=batch.id,
            ...
        )
        db.add(tx)
        
        # Inventory 총합 업데이트 (캐시)
        inv = db.query(Inventory).filter_by(item_id=payload.item_id).first()
        if inv:
            inv.quantity += payload.quantity
        else:
            inv = Inventory(item_id=payload.item_id, quantity=payload.quantity)
            db.add(inv)
```

### 출고 (TransactionType.OUT) — FIFO

```python
@router.post("/transactions/")
def create_transaction(payload: TransactionCreate, db: Session):
    if payload.type in (TransactionType.OUT, TransactionType.DISPOSAL):
        # 가장 오래된 배치부터 차감 (FIFO)
        batches = (
            db.query(InventoryBatch)
            .filter(
                InventoryBatch.item_id == payload.item_id,
                InventoryBatch.quantity > 0,
            )
            .order_by(InventoryBatch.received_at.asc())  # 선입선출
            .all()
        )
        
        remaining = payload.quantity
        for batch in batches:
            if remaining <= 0:
                break
            
            deduct = min(batch.quantity, remaining)
            batch.quantity -= deduct
            remaining -= deduct
            
            # Transaction 기록 (배치별)
            tx = Transaction(
                item_id=payload.item_id,
                type=payload.type,
                quantity=deduct,
                batch_id=batch.id,
                ...
            )
            db.add(tx)
        
        if remaining > 0:
            raise HTTPException(400, f"재고 부족 ({remaining}{item.unit} 모자람)")
        
        # Inventory 총합 업데이트
        inv = db.query(Inventory).filter_by(item_id=payload.item_id).first()
        inv.quantity -= payload.quantity
```

---

## 유통기한 관리

### 임박 재고 조회

```python
@router.get("/inventory/expiring")
def list_expiring_stock(days: int = 3, db: Session):
    soon = date.today() + timedelta(days=days)
    batches = (
        db.query(InventoryBatch)
        .join(Item)
        .filter(
            InventoryBatch.quantity > 0,
            InventoryBatch.expiry_date <= soon,
        )
        .order_by(InventoryBatch.expiry_date.asc())
        .all()
    )
    return [
        {
            "item_name": b.item.name,
            "batch_id": b.id,
            "quantity": b.quantity,
            "expiry_date": b.expiry_date,
            "days_left": (b.expiry_date - date.today()).days,
        }
        for b in batches
    ]
```

---

## 마이그레이션 전략

### 1. Alembic 마이그레이션 생성

```bash
alembic revision --autogenerate -m "add_inventory_batches"
```

### 2. 기존 데이터 변환

```python
def upgrade():
    # InventoryBatches 테이블 생성
    op.create_table(...)
    
    # 기존 Inventory → InventoryBatch 변환
    conn = op.get_bind()
    inventories = conn.execute("SELECT * FROM inventory WHERE quantity > 0")
    
    for inv in inventories:
        conn.execute(
            """
            INSERT INTO inventory_batches (item_id, quantity, initial_quantity, expiry_date, received_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (inv.item_id, inv.quantity, inv.quantity, inv.expiry_date, datetime.utcnow())
        )
    
    # Inventory 테이블에서 expiry_date 컬럼 제거
    with op.batch_alter_table("inventory") as batch_op:
        batch_op.drop_column("expiry_date")
```

---

## 장점

✅ **정확한 FIFO:** 가장 오래된 재고부터 자동 차감  
✅ **유통기한 추적:** 배치별 유통기한 관리  
✅ **원가 계산:** 배치별 입고 단가 기록 (FIFO 원가 계산 가능)  
✅ **재고 이력:** 어떤 배치에서 얼마나 출고했는지 추적  
✅ **재고 회전율:** 배치별 입고일 기준 회전율 분석

---

## 단점

⚠️ **복잡도 증가:** 출고 시 여러 배치 순회  
⚠️ **성능:** 배치가 많아질 경우 쿼리 성능 저하 (인덱스 필수)  
⚠️ **마이그레이션 비용:** 기존 데이터 변환 작업 필요

---

## 대안: 간소화 버전

배치 시스템이 과하다면, 최소한 **유통기한별 재고 분리**만:

```python
class Inventory:
    item_id: int
    expiry_date: date | None
    quantity: float
    
    # 복합 Unique 키: (item_id, expiry_date)
```

입고 시:
- 동일 유통기한 재고가 있으면 수량만 증가
- 없으면 새 레코드 생성

출고 시:
- 유통기한이 빠른 순으로 차감

**장점:** Batch보다 단순  
**단점:** 입고 단가 추적 불가, 완전한 FIFO 아님

---

## 권장 사항

**현재 규모:** 간소화 버전으로 충분  
**향후 확장:** 배치 시스템 도입 (로트 추적, 원가 계산 필요 시)

---

## 다음 단계

1. 팀과 요구사항 논의
2. 간소화 vs 풀 배치 시스템 선택
3. Alembic 마이그레이션 작성
4. API 엔드포인트 수정
5. 앱 UI 업데이트 (배치 선택, 유통기한 표시)

---

**참고:**  
- [재고관리 FIFO 개념](https://ko.wikipedia.org/wiki/선입선출법)
- [SQLAlchemy Relationships](https://docs.sqlalchemy.org/en/20/orm/relationships.html)
