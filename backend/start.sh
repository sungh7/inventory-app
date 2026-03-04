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

db = SessionLocal()
if db.query(User).count() == 0:
    admin = User(
        username=os.getenv('ADMIN_USERNAME', 'admin'),
        hashed_password=hash_password(os.getenv('ADMIN_PASSWORD', 'admin1234')),
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
