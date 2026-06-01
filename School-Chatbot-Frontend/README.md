# School Chatbot Frontend (Expo)

학교 안내 AI 챗봇 백엔드 테스트용 React Native 앱입니다.

---

## 파일 구조

```
school-chatbot-frontend/
├── App.js                  # 메인 화면 (입력창, 전송 버튼, 로딩)
├── constants.js            # API_URL 설정
├── components/
│   └── ResponseCard.js     # 응답 결과 카드 컴포넌트
├── app.json                # Expo 앱 설정
├── package.json
└── babel.config.js
```

---

## 실행 방법

### 1. Node.js 설치 확인

```bash
node -v   # v18 이상 권장
npm -v
```

### 2. Expo CLI 설치 (전역)

```bash
npm install -g expo-cli
```

### 3. 의존성 설치

```bash
cd school-chatbot-frontend
npm install
```

### 4. 백엔드 서버 실행 (별도 터미널)

```bash
cd school-chatbot-backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> `--host 0.0.0.0` 을 추가해야 같은 Wi-Fi의 기기에서도 접근 가능합니다.

### 5. API 주소 설정

`constants.js` 파일을 열어 본인 환경에 맞는 주소로 변경하세요.

| 환경 | API_URL |
|------|---------|
| Android 에뮬레이터 | `http://10.0.2.2:8000/chat` |
| iOS 시뮬레이터 (Mac) | `http://localhost:8000/chat` |
| 실제 기기 (Android/iPhone) | `http://192.168.X.X:8000/chat` (본인 PC IP) |

**PC IP 확인 방법:**
- Windows: 명령 프롬프트에서 `ipconfig` → IPv4 주소
- Mac/Linux: 터미널에서 `ifconfig | grep "inet "`

⚠️ 실제 기기에서는 `localhost`가 동작하지 않습니다. 기기 자신의 주소를 가리키기 때문입니다.

### 6. Expo 앱 실행

```bash
npx expo start
```

터미널에 QR 코드가 표시됩니다.

| 방법 | 설명 |
|------|------|
| **Expo Go 앱** | 스마트폰에 Expo Go 설치 후 QR 코드 스캔 |
| **Android 에뮬레이터** | 터미널에서 `a` 키 입력 |
| **iOS 시뮬레이터** | 터미널에서 `i` 키 입력 (Mac 전용) |
| **웹 브라우저** | 터미널에서 `w` 키 입력 |

---

## 동작 흐름

```
사용자 질문 입력
       ↓
전송 버튼 클릭
       ↓
POST /chat 요청 (constants.js의 API_URL)
       ↓
백엔드 응답 수신
       ↓
ResponseCard에 결과 표시
  - 카테고리
  - 매칭된 질문
  - 답변
  - 신뢰도
  - 관련 URL
```

---

## 예외 처리

| 상황 | 동작 |
|------|------|
| 빈 질문 입력 후 전송 | Alert 경고창 표시 |
| 서버 연결 실패 | 에러 카드 표시 (API_URL 확인 안내) |
| HTTP 에러 (422 등) | 서버 에러 메시지 카드 표시 |
| 로딩 중 | 전송 버튼 비활성화 + 스피너 표시 |
