import { CampusPlace, NavigationIntent } from '../types/place';

export interface UserLocation {
  lat: number;
  lng: number;
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = lat1 - lat2;
  const dlng = lng1 - lng2;
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

export function resolveNavigationIntent(
  intent: NavigationIntent,
  places: CampusPlace[],
  currentLocation?: UserLocation
): CampusPlace | null {
  if (intent.matched_place_name) {
    return places.find((place) => place.place_name === intent.matched_place_name) ?? null;
  }

  let candidates = places;

  if (intent.target_service) {
    candidates = candidates.filter((place) =>
      place.services.some((service) => service.includes(intent.target_service!))
    );
  }

  if (intent.place_type) {
    candidates = candidates.filter(
      (place) =>
        place.building_type === intent.place_type ||
        place.services.some((service) => service.includes(intent.place_type!))
    );
  }

  if (candidates.length === 0) return null;

  if (intent.condition === 'nearest' && currentLocation) {
    return candidates.reduce((nearest, place) => {
      const distance = getDistance(currentLocation.lat, currentLocation.lng, place.lat, place.lng);
      const nearestDistance = getDistance(currentLocation.lat, currentLocation.lng, nearest.lat, nearest.lng);
      return distance < nearestDistance ? place : nearest;
    });
  }

  return candidates[0];
}

export async function getNavigationIntentFromMock(userText: string): Promise<NavigationIntent> {
  const text = userText.toLowerCase();

  if (text.includes('복사') || text.includes('인쇄') || text.includes('프린트')) {
    return { intent: 'navigate', target_service: '복사' };
  }
  if (text.includes('장학') || text.includes('학생지원')) {
    return { intent: 'navigate', target_service: '장학' };
  }
  if (text.includes('도서관') || text.includes('열람')) {
    return { intent: 'navigate', target_service: '열람' };
  }
  if (text.includes('식당') && (text.includes('가까운') || text.includes('근처'))) {
    return { intent: 'navigate', place_type: '식당', condition: 'nearest' };
  }
  if (text.includes('식당')) {
    return { intent: 'navigate', place_type: '식당' };
  }

  return { intent: 'navigate' };
}
