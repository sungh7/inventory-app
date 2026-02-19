# 재고관리 앱 (고깃집/음식점)

바코드 스캔 기반 재고 관리 앱

## 스택
- **앱**: Expo (React Native) + TypeScript
- **서버**: FastAPI (Python) + SQLAlchemy
- **DB**: PostgreSQL

## 실행 방법

### 1. 백엔드 (Docker)

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
