import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { CampusPlace } from '../types/place';
import { fetchCampusPlaces } from '../services/placeService';
import { BASE_URL } from '../constants';

const MAP_URI = `${BASE_URL}/map`;
const STEP_COMPLETE_RADIUS_M = 22;
const ARRIVAL_RADIUS_M = 25;

const QUICK_PLACES = [
  { name: '진리관', icon: 'business-outline' },
  { name: '도서관', icon: 'library-outline' },
  { name: '학생식당', icon: 'restaurant-outline' },
  { name: '학생복지관', icon: 'people-outline' },
] as const;

type Tokens = {
  bg: string; surface: string; surface2: string;
  text: string; textSoft: string; textMute: string;
  border: string; borderSoft: string;
  blue: string; blueSoft: string; blueDark: string;
};

type LatLng = { lat: number; lng: number };

type RouteStep = {
  direction: string;
  distance: number;
  lat: number | null;
  lng: number | null;
};

type NavigationState = {
  destination: CampusPlace;
  steps: RouteStep[];
  activeStepIndex: number;
  totalDistance: number;
  duration: number;
  remainingDistance: number;
  arrived: boolean;
};

function distanceMeters(a: LatLng, b: LatLng) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(value: number) {
  if (!Number.isFinite(value)) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}km`;
  return `${Math.max(0, Math.round(value))}m`;
}

function nextActiveStepIndex(current: LatLng, steps: RouteStep[], startIndex: number) {
  let index = startIndex;
  while (index < steps.length) {
    const step = steps[index];
    if (step.lat == null || step.lng == null) {
      index += 1;
      continue;
    }
    const distance = distanceMeters(current, { lat: step.lat, lng: step.lng });
    if (distance <= STEP_COMPLETE_RADIUS_M) {
      index += 1;
      continue;
    }
    break;
  }
  return index;
}

export default function MapScreen({ t }: { t: Tokens }) {
  const webviewRef = useRef<WebView>(null);

  const [places, setPlaces] = useState<CampusPlace[]>([]);
  const [userInput, setUserInput] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<CampusPlace | null>(null);
  const [navigation, setNavigation] = useState<NavigationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationRef = useRef<NavigationState | null>(null);
  const followUserRef = useRef(true);

  const isNavigating = !!navigation && !navigation.arrived;

  const remainingSteps = useMemo(() => {
    if (!navigation) return [];
    return navigation.steps.slice(Math.min(navigation.activeStepIndex, navigation.steps.length));
  }, [navigation]);

  function postToMap(payload: Record<string, unknown>) {
    webviewRef.current?.postMessage(JSON.stringify(payload));
  }

  function showToast(message: string, tone: 'info' | 'error' = 'info') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    fetchCampusPlaces().then(setPlaces);
  }, []);

  useEffect(() => {
    navigationRef.current = navigation;
  }, [navigation]);

  useEffect(() => {
    followUserRef.current = followUser;
    postToMap({ type: 'FOLLOW_USER', enabled: followUser });
  }, [followUser]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('내비게이션을 사용하려면 위치 권한이 필요해요.', 'error');
        return;
      }

      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1500,
          distanceInterval: 3,
        },
        (loc) => {
          const current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          postToMap({
            type: 'UPDATE_LOCATION',
            lat: current.lat,
            lng: current.lng,
            follow: followUserRef.current,
          });
          updateNavigationProgress(current);
        }
      );
    })();

    return () => {
      locationSub.current?.remove();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function updateNavigationProgress(current: LatLng) {
    const state = navigationRef.current;
    if (!state || state.arrived) return;

    const destinationDistance = distanceMeters(current, {
      lat: state.destination.lat,
      lng: state.destination.lng,
    });

    if (destinationDistance <= ARRIVAL_RADIUS_M) {
      const arrivedState = {
        ...state,
        activeStepIndex: state.steps.length,
        remainingDistance: 0,
        arrived: true,
      };
      navigationRef.current = arrivedState;
      setNavigation(arrivedState);
      setFollowUser(true);
      postToMap({ type: 'ARRIVE_DESTINATION' });
      showToast('목적지에 도착했어요.', 'info');
      return;
    }

    const nextIndex = nextActiveStepIndex(current, state.steps, state.activeStepIndex);
    if (nextIndex !== state.activeStepIndex || Math.abs(destinationDistance - state.remainingDistance) >= 2) {
      const nextState = {
        ...state,
        activeStepIndex: nextIndex,
        remainingDistance: destinationDistance,
      };
      navigationRef.current = nextState;
      setNavigation(nextState);
      postToMap({
        type: 'NAV_PROGRESS',
        activeStepIndex: nextIndex,
        remainingDistance: Math.round(destinationDistance),
      });
    }
  }

  async function handleNavigate() {
    if (!userInput.trim()) return;
    setLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      const res = await fetch(`${BASE_URL}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userInput, lat: current.lat, lng: current.lng }),
      });
      const data = await res.json();
      if (data.error) {
        showToast(data.error, 'error');
        return;
      }

      const steps = (data.steps || []) as RouteStep[];
      const initialStepIndex = nextActiveStepIndex(current, steps, 0);
      const destinationDistance = distanceMeters(current, {
        lat: data.destination.lat,
        lng: data.destination.lng,
      });
      const nextNavigation: NavigationState = {
        destination: data.destination,
        steps,
        activeStepIndex: initialStepIndex,
        totalDistance: data.distance || 0,
        duration: data.duration || 0,
        remainingDistance: destinationDistance,
        arrived: destinationDistance <= ARRIVAL_RADIUS_M,
      };

      setSelectedPlace(data.destination);
      setNavigation(nextNavigation);
      navigationRef.current = nextNavigation;
      setFollowUser(true);
      postToMap({
        type: 'DRAW_ROUTE',
        route: data.route,
        destination: data.destination,
        steps,
        distance: data.distance,
        duration: data.duration,
        activeStepIndex: initialStepIndex,
        remainingDistance: Math.round(destinationDistance),
        follow: true,
      });

      if (nextNavigation.arrived) {
        postToMap({ type: 'ARRIVE_DESTINATION' });
        showToast('목적지에 도착했어요.', 'info');
      }
    } catch {
      showToast('서버 연결에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function stopNavigation() {
    setNavigation(null);
    navigationRef.current = null;
    setSelectedPlace(null);
    setFollowUser(true);
    postToMap({ type: 'CLEAR_ROUTE' });
  }

  function quickMove(name: string) {
    const place = places.find(p => p.place_name === name);
    if (place) {
      setUserInput(name);
      setSelectedPlace(place);
      postToMap({ type: 'MOVE_TO', lat: place.lat, lng: place.lng });
    }
  }

  function recenterUser() {
    setFollowUser(true);
    postToMap({ type: 'FOLLOW_USER', enabled: true, recenter: true });
  }

  function onWebViewMessage(event: { nativeEvent: { data: string } }) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MARKER_CLICK') setSelectedPlace(data.place);
      if (data.type === 'USER_DRAGGED_MAP') setFollowUser(false);
    } catch (_) {}
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <View style={[s.headerRow, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]}>캠퍼스 지도</Text>
          <Text style={{ color: t.textSoft, fontSize: 12.5, marginTop: 1 }}>백석대학교</Text>
        </View>
      </View>

      <View style={[s.panel, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={s.searchRow}>
          <View style={[s.searchInner, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}>
            <View style={[s.searchIcon, { backgroundColor: t.blueSoft }]}>
              <Ionicons name="location-outline" size={17} color={t.blue}/>
            </View>
            <TextInput
              style={[s.input, { color: t.text }]}
              placeholder="어디로 갈까요? (예: 본부동, 도서관)"
              placeholderTextColor={t.textMute}
              value={userInput}
              onChangeText={setUserInput}
              onSubmitEditing={handleNavigate}
              returnKeyType="search"
              editable={!loading}
            />
          </View>
          <TouchableOpacity
            style={[s.navBtn, { backgroundColor: userInput.trim() && !loading ? t.blue : t.border }]}
            onPress={handleNavigate}
            disabled={loading || !userInput.trim()}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small"/>
            ) : (
              <>
                <Ionicons name="navigate-outline" size={15} color="#fff" />
                <Text style={s.navBtnText}>경로 안내</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {navigation ? (
          <View style={[s.navState, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}>
            <View style={[s.navStateIcon, { backgroundColor: navigation.arrived ? '#DCFCE7' : t.blueSoft }]}>
              <Ionicons
                name={navigation.arrived ? 'checkmark-circle-outline' : 'navigate-outline'}
                size={16}
                color={navigation.arrived ? '#16A34A' : t.blue}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.navStateTitle, { color: t.text }]} numberOfLines={1}>
                {navigation.arrived ? '도착했습니다' : `${navigation.destination.place_name} 안내 중`}
              </Text>
              <Text style={[s.navStateSub, { color: t.textSoft }]} numberOfLines={1}>
                {navigation.arrived
                  ? '안내가 자동으로 종료되었어요.'
                  : `남은 거리 ${formatDistance(navigation.remainingDistance)} · 남은 단계 ${remainingSteps.length}개`}
              </Text>
            </View>
            {!navigation.arrived && (
              <TouchableOpacity style={[s.followBtn, { backgroundColor: followUser ? t.blue : t.surface }]} onPress={recenterUser} activeOpacity={0.85}>
                <Ionicons name="locate-outline" size={15} color={followUser ? '#fff' : t.blue} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.stopBtn} onPress={stopNavigation} activeOpacity={0.85}>
              <Text style={s.stopText}>{navigation.arrived ? '닫기' : '종료'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.quickRow}>
            {QUICK_PLACES.map(place => (
              <TouchableOpacity
                key={place.name}
                style={[s.quickBtn, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}
                onPress={() => quickMove(place.name)}
                activeOpacity={0.75}
              >
                <Ionicons name={place.icon as any} size={14} color={t.blue} />
                <Text style={[s.quickText, { color: t.text }]}>{place.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <WebView
        ref={webviewRef}
        style={s.map}
        source={{ uri: MAP_URI }}
        onError={e => {
          setMapError(e.nativeEvent.description);
          showToast(`지도 오류: ${e.nativeEvent.description}`, 'error');
        }}
        onMessage={onWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
      />

      {mapError && (
        <View style={[s.errorBanner, { backgroundColor: '#FEF2F2', borderTopColor: '#FCA5A5' }]}>
          <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
          <Text style={s.errorText}>지도 오류: {mapError}</Text>
        </View>
      )}

      {selectedPlace && !navigation && (
        <View style={[s.placeCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
          <View style={s.placeHead}>
            <View style={[s.placeIcon, { backgroundColor: t.blueSoft }]}>
              <Ionicons name="business-outline" size={18} color={t.blue} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.placeName, { color: t.text }]} numberOfLines={1}>{selectedPlace.place_name}</Text>
              <Text style={[s.placeDesc, { color: t.textSoft }]} numberOfLines={2}>{selectedPlace.description}</Text>
            </View>
          </View>
          {!!selectedPlace.services?.length && (
            <View style={s.serviceWrap}>
              {selectedPlace.services.slice(0, 4).map(service => (
                <View key={service} style={[s.serviceChip, { backgroundColor: t.blueSoft }]}>
                  <Text style={[s.serviceText, { color: t.blue }]} numberOfLines={1}>{service}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {!!toast && (
        <View
          pointerEvents="none"
          style={[
            s.toast,
            {
              backgroundColor: toast.tone === 'error' ? '#EF4444' : t.surface,
              borderColor: toast.tone === 'error' ? '#EF4444' : t.borderSoft,
            },
          ]}
        >
          <Ionicons
            name={toast.tone === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}
            size={17}
            color={toast.tone === 'error' ? '#fff' : t.blue}
          />
          <Text style={[s.toastText, { color: toast.tone === 'error' ? '#fff' : t.text }]}>
            {toast.message}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0 },
  panel: { padding: 12, gap: 10, borderBottomWidth: 1 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: 8, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, height: 46,
  },
  searchIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 14, paddingVertical: 0, fontWeight: '600' },
  navBtn: {
    minWidth: 92, paddingHorizontal: 12, height: 46,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 5,
  },
  navBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0 },
  quickRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
  },
  quickBtn: {
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  quickText: { fontSize: 12, fontWeight: '800', letterSpacing: 0 },
  navState: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  navStateIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  navStateTitle: { fontSize: 13.5, fontWeight: '900', letterSpacing: 0 },
  navStateSub: { fontSize: 11.5, fontWeight: '600', marginTop: 1, letterSpacing: 0 },
  followBtn: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(37,99,235,0.25)',
  },
  stopBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  stopText: { color: '#fff', fontWeight: '900', fontSize: 12.5, letterSpacing: 0 },
  map: { flex: 1 },
  errorBanner: { padding: 10, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { flex: 1, fontSize: 12, color: '#DC2626', fontWeight: '700' },
  placeCard: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    borderRadius: 8, borderWidth: 1, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
  },
  placeHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  placeIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 15.5, fontWeight: '900', marginBottom: 3, letterSpacing: 0 },
  placeDesc: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', letterSpacing: 0 },
  serviceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  serviceChip: { maxWidth: '48%', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  serviceText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0 },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 96,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toastText: { flexShrink: 1, fontSize: 12.5, fontWeight: '800', letterSpacing: 0, textAlign: 'center' },
});
