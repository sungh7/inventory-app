#!/bin/bash
set -e

echo "=== DB 마이그레이션 실행 ==="
alembic upgrade head

echo "=== 초기 어드민 계정 생성 (없으면) ==="
python3 -c "
from app.core.database import SessionLocal
from app.models import User
from app.models.user import UserRole
from app.core.auth import hash_password
import os

app_env = os.getenv('APP_ENV', 'development').lower()
admin_username = os.getenv('ADMIN_USERNAME', 'admin')
admin_password = os.getenv('ADMIN_PASSWORD')

if app_env == 'production' and not admin_password:
    raise RuntimeError('Production에서는 ADMIN_PASSWORD 환경변수가 필요합니다')

if app_env == 'production' and admin_password == 'admin1234':
    raise RuntimeError('Production에서는 기본 ADMIN_PASSWORD를 사용할 수 없습니다')

if not admin_password:
    admin_password = 'admin1234'

db = SessionLocal()
if db.query(User).count() == 0:
    admin = User(
        username=admin_username,
        hashed_password=hash_password(admin_password),
        role=UserRole.ADMIN,
    )
    db.add(admin)
    db.commit()
    print(f'초기 어드민 생성: {admin.username}')
else:
    print('유저 이미 존재, 스킵')
db.close()
"

echo "=== API 서버 시작 ==="
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
