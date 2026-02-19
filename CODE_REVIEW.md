# 재고관리 앱 코드 리뷰

> 작성일: 2025-07-16  
> 리뷰 대상: 백엔드 (FastAPI + SQLAlchemy) / 앱 (Expo React Native)

---

## 🔴 Critical — 즉시 수정 필요

### [C-1] 인증/인가 전무 — 모든 API 무방비
**파일:** `main.py`, `routers/` 전체

모든 엔드포인트가 인증 없이 공개되어 있음. 외부에서 재고 조회/수정/삭제 가능.  
`config.py`에 `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`가 정의되어 있지만 실제로 사용되지 않음.

```python
# 최소한 API Key 미들웨어 추가
from fastapi.security import APIKeyHeader

API_KEY = settings.SECRET_KEY
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(key: str = Depends(api_key_header)):
    if key != API_KEY:
        raise HTTPException(403, "Invalid API Key")
```

---

### [C-2] CORS allow_origins=["*"] — 전체 허용
**파일:** `main.py`

프로덕션에서는 특정 도메인만 허용해야 함.

```python
# 수정
allow_origins=["http://localhost:8081", "https://your-domain.com"],
allow_credentials=True,
```

---

### [C-3] 푸시 토큰 인메모리 저장 — 서버 재시작 시 소실
**파일:** `core/scheduler.py`

```python
_push_tokens: list[str] = []  # ← 재시작 시 전부 사라짐, 멀티 프로세스 공유 불가
```

DB 테이블 또는 Redis로 관리해야 함.

```python
# 최소 해결책: DB에 PushToken 모델 추가
class PushToken(Base):
    __tablename__ = "push_tokens"
    token = Column(String(200), unique=True, nullable=False)
```

---

### [C-4] 재고 차감 동시성 Race Condition
**파일:** `routers/transactions.py`

```python
if inv.quantity < payload.quantity:
    raise HTTPException(...)   # 이 사이에 다른 요청이 들어오면
inv.quantity -= payload.quantity   # 재고가 음수로 떨어질 수 있음
```

**수정:** `SELECT FOR UPDATE` 또는 DB 레벨 제약조건 추가

```python
from sqlalchemy import text

inv = db.query(Inventory).filter(
    Inventory.item_id == payload.item_id
).with_for_update().first()  # 행 잠금
```

---

### [C-5] N+1 쿼리 — auto_create_orders 내 루프
**파일:** `core/ai_forecast.py`

```python
for rec in recommendations:
    item = db.query(Item).filter(Item.id == rec["item_id"]).first()  # N번 쿼리
    ...
for rec in items_list:
    db.add(OrderItem(
        unit_price=db.query(Item).filter(Item.id == rec["item_id"]).first().unit_price,  # 또 N번
    ))
```

**수정:** 루프 전에 item들 일괄 조회

```python
item_ids = [r["item_id"] for r in recommendations]
items_map = {i.id: i for i in db.query(Item).filter(Item.id.in_(item_ids)).all()}
```

---

### [C-6] is_low_stock 조건 오류 — min_stock=0 품목 오탐
**파일:** `routers/inventory.py`

```python
is_low_stock=inv.quantity <= item.min_stock  # min_stock=0이면 quantity=0일 때 항상 true
```

**수정:**
```python
is_low_stock=(item.min_stock > 0 and inv.quantity <= item.min_stock),
```

동일한 오류가 `scheduler.py`에도 있음:
```python
if inv.quantity <= item.min_stock and item.min_stock > 0:  # 이건 맞음
```
→ `inventory.py`만 수정 필요.

---

### [C-7] ScanScreen 유통기한 날짜 검증 없음
**파일:** `src/screens/ScanScreen.tsx`

자유 텍스트로 유통기한 입력받음. 잘못된 형식(`2025-13-99` 등) 입력 시 서버 500 에러.

```typescript
// 최소 검증 추가
const validateExpiry = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));

if (expiryDate && !validateExpiry(expiryDate)) {
  Alert.alert("오류", "유통기한 형식이 잘못되었습니다 (YYYY-MM-DD)");
  return;
}
```

**권장:** DatePicker 컴포넌트 사용

---

## 🟡 Warning — 수정 권장

### [W-1] N+1 쿼리 — list_items
**파일:** `routers/items.py`

```python
items = query.all()
for item in items:
    data.current_stock = item.inventory.quantity  # 각 item마다 SELECT
```

