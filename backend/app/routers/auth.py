from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.auth import hash_password, verify_password, create_access_token, get_current_user
from ..models import User
from ..models.user import UserRole

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "admin"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username, User.is_active == True).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")

    token = create_access_token({"sub": user.username})
    return TokenResponse(
        access_token=token,
        role=user.role.value,
        username=user.username,
    )


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    # DB에 유저가 0명일 때만 등록 허용 (초기 어드민 생성용)
    count = db.query(User).count()
    if count > 0:
        raise HTTPException(status_code=403, detail="이미 계정이 존재합니다. 관리자에게 문의하세요.")

    # role 검증
    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 역할: {body.role}")

    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.username})
    return TokenResponse(
        access_token=token,
        role=user.role.value,
        username=user.username,
    )


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    return {
        "username": current_user.username,
        "role": current_user.role.value,
        "is_active": current_user.is_active,
    }
