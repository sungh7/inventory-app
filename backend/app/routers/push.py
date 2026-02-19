from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..core.database import get_db
from ..core.scheduler import check_inventory_alerts
from ..models import PushToken

router = APIRouter()


class TokenRequest(BaseModel):
    token: str


@router.post("/register")
def register_push_token(payload: TokenRequest, db: Session = Depends(get_db)):
    """앱에서 Expo 푸시 토큰 등록 (이미 있으면 무시)"""
    existing = db.query(PushToken).filter(PushToken.token == payload.token).first()
    if not existing:
        db.add(PushToken(token=payload.token))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # 동시 등록 race condition 대비
    return {"ok": True}


@router.post("/test")
async def test_alert():
    """수동으로 알림 체크 트리거 (개발용)"""
    await check_inventory_alerts()
    return {"ok": True}