**수정:**
```python
from sqlalchemy.orm import joinedload
items = query.options(joinedload(Item.inventory)).all()
```

---

### [W-2] N+1 쿼리 — list_transactions
**파일:** `routers/transactions.py`

```python
for tx in txs:
    data.item_name = tx.item.name  # 각 tx마다 SELECT
```

**수정:**
```python
txs = query.options(joinedload(Transaction.item)).order_by(...).limit(limit).all()
```

---

### [W-3] N+1 쿼리 — recommend_orders 내 루프
**파일:** `routers/orders.py`

```python
for inv in inventories:
    avg_out = db.query(func.sum(...)).filter(Transaction.item_id == item.id, ...).scalar()
    # 재고 품목 수만큼 별도 쿼리
```

**수정:** 하나의 쿼리로 묶어서 처리

---

### [W-4] N+1 쿼리 — forecast_all
**파일:** `routers/ai.py`

```python
for item in items:
    pred = predict_consumption(db, item.id)  # 품목마다 Transaction 쿼리
```

아이템이 많아질수록 응답 시간 선형 증가. 캐싱 또는 배치 조회 필요.

---

### [W-5] push_notifications 실패 시 에러 무시
**파일:** `core/scheduler.py`

```python
async with httpx.AsyncClient() as client:
    await client.post(...)  # 실패해도 예외 처리 없음
```

**수정:**
```python
try:
    resp = await client.post(...)
    resp.raise_for_status()
except Exception as e:
    logging.error(f"Push 알림 실패: {e}")
```

---

### [W-6] 입고 시 유통기한 단순 교체 — FIFO 미지원
**파일:** `routers/transactions.py`

```python
if payload.expiry_date:
    inv.expiry_date = payload.expiry_date  # 이전 배치의 유통기한 덮어씀
```

재고가 뒤섞여 있는 경우 선입선출 관리 불가. 배치(lot) 개념 도입 권장.

---

### [W-7] DB 마이그레이션 부재
**파일:** `main.py`

```python
Base.metadata.create_all(bind=engine)  # 스키마 변경 시 기존 컬럼 추가 안 됨
```

Alembic 도입 필요:
```bash
alembic init alembic
alembic revision --autogenerate -m "add column"
alembic upgrade head
```

---

### [W-8] SQLite 기본값 — 동시성 한계
**파일:** `core/config.py`

SQLite는 쓰기 잠금으로 동시 요청 처리 불가. 멀티유저 환경에서 PostgreSQL 필수.

```
DATABASE_URL=postgresql://user:pass@localhost/inventory
```

---

### [W-9] 에러 상태 처리 미흡 — 여러 화면
**파일:** `InventoryScreen.tsx`, `HistoryScreen.tsx`, `StatsScreen.tsx`, `AIForecastScreen.tsx`

`isError` 상태 미처리. 네트워크 오류 시 빈 화면만 보임.

```typescript
const { data, isLoading, isError, refetch } = useQuery(...);

if (isError) return (
  <View style={styles.center}>
    <Text>데이터를 불러올 수 없습니다</Text>
    <TouchableOpacity onPress={() => refetch()}>
      <Text>다시 시도</Text>
    </TouchableOpacity>
  </View>
);
```

---

### [W-10] StatsScreen refetchAll — 일부 쿼리 누락
**파일:** `src/screens/StatsScreen.tsx`

```typescript
const refetchAll = () => {
  refetchSummary();
  refetchConsumption();  // disposal, categoryStock 빠짐
};
```

**수정:**
```typescript
const { refetch: refetchDisposal } = useQuery(...);
const { refetch: refetchCategory } = useQuery(...);

const refetchAll = () => {
  refetchSummary(); refetchConsumption(); refetchDisposal(); refetchCategory();
};
```

---

### [W-11] usePushNotifications — Expo Project ID 누락
**파일:** `src/hooks/usePushNotifications.ts`

Expo SDK 49+ 부터 `projectId` 필수:

```typescript
const token = (await Notifications.getExpoPushTokenAsync({
  projectId: Constants.expoConfig?.extra?.eas?.projectId,
})).data;
```

---

### [W-12] QueryClient 전역 설정 없음
**파일:** `app/_layout.tsx`

```typescript
const queryClient = new QueryClient();  // 기본값만 사용
```

**권장:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,   // 30초 캐시
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

---

### [W-13] OrderScreen — 타입 `any` 남발
**파일:** `src/screens/OrderScreen.tsx`

