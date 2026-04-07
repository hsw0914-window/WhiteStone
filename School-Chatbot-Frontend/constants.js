// ─────────────────────────────────────────────────────────────────────────────
// API 주소 설정
//
// 환경에 따라 아래 중 하나를 선택해 사용하세요.
//
// [1] Android 에뮬레이터
//     에뮬레이터는 호스트 PC를 10.0.2.2 로 바라봅니다.
//     → "http://10.0.2.2:8000/chat"
//
// [2] iOS 시뮬레이터 (Mac 전용)
//     시뮬레이터는 Mac 자신을 localhost 로 바라봅니다.
//     → "http://localhost:8000/chat"
//
// [3] 실제 기기 (Android / iPhone)
//     실제 기기는 PC의 실제 로컬 IP가 필요합니다.
//     PC와 기기가 같은 Wi-Fi에 연결되어 있어야 합니다.
//     PC의 IP 확인 방법:
//       Windows: ipconfig  → IPv4 주소
//       Mac/Linux: ifconfig | grep inet
//     → "http://192.168.X.X:8000/chat"  ← 본인 PC IP로 교체
//
// ⚠️  실제 기기에서 "localhost" 를 사용하면 동작하지 않습니다.
//     localhost는 기기 자신을 가리키기 때문입니다.
// ─────────────────────────────────────────────────────────────────────────────

export const API_URL = "http://192.168.X.X:8000/chat"; // 실제 기기 (Expo Go)

// 필요에 따라 아래 줄의 주석을 해제하고 위 줄을 주석 처리하세요.
// export const API_URL = "http://localhost:8000/chat";         // iOS 시뮬레이터
// export const API_URL = "http://192.168.0.10:8000/chat";     // 실제 기기 (IP 교체 필요)
