# SQLite → PostgreSQL 마이그레이션 가이드

## 개요

현재 개발 환경에서는 SQLite를 사용하고 있으나, 프로덕션에서는 **PostgreSQL** 사용을 강력히 권장합니다.

### SQLite 한계

- ❌ 동시 쓰기 요청 처리 불가 (단일 writer lock)
- ❌ `SELECT FOR UPDATE` 미지원 (재고 동시성 제어 불가)
- ❌ ALTER TABLE 제약사항 (컬럼 삭제/타입 변경 어려움)
- ❌ 멀티프로세스 환경 (Gunicorn 등) 부적합

### PostgreSQL 장점

- ✅ 진정한 동시성 지원 (MVCC)
- ✅ Row-level locking (`with_for_update()` 작동)
- ✅ 풍부한 ALTER TABLE 지원
- ✅ 대규모 트래픽 처리
- ✅ JSON 타입, Full-text search 등 고급 기능

---

## Railway에서 PostgreSQL 추가

### 1. Railway Dashboard 접속

<https://railway.app/dashboard>

### 2. Postgres 프로비저닝

1. 프로젝트 클릭
2. **"+ New"** 버튼 → **Database** → **PostgreSQL**
3. 자동으로 `DATABASE_URL` 환경변수 생성됨

### 3. 백엔드 서비스에 연결

1. 백엔드 서비스 클릭
2. **Variables** 탭
3. **Reference** 버튼 클릭
4. Postgres 서비스의 `DATABASE_URL` 선택

형식 예시:
```
postgresql://postgres:password@postgres.railway.internal:5432/railway
```

### 4. 추가 환경변수

```bash
AUTO_CREATE_TABLES=false  # Alembic 사용
ADMIN_USERNAME=admin       # 초기 어드민 계정
ADMIN_PASSWORD=안전한비밀번호  # 꼭 변경!
```

### 5. 배포

저장 후 자동 재배포. `start.sh`가 알아서:
1. `alembic upgrade head` 실행 (스키마 생성)
2. 초기 어드민 계정 생성
3. 서버 시작

---

## 로컬 개발 환경 (선택)

로컬에서도 PostgreSQL을 사용하려면:

### 1. PostgreSQL 설치

**Mac (Homebrew):**
```bash
brew install postgresql@17
brew services start postgresql@17
```

**Linux (Ubuntu):**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
[공식 설치 프로그램](https://www.postgresql.org/download/windows/)

### 2. 데이터베이스 생성

```bash
psql postgres
```

```sql
CREATE DATABASE inventory_dev;
CREATE USER inventory_user WITH PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE inventory_dev TO inventory_user;
\q
```

### 3. .env 파일 (backend/.env)

```bash
DATABASE_URL=postgresql://inventory_user:dev_password@localhost/inventory_dev
AUTO_CREATE_TABLES=false
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin1234
```

### 4. 마이그레이션 적용

```bash
cd backend
source venv/bin/activate
alembic upgrade head
python seed_data.py  # 샘플 데이터
```

### 5. 서버 실행

```bash
uvicorn app.main:app --reload
```

---

## 데이터 마이그레이션 (SQLite → PostgreSQL)

기존 SQLite 데이터를 PostgreSQL로 옮기려면:

### 방법 1: 수동 Export/Import (권장)

```bash
# 1. SQLite에서 데이터 추출
sqlite3 inventory.db .dump > backup.sql

# 2. PostgreSQL용으로 변환 (따옴표 조정)
sed -i '' 's/AUTOINCREMENT/SERIAL/g' backup.sql

# 3. PostgreSQL에 적용
psql -U inventory_user -d inventory_dev -f backup.sql
```

### 방법 2: pgloader 사용

```bash
brew install pgloader  # Mac
# 또는
sudo apt install pgloader  # Ubuntu

pgloader \
  sqlite://./inventory.db \
  postgresql://inventory_user:dev_password@localhost/inventory_dev
```

### 방법 3: Python 스크립트 (샘플 데이터만)

```bash
# 기존 seed_data.py 재실행
python seed_data.py
```

---

## 검증

PostgreSQL 전환 후 확인:

```bash
# 1. DB 연결 확인
psql $DATABASE_URL -c "SELECT version();"

# 2. 테이블 목록
psql $DATABASE_URL -c "\dt"

# 3. 샘플 쿼리
psql $DATABASE_URL -c "SELECT COUNT(*) FROM items;"
```

API 서버에서:
```bash
curl http://localhost:8000/health
curl http://localhost:8000/items/
```

---

## 롤백 계획

문제 발생 시 SQLite로 돌아가기:

Railway Variables에서:
```bash
DATABASE_URL=sqlite:///./inventory.db  # 기본값으로 복구
AUTO_CREATE_TABLES=true  # 임시로 true
```

---

## 비용

Railway PostgreSQL:
- **무료 플랜:** 제한적 (개발/테스트용)
- **Pro 플랜:** 사용량 기반 과금

대안:
- [Neon](https://neon.tech/) - 무료 tier 제공
- [Supabase](https://supabase.com/) - Postgres + 무료 tier
- [ElephantSQL](https://www.elephantsql.com/) - 무료 20MB

---

## 다음 단계

PostgreSQL 전환 후:
1. ✅ 동시성 개선 (재고 차감 안전)
2. ✅ 성능 향상 (인덱스 최적화)
3. 🚀 고급 기능 활용 (Full-text search, JSON 쿼리 등)

---

## 문제 해결

### "relation does not exist" 에러

```bash
alembic upgrade head  # 마이그레이션 재실행
```

### 연결 실패

Railway에서 `DATABASE_URL` 형식 확인:
```
postgresql://user:pass@host.railway.internal:5432/dbname
```

### 성능 느림

```sql
-- 인덱스 생성
CREATE INDEX idx_items_barcode ON items(barcode);
CREATE INDEX idx_inventory_item_id ON inventory(item_id);
CREATE INDEX idx_transactions_item_id ON transactions(item_id);
```

(이미 Alembic 마이그레이션에 포함되어 있음)

---

**권장:** 최대한 빨리 PostgreSQL로 전환하세요! 🚀