```typescript
orders ?? []).map((order: any) => ...)   // any
data.items.map((item: any) => ...)       // any
```

`types/index.ts`에 `Order`, `OrderItem`, `Recommendation` 타입 추가 필요.

---

### [W-14] 발주 삭제/수정 기능 없음
**파일:** `routers/orders.py`, `src/screens/OrderScreen.tsx`

초안(draft) 상태 발주서 수정/삭제 엔드포인트 없음. UI도 없음.

---

### [W-15] print() 사용 — logging 모듈 미사용
**파일:** `core/scheduler.py`, `core/ai_forecast.py`

```python
print(f"[Scheduler] 알림 체크 완료 ...")  # 프로덕션 로깅 불가
```

**수정:**
```python
import logging
logger = logging.getLogger(__name__)
logger.info("알림 체크 완료 ...")
```

---

### [W-16] reportlab 선택적 의존성 — ImportError 미처리
**파일:** `routers/orders.py`

```python
def _generate_pdf(order: Order) -> bytes:
    from reportlab.lib.pagesizes import A4  # 미설치 시 런타임 500 에러
```

**수정:**
```python
try:
    from reportlab.lib.pagesizes import A4
except ImportError:
    raise HTTPException(500, "PDF 생성 라이브러리가 설치되지 않았습니다")
```

---

### [W-17] HistoryScreen 페이지네이션 없음 — limit 100 고정
**파일:** `src/screens/HistoryScreen.tsx`

```typescript
.list(filter ? { type: filter, limit: 100 } : { limit: 100 })
```

거래 이력이 많아지면 UX 저하. 무한 스크롤 또는 페이지네이션 도입 권장.

---

## 🟢 Minor — 나중에 개선

### [M-1] TransactionOut에 created_at 없음
**파일:** `routers/transactions.py`, `src/screens/HistoryScreen.tsx`

이력 화면에 날짜/시간 표시 없음. `dayjs`를 import했는데 사용하지 않음.

```typescript
// HistoryScreen.tsx에서
import dayjs from "dayjs";
// ...
<Text style={styles.date}>{dayjs(tx.created_at).format("MM/DD HH:mm")}</Text>
```

---

### [M-2] Supplier 수정(PATCH) 엔드포인트 없음
**파일:** `routers/suppliers.py`

공급업체 정보 변경 시 삭제 후 재등록 필요.

---

### [M-3] Pydantic Schemas 모듈 분산
**파일:** 각 `routers/*.py`

각 라우터 파일에 Schema 클래스가 섞여 있음. `schemas/` 모듈로 분리 권장:
```
backend/app/schemas/
  items.py, inventory.py, orders.py ...
```

---

### [M-4] InventoryScreen 가나다/카테고리 정렬 없음
**파일:** `src/screens/InventoryScreen.tsx`

데이터 정렬 옵션 없음. 재고 부족 항목 상단 표시 등 필터링 기능 없음.

---

### [M-5] AIForecastScreen 상세 모달에서 발주 바로가기 없음
**파일:** `src/screens/AIForecastScreen.tsx`

"발주 필요 여부" 설명만 있고 실제 발주 화면으로 연결 없음.

```tsx
// 모달 내에 추가
<TouchableOpacity onPress={() => router.push("/orders")}>
  <Text>발주 화면으로 이동 →</Text>
</TouchableOpacity>
```

---

### [M-6] Python 3.10+ 전용 문법 사용
**파일:** `core/ai_forecast.py`, 여러 파일

```python
def calculate_smart_order(...) -> dict | None:  # 3.10+ 전용
    by_supplier: dict[int | None, list] = ...   # 3.10+ 전용
```

3.9 이하 호환 필요 시 `Optional[dict]`, `Dict[Optional[int], List]` 사용.

---

### [M-7] 접근성(Accessibility) 레이블 없음
**파일:** 앱 화면 전체

`accessibilityLabel`, `accessibilityRole` prop 없음. 스크린리더 미지원.

---

### [M-8] ScanScreen 스캔 오버레이 비율 고정
**파일:** `src/screens/ScanScreen.tsx`

```typescript
scanBox: { width: 260, height: 160 }  // 화면 크기에 무관하게 고정
```

`Dimensions.get('window')`로 화면 비례 처리 권장.

---

### [M-9] RegisterScreen Picker — Android/iOS 스타일 불일치
**파일:** `src/screens/RegisterScreen.tsx`

`@react-native-picker/picker`는 iOS에서 별도 UX가 필요함. `ActionSheet` 기반 Picker로 교체 검토.

