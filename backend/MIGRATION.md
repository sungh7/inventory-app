# DB 마이그레이션 가이드

Alembic을 사용한 SQLite 스키마 마이그레이션 관리.

## 초기 설정 (신규 환경)

```bash
cd backend/
source venv/bin/activate
alembic upgrade head
```

## 새 마이그레이션 생성 (모델 변경 후)

```bash
# 1. app/models/ 아래 모델 변경
# 2. 변경사항 자동 감지 및 마이그레이션 파일 생성
alembic revision --autogenerate -m "변경 내용 설명"

# 3. 생성된 파일 확인 (alembic/versions/)
# 4. DB에 적용
alembic upgrade head
```

## 현재 버전 확인

```bash
alembic current
```

## 스키마 동기화 상태 확인

```bash
alembic check
# "No new upgrade operations detected." → 동기화됨
```

## 마이그레이션 히스토리

```bash
alembic history --verbose
```

## 롤백

```bash
# 한 단계 되돌리기
alembic downgrade -1

# 특정 revision으로 되돌리기
alembic downgrade <revision_id>
```

## 특정 버전으로 업그레이드

```bash
alembic upgrade <revision_id>
alembic upgrade head  # 최신으로
```

## 개발 환경 설정

`AUTO_CREATE_TABLES` 환경변수로 자동 테이블 생성 제어:

```bash
# Alembic으로 마이그레이션 관리할 때 (권장)
export AUTO_CREATE_TABLES=false
alembic upgrade head
uvicorn app.main:app --reload

# 개발 중 빠른 실행 (기본값)
uvicorn app.main:app --reload  # AUTO_CREATE_TABLES=true (기본)
```

## 주의사항

- SQLite는 ALTER TABLE 제약이 있어 `render_as_batch=True` 설정으로 처리함
- 실제 데이터가 있는 DB에서 컬럼 삭제 시 주의
- 마이그레이션 파일은 반드시 git에 커밋
