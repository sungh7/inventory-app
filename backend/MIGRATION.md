# 데이터베이스 마이그레이션 가이드 (Alembic)

## 개요

이 프로젝트는 **Alembic**을 사용하여 데이터베이스 스키마를 관리합니다.

---

## 로컬 개발 환경

### 1. 가상환경 활성화

```bash
cd backend
source venv/bin/activate  # Mac/Linux
# 또는
venv\Scripts\activate  # Windows
```

### 2. 현재 마이그레이션 상태 확인

```bash
alembic current
```

### 3. 최신 버전으로 업그레이드

```bash
alembic upgrade head
```

### 4. 모델 변경 후 마이그레이션 생성

```python
# app/models/item.py 등에서 모델 수정 후:
```

```bash
alembic revision --autogenerate -m "add new column to items"
```

생성된 마이그레이션 파일(`alembic/versions/*.py`)을 확인하고 필요 시 수정.

### 5. 마이그레이션 적용

```bash
alembic upgrade head
```

### 6. 롤백 (이전 버전으로)

```bash
alembic downgrade -1  # 1단계 뒤로
# 또는
alembic downgrade <revision_id>  # 특정 버전으로
```

---

## 프로덕션 배포 (Railway)

### 환경변수 설정

Railway 대시보드 → Variables 탭:

```
AUTO_CREATE_TABLES=false
```

이렇게 하면 `main.py`의 `Base.metadata.create_all()`이 실행되지 않고,  
대신 Alembic 마이그레이션을 사용하게 됩니다.

### 배포 시 자동 마이그레이션

`start.sh`에 이미 포함되어 있습니다:

```bash
#!/bin/bash
alembic upgrade head  # 최신 마이그레이션 적용
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Railway에서 배포 시 자동으로 실행됩니다.

---

## 주의사항

### ⚠️ SQLite 제약사항

SQLite는 일부 ALTER TABLE 작업을 지원하지 않습니다:
- 컬럼 타입 변경 불가
- 컬럼 삭제 제약사항
- Foreign Key 변경 제약사항

**해결책:**
- PostgreSQL 사용 (권장)
- 또는 수동 마이그레이션 작성 (테이블 재생성)

### ✅ PostgreSQL 전환 시

환경변수만 변경하면 됩니다:

```bash
# Railway에서:
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

Alembic은 자동으로 PostgreSQL 방언을 사용합니다.

---

## 현재 마이그레이션 히스토리

```
115b141a1ac1 - initial_schema (2025-02)
1f5edc98a943 - add_users_table (2025-02) [HEAD]
```

---

## 문제 해결

### "Target database is not up to date" 에러

```bash
alembic stamp head  # 현재 DB 상태를 HEAD로 강제 동기화 (주의!)
```

### 마이그레이션 충돌

```bash
alembic history  # 마이그레이션 이력 확인
alembic merge <rev1> <rev2> -m "merge conflict"  # 브랜치 병합
```

### 개발 중 DB 초기화

```bash
rm inventory.db  # SQLite 삭제
alembic upgrade head  # 깨끗한 스키마 재생성
python seed_data.py  # 샘플 데이터 재입력
```

---

## 참고

- [Alembic 공식 문서](https://alembic.sqlalchemy.org/)
- [SQLAlchemy ORM](https://docs.sqlalchemy.org/)
