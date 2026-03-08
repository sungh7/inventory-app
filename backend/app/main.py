from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt, JWTError

from .core.database import engine
from .core.scheduler import start_scheduler, scheduler
from .core.config import settings
from .core.auth import ALGORITHM
from .models import Base
from .routers import items, inventory, transactions, suppliers
from .routers import push, stats, orders, ai
from .routers import menus, sales, reports
from .routers import staff as staff_router
from .routers import auth as auth_router

# DB 테이블 자동 생성 (개발 편의용)
# 프로덕션/마이그레이션 관리 시: AUTO_CREATE_TABLES=false 설정 후 `alembic upgrade head` 사용
if os.getenv("AUTO_CREATE_TABLES", "true").lower() == "true":
    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    scheduler.shutdown()


app = FastAPI(title="Inventory API", version="0.2.0", lifespan=lifespan)

# CORS - 환경변수에서 허용 도메인 읽기
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8081,http://localhost:19006,https://inventory-app-olive-seven.vercel.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 인증 불필요 경로
PUBLIC_PATHS = {"/health", "/auth/login", "/auth/register", "/docs", "/openapi.json", "/redoc"}


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    # CORS preflight는 인증 없이 통과
    if request.method == "OPTIONS":
        return await call_next(request)

    # PUBLIC_PATHS는 통과
    if request.url.path in PUBLIC_PATHS or request.url.path.startswith("/docs"):
        return await call_next(request)

    # Authorization 헤더 확인
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "인증이 필요합니다"})

    token = auth_header.split(" ")[1]
    try:
        jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return JSONResponse(status_code=401, content={"detail": "유효하지 않은 토큰"})

    return await call_next(request)


app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(items.router, prefix="/items", tags=["items"])
app.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
app.include_router(push.router, prefix="/push", tags=["push"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])
app.include_router(menus.router, prefix="/menus", tags=["menus"])
app.include_router(sales.router, prefix="/sales", tags=["sales"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(staff_router.router, prefix="/staff", tags=["staff"])


@app.get("/health")
def health():
    return {"status": "ok"}
