from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db

# bcrypt가 로컬 Py3.14에서 이슈가 있어 기본은 pbkdf2_sha256 사용
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)  # auto_error=False: 미인증 시 None 반환

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    """현재 로그인된 유저 반환. 토큰 없거나 유효하지 않으면 401."""
    from ..models import User
    if not credentials:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
    except JWTError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰")

    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다")
    return user


def require_admin(current_user=Depends(get_current_user)):
    """admin 역할만 허용"""
    from ..models.user import UserRole
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")
    return current_user
