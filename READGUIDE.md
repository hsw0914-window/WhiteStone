# School Chatbot 실행 가이드

백엔드를 먼저 실행한 뒤 프론트엔드를 실행해야 합니다.

---

## 사전 요구사항

- Python 3.10 이상
- Node.js v18 이상
- Gemini API 키 ([Google AI Studio](https://aistudio.google.com)에서 발급)

---

## 1단계 — 백엔드 실행 (School-Chatbot-Backend)

### 1-1. 폴더 이동

```bash
cd School-Chatbot-Backend
```

### 1-2. 가상환경 생성 및 활성화

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 1-3. 패키지 설치

```bash
pip install -r requirements.txt
pip install google-genai
```

> **Windows에서 한글 사용자 이름(예: 한승우)인 경우**  
> `pip` 명령이 `Fatal error in launcher` 오류를 내면 아래처럼 실행하세요.
> ```bash
> python -m pip install -r requirements.txt
> python -m pip install google-genai
> ```

### 1-4. Gemini API 키 환경변수 설정

```bash
# Windows (cmd)
set GEMINI_API_KEY=여기에_발급받은_API_키_입력

# Windows (PowerShell)
$env:GEMINI_API_KEY="여기에_발급받은_API_키_입력"

# macOS / Linux
export GEMINI_API_KEY="여기에_발급받은_API_키_입력"
```

### 1-5. 서버 실행

```bash
# 실제 기기(Expo Go)에서 접속할 경우 — 같은 Wi-Fi 필요
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 에뮬레이터만 사용할 경우
uvicorn main:app --reload
```

> **Windows에서 한글 사용자 이름인 경우** `Fatal error in launcher` 오류가 나면:
> ```bash
> python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
> ```

서버가 정상 실행되면 아래 주소로 확인할 수 있습니다.

- API 서버: http://127.0.0.1:8000
- Swagger UI (API 테스트): http://127.0.0.1:8000/docs

---

## 2단계 — 프론트엔드 실행 (School-Chatbot-Frontend)

새 터미널을 열고 진행하세요. 백엔드 터미널은 계속 켜둬야 합니다.

### 2-1. 폴더 이동

```bash
cd School-Chatbot-Frontend
```

### 2-2. 의존성 설치 및 SDK 버전 맞추기

Expo Go 앱 버전과 프로젝트 SDK 버전이 일치해야 합니다.  
스마트폰 Expo Go가 **SDK 54**라면 아래 명령으로 업그레이드하세요.

```bash
npm install expo@~54.0.0
npx expo install --fix
npm install babel-preset-expo
```

> `npx expo install --fix` 는 react, react-native 등 나머지 의존성을 SDK 버전에 맞게 자동 조정합니다.

이미 버전이 맞다면 그냥 실행하세요:

```bash
npm install
```

### 2-3. API 주소 설정

`constants.js` 파일을 열어 환경에 맞게 수정하세요.

| 실행 환경 | API_URL 값 |
|-----------|-----------|
| Android 에뮬레이터 | `http://10.0.2.2:8000/chat` |
| iOS 시뮬레이터 (Mac) | `http://localhost:8000/chat` |
| 실제 기기 (Expo Go) | `http://192.168.X.X:8000/chat` ← 본인 PC IP로 변경 |

**PC IP 확인 방법:**
- Windows: 명령 프롬프트에서 `ipconfig` → IPv4 주소
- Mac/Linux: 터미널에서 `ifconfig | grep inet`

### 2-4. Expo 앱 실행

```bash
npx expo start --lan
```

터미널에 QR 코드가 표시됩니다.

> `--lan` 옵션은 같은 Wi-Fi 내에서 PC IP로 연결합니다.  
> QR 스캔 후 연결이 안 되면 Windows 방화벽에서 **8081 포트 인바운드 허용**이 필요합니다.  
> (Windows Defender 방화벽 → 고급 설정 → 인바운드 규칙 → 새 규칙 → 포트 8081 TCP 허용)

| 방법 | 실행 방법 |
|------|----------|
| 스마트폰 (Expo Go 앱) | QR 코드 스캔 |
| Android 에뮬레이터 | 터미널에서 `a` 키 입력 |
| iOS 시뮬레이터 (Mac) | 터미널에서 `i` 키 입력 |
| 웹 브라우저 | 터미널에서 `w` 키 입력 |

> Expo Go 앱은 App Store / Google Play에서 설치할 수 있습니다.

---

## 실행 순서 요약

```
1. 백엔드 터미널
   └─ venv 활성화
   └─ GEMINI_API_KEY 환경변수 설정
   └─ python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
      (한글 사용자 이름이면 python -m uvicorn 사용)

2. 프론트엔드 터미널 (새 창)
   └─ constants.js에서 API_URL 확인/수정 (본인 PC IP로)
   └─ npm install expo@~54.0.0 && npx expo install --fix && npm install babel-preset-expo
      (최초 1회 또는 SDK 버전 불일치 시)
   └─ npx expo start --lan
```

---

## 자주 발생하는 문제

| 증상 | 해결 방법 |
|------|----------|
| `Fatal error in launcher` (pip/uvicorn) | 한글 사용자 이름 경로 문제 → `python -m pip` / `python -m uvicorn` 으로 대체 |
| `GEMINI_API_KEY가 설정되지 않았습니다` | 환경변수 설정 후 서버 재시작 |
| `uvicorn: command not found` | 가상환경 활성화 여부 확인 |
| `ModuleNotFoundError: google.genai` | `python -m pip install google-genai` 실행 |
| Expo Go에서 `Failed to download remote update` | PC와 폰이 같은 Wi-Fi인지 확인, `npx expo start --lan` 으로 재시작 |
| Expo Go SDK 버전 불일치 | `npm install expo@~54.0.0 && npx expo install --fix` 실행 |
| `Cannot find module 'babel-preset-expo'` | `npm install babel-preset-expo` 실행 후 재시작 |
| 실제 기기에서 API 서버 연결 실패 | `constants.js`의 IP가 PC 실제 IP와 일치하는지 확인, 같은 Wi-Fi 연결 확인 |