---

### [M-10] 트랜잭션 롤백 미처리
**파일:** `routers/orders.py` (`update_status`)

```python
db.commit()  # 예외 발생 시 부분 커밋 가능
```

**수정:**
```python
try:
    db.commit()
except Exception:
    db.rollback()
    raise
```

---

## ✅ 잘 된 것 — 칭찬할 부분

### [G-1] React Query 활용 — 캐시 무효화 타이밍 정확
**파일:** `src/screens/OrderScreen.tsx`

입고 처리 완료 시 `inventory`, `orders` 두 쿼리를 동시에 무효화하여 UI 일관성 유지.

```typescript
onSuccess: (_, { status }) => {
  qc.invalidateQueries({ queryKey: ["orders"] });
  if (status === "received") {
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }
}
```

### [G-2] AI 예측 알고리즘 — 합리적인 설계
**파일:** `core/ai_forecast.py`

- 데이터 부족(3건 미만) 시 graceful degradation (단순 평균 사용)
- 요일 패턴 + 선형 회귀 트렌드 조합
- 신뢰도(confidence) 레이블 반환으로 UI에서 시각화 가능
- 리드타임·안전재고 개념 적용한 발주 수량 계산

### [G-3] 발주 자동화 파이프라인 — 흐름 일관성
AI 예측 → 발주 추천 → 발주서 생성 → 입고 처리 → 재고 자동 반영의 전체 흐름이 연결되어 있음.  
특히 `update_status(RECEIVED)` 시 Transaction 기록 + 재고 반영을 하나의 트랜잭션에서 처리.

### [G-4] Pydantic v2 올바른 사용
**파일:** `routers/*.py`

`model_validate()`, `model_dump(exclude_none=True)` 등 v2 API 적절 사용. ORM mode (`from_attributes = True`) 명시.

### [G-5] 바코드 중복 체크 + 재고 초기화 원자적 처리
**파일:** `routers/items.py`

```python
db.flush()             # item.id 확보
inv = Inventory(item_id=item.id, quantity=0.0)
db.add(inv)
db.commit()            # item + inventory 함께 커밋
```

품목 생성 시 재고 레코드도 동시에 생성하여 재고 NULL 케이스 방지.

### [G-6] 스캔 화면 UI/UX — 미등록 품목 처리 흐름
**파일:** `src/screens/ScanScreen.tsx`

404 시 등록 화면으로 자연스럽게 유도하고, 바코드 값을 params로 전달하는 흐름이 자연스러움.

### [G-7] TypeScript 타입 중앙 관리
**파일:** `src/types/index.ts`

`Item`, `InventoryItem`, `Transaction` 등 공통 타입을 한 파일에서 관리. API 응답과 일치.

### [G-8] 컴포넌트 분리 — 적절한 수준
`StockCard`, `TxCard`, `SummaryCard`, `RecommendSection`, `OrderCard` 등  
화면 내 재사용 단위로 분리되어 있고, 크기도 적절함.

### [G-9] PDF 발주서 한글 폰트 자동 감지
**파일:** `routers/orders.py`

Mac/Linux 시스템 폰트를 순서대로 시도하고 없으면 Helvetica로 폴백.

### [G-10] APScheduler 라이프사이클 올바른 연동
**파일:** `main.py`, `core/scheduler.py`

FastAPI `lifespan` 핸들러에서 스케줄러 시작/종료를 올바르게 처리.

---

## 요약 통계

| 심각도 | 건수 |
|--------|------|
| 🔴 Critical | 7건 |
| 🟡 Warning | 17건 |
| 🟢 Minor | 10건 |
| ✅ 잘된 것 | 10건 |

### 우선순위 Top 5 (즉시 처리)

1. **[C-1] 인증 추가** — 보안 최우선
2. **[C-3] 푸시 토큰 DB 저장** — 서버 재시작 시 알림 불능
3. **[C-4] 재고 차감 동시성** — 음수 재고 데이터 손상
4. **[C-5] N+1 쿼리 (auto_create_orders)** — 품목 수 증가 시 성능 급락
5. **[W-1~W-4] N+1 쿼리 전반** — `joinedload` 추가로 간단히 해결

### 아키텍처 메모

- SQLite → PostgreSQL 전환 없이는 실사용 어려움
- Alembic 없이는 스키마 변경 시 데이터 손실 위험
- 인증 없는 현 상태로는 내부망/개발 환경에서만 사용 가능
