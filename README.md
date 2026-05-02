# GODO — 드론 촬영 스튜디오

드론으로 촬영한 작품을 지도에 위치별로 전시하는 포트폴리오 사이트입니다.
Vite + React 프론트엔드로, Spring Boot 백엔드(별도 프로젝트)와 연동됩니다.

## 주요 기능

- **홈**: Hero · 포트폴리오(백엔드 API 연동) · 서비스 · 소개 · 문의
- **지도 (`/map`)**: 카카오맵 위 전체 촬영 위치 마커, 마커 클릭 시 해당 위치 작품 갤러리 모달 + 상세 뷰어
- **관리자 업로드 (`/admin/upload`)**: 진입 시 비밀번호 모달 → Basic Auth 자격 증명을 sessionStorage에 저장 → 이미지/영상 파일 선택 → 지도에서 위치 지정 → Presigned URL로 S3 직접 업로드 → 완료 처리

## 기술 스택

- React 19 + Vite
- react-router-dom (SPA 라우팅)
- axios (API 클라이언트, 요청 인터셉터로 Basic Auth 자동 주입)
- react-kakao-maps-sdk (카카오맵)
- react-hot-toast (토스트 알림)

## 시작하기

### 1. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 만드세요 (`.env.example` 참고):

```env
VITE_API_URL=http://localhost:8080
VITE_KAKAO_MAP_KEY=your_kakao_js_key_here
```

- `VITE_API_URL` — 백엔드 API 주소
- `VITE_KAKAO_MAP_KEY` — [카카오 디벨로퍼스](https://developers.kakao.com/)에서 발급받은 JavaScript 키

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 주소: http://localhost:5173

### 4. 프로덕션 빌드

```bash
npm run build
npm run preview
```

## 백엔드 연동

이 프론트엔드는 `http://localhost:8080`에서 실행되는 REST API를 가정합니다.

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET  | `/api/media/locations`          | 전체 위치 목록         | ✕ |
| GET  | `/api/media/nearby`             | 좌표 주변 미디어 조회   | ✕ |
| GET  | `/api/media/:id`                | 미디어 상세            | ✕ |
| POST | `/api/media/upload-url`         | Presigned URL 발급    | Basic |
| POST | `/api/media/:id/complete`       | 업로드 완료 처리       | Basic |
| DELETE | `/api/media/:id`              | 미디어 삭제            | Basic |

## 관리자 인증

1. 네비바의 "업로드" 또는 `/admin/upload` 직접 접근
2. 비밀번호 모달에서 관리자 비밀번호 입력 (username은 `admin`으로 고정)
3. 자격 증명이 sessionStorage에 `Base64(admin:비밀번호)` 형식으로 저장되어 axios 요청에 자동 주입됨
4. 네비바 또는 업로드 페이지 우측 상단의 "로그아웃" 버튼으로 즉시 해제

> 로그인 API가 없으므로 입력한 비밀번호는 즉시 저장되고, 실제 검증은 업로드 요청 시 이루어집니다.
> 401 응답이 오면 자동으로 sessionStorage가 비워지고 비밀번호 모달이 다시 표시됩니다.
> sessionStorage를 사용하므로 **브라우저 탭을 닫으면 자동으로 로그아웃**됩니다.

## 프로젝트 구조

```
src/
├── components/
│   └── Navbar.jsx / Navbar.css     # 상단 네비게이션 (라우팅 + 해시 스크롤)
├── pages/
│   ├── Home.jsx / Home.css         # 메인 페이지
│   ├── MapPage.jsx / MapPage.css   # 전체 지도 + 갤러리 모달 + 상세 뷰어
│   └── AdminUpload.jsx / .css      # 관리자 업로드 (비밀번호 모달 내장)
├── lib/
│   ├── api.js                      # axios 인스턴스 + mediaApi 함수들
│   └── auth.js                     # Basic Auth 관리 (localStorage)
├── hooks/
│   └── useInView.js                # IntersectionObserver 훅
├── data/
│   └── portfolio.js                # 서비스 항목 (portfolioItems는 미사용)
├── App.jsx                         # 라우팅 + Toaster
└── main.jsx
```
