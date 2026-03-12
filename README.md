# 재고관리 앱 (고깃집/음식점)

바코드 스캔 기반 재고 관리 앱

## 스택
- **앱**: Expo (React Native) + TypeScript
- **서버**: FastAPI (Python) + SQLAlchemy
- **DB**: PostgreSQL

## 실행 방법

### 1. 백엔드

#### A. 로컬 Python 실행

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### B. Docker 실행

```bash
cd inventory-app
docker-compose up -d
```

서버 실행 확인: http://localhost:8000/health  
API 문서: http://localhost:8000/docs

### 2. 앱 (Expo)

```bash
cd app
cp .env.example .env
# .env에서 EXPO_PUBLIC_API_URL 수정 (실기기 테스트 시 PC IP로 변경)
# 예: EXPO_PUBLIC_API_URL=http://192.168.0.10:8000

npm install
npx expo start
```

- iOS: Expo Go 앱으로 QR 스캔
- Android: Expo Go 앱으로 QR 스캔

> ⚠️ 실기기 테스트 시 localhost 대신 PC의 로컬 IP를 사용해야 합니다.

## 데모 데이터 사용법

앱 화면 확인용 더미데이터는 `backend/seed_data.py`로 생성할 수 있습니다.

### 데모 데이터 재생성

```bash
cd backend
./venv/bin/python seed_data.py --reset
```

또는 venv 활성화 후:

```bash
python seed_data.py --reset
```

### 시드 특징

- 고깃집/음식점용 샘플 품목 **12개** 생성
- 공급업체 **4개**, 직원 **3개** 생성
- 메뉴 **6개**, 레시피 **19개** 생성
- 최근 **60일치 트랜잭션** 생성
- 최근 **21일치 판매 데이터** 생성
- 재고 부족 품목 / 만료 임박 품목 / 발주 추천 데이터 포함
- 월간 리포트/통계 화면이 비지 않도록 판매/원가 데이터 포함

### 생성 후 기대 화면

- **재고 화면**: 재고 부족 3개 내외, 만료 임박 품목 표시
- **이력 화면**: 오늘 포함 최근 트랜잭션 다수 표시
- **통계 화면**: 오늘 입고/출고, 소비량 TOP, 폐기 손실 표시
- **발주 화면**: 자동 발주 추천 + 데모 발주서 표시
- **메뉴 화면**: 메뉴 원가/마진율 및 판매 입력 가능
- **리포트 화면**: 월간 매출/원가/마진 데이터 표시

### 주의

- `--reset` 옵션은 기존 업무 데이터를 초기화하고 데모 데이터로 다시 채웁니다.
- 실행 전 `inventory.db` 백업을 권장합니다.
- 개발 중 기존 데이터와 섞고 싶지 않다면 항상 `--reset` 사용을 권장합니다.

## 배포 메모

현재 구조 기준 권장 배포 방식:

- **Vercel**: `frontend/` (Next.js 웹 대시보드)
- **Railway**: `backend/` (FastAPI API + PostgreSQL)
- **Expo 앱(`app/`)**: 스토어/디바이스 테스트용 별도 실행

### Vercel 프론트엔드

`frontend/.env.example`

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
```

Vercel 환경변수에도 동일하게 `NEXT_PUBLIC_API_URL` 설정 필요.

### Railway 백엔드

`backend/.env.example` 기준으로 아래 값 설정 권장:

- `APP_ENV=production`
- `DATABASE_URL`
- `SECRET_KEY`
- `ALLOWED_ORIGINS`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AUTO_CREATE_TABLES=false`
- `ENABLE_API_DOCS=false`

예시:

```env
APP_ENV=production
DATABASE_URL=postgresql://...
SECRET_KEY=change-this-in-production
ALLOWED_ORIGINS=https://your-frontend.vercel.app
AUTO_CREATE_TABLES=false
ENABLE_API_DOCS=false
```

### 배포 시 주의

- 프로덕션에서는 SQLite 대신 **Railway PostgreSQL** 사용 권장
- `seed_data.py --reset` 는 **데모/개발 DB 전용**으로 사용 권장
- 배포 후 CORS에 Vercel 도메인이 포함되어야 웹 대시보드가 정상 연결됨
- 프로덕션에서는 기본 `SECRET_KEY` 사용 금지
- 프로덕션에서는 API Docs 비활성화 권장
- 관리자 변경 작업(품목/공급업체/직원/메뉴/발주 상태 변경)은 admin 권한 필요

## 주요 기능

| 기능 | 설명 |
|------|------|
| 바코드 스캔 | EAN-13, EAN-8, QR, Code128 지원 |
| 입고 처리 | 수량 + 유통기한 입력 |
| 출고/폐기 | 재고 부족 시 오류 안내 |
| 재고 현황 | 전체 목록 + 부족/만료임박 표시 |
| 이력 조회 | 입고/출고/폐기 필터링 |
| 미등록 품목 | 바코드 스캔 후 즉시 등록 |

## API 엔드포인트

```
GET  /inventory/alerts     # 재고 부족 + 유통기한 임박 알림
GET  /items/barcode/{code} # 바코드로 품목 조회
POST /transactions/        # 입고/출고/폐기 처리
```

전체 문서: http://localhost:8000/docs
