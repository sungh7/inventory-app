# 재고 관리 시스템 - 프론트엔드

Next.js 기반 재고 관리 웹 애플리케이션

## 시작하기

### 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

### 환경 변수 설정

`.env.local` 파일 생성:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
```

## 기능

- 🔐 로그인/로그아웃
- 📊 대시보드 (통계)
- 📦 재고 목록 조회
- ➕ 재고 추가/수정/삭제
- 📝 입출고 기록
- ⚠️ 재고 부족 알림

## 배포

### Vercel 배포

1. Vercel에 GitHub 레포 연결
2. 루트 디렉토리를 `frontend`로 설정
3. 환경 변수 추가:
   - `NEXT_PUBLIC_API_URL`
4. 배포!

## 기술 스택

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Axios
