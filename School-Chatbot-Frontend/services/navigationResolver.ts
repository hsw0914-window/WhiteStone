import { CampusPlace, NavigationIntent } from '../types/place';

export interface UserLocation {
  lat: number;
  lng: number;
}

// 위도·경도 기반 유클리드 거리 (근사치 비교용)
function getDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dlat = lat1 - lat2;
  const dlng = lng1 - lng2;
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini가 해석한 NavigationIntent를 받아 실제 목적지 CampusPlace를 반환
// ─────────────────────────────────────────────────────────────────────────────
export function resolveNavigationIntent(
  intent: NavigationIntent,
  places: CampusPlace[],
  currentLocation?: UserLocation
): CampusPlace | null {
  // 1) Gemini가 장소명을 직접 특정한 경우
  if (intent.matched_place_name) {
    return places.find(p => p.place_name === intent.matched_place_name) ?? null;
  }

  let candidates = places;

  // 2) 서비스 키워드로 필터링 (예: "인쇄", "장학")
  if (intent.target_service) {
    candidates = candidates.filter(p =>
      p.services.some(s => s.includes(intent.target_service!))
    );
  }

  // 3) 건물 유형으로 필터링 (예: "식당")
  if (intent.place_type) {
    candidates = candidates.filter(p =>
      p.building_type === intent.place_type ||
      p.services.some(s => s.includes(intent.place_type!))
    );
  }

  if (candidates.length === 0) return null;

  // 4) "가장 가까운" 조건이 있고 현재 위치를 알면 거리 계산
  if (intent.condition === 'nearest' && currentLocation) {
    return candidates.reduce((nearest, place) => {
      const d = getDistance(currentLocation.lat, currentLocation.lng, place.lat, place.lng);
      const nd = getDistance(currentLocation.lat, currentLocation.lng, nearest.lat, nearest.lng);
      return d < nd ? place : nearest;
    });
  }

  return candidates[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Gemini 함수 — 나중에 실제 백엔드 /navigate 엔드포인트로 교체
//
// 교체 시 이 함수 내부만 바꾸면 됨:
//   const res = await fetch(`${API_BASE}/navigate`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ question: userText }),
//   });
//   return res.json();
// ─────────────────────────────────────────────────────────────────────────────
export async function getNavigationIntentFromGemini(
  userText: string
): Promise<NavigationIntent> {
  const text = userText.toLowerCase();

  if (text.includes('인쇄') || text.includes('복사')) {
    return { intent: 'navigate', target_service: '인쇄' };
  }
  if (text.includes('장학') || text.includes('학생지원')) {
    return { intent: 'navigate', target_service: '장학' };
  }
  if (text.includes('도서관') || text.includes('열람')) {
    return { intent: 'navigate', target_service: '열람' };
  }
  if (text.includes('식당') && (text.includes('가까운') || text.includes('가깝'))) {
    return { intent: 'navigate', place_type: '식당', condition: 'nearest' };
  }
  if (text.includes('식당')) {
    return { intent: 'navigate', place_type: '식당' };
  }

  return { intent: 'navigate' };
}
