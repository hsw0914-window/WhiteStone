import React, { useEffect, useRef, useState } from 'react';
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

export default function MapScreen({ t }: { t: Tokens }) {
  const webviewRef = useRef<WebView>(null);

  const [places, setPlaces]               = useState<CampusPlace[]>([]);
  const [userInput, setUserInput]         = useState('');
  const [selectedPlace, setSelectedPlace] = useState<CampusPlace | null>(null);
  const [loading, setLoading]             = useState(false);
  const [isNavigating, setIsNavigating]   = useState(false);
  const [mapError, setMapError]           = useState<string | null>(null);
  const [toast, setToast]                 = useState<{ message: string; tone: 'info' | 'error' } | null>(null);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, tone: 'info' | 'error' = 'info') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    fetchCampusPlaces().then(setPlaces);
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('네비게이션을 사용하려면 위치 권한이 필요해요.', 'error');
        return;
      }
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          webviewRef.current?.postMessage(
            JSON.stringify({ type: 'UPDATE_LOCATION', lat: latitude, lng: longitude })
          );
        }
      );
    })();
    return () => {
      locationSub.current?.remove();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  async function handleNavigate() {
    if (!userInput.trim()) return;
    setLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      const res = await fetch(`${BASE_URL}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userInput, lat: latitude, lng: longitude }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      setSelectedPlace(data.destination);
      setIsNavigating(true);
      webviewRef.current?.postMessage(
        JSON.stringify({
          type: 'DRAW_ROUTE',
          route: data.route,
          destination: data.destination,
          steps: data.steps,
          distance: data.distance,
          duration: data.duration,
        })
      );
    } catch {
      showToast('서버 연결에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function stopNavigation() {
    setIsNavigating(false);
    setSelectedPlace(null);
    webviewRef.current?.postMessage(JSON.stringify({ type: 'CLEAR_ROUTE' }));
  }

  function quickMove(name: string) {
    const place = places.find(p => p.place_name === name);
    if (place) {
      setUserInput(name);
      setSelectedPlace(place);
      webviewRef.current?.postMessage(
        JSON.stringify({ type: 'MOVE_TO', lat: place.lat, lng: place.lng })
      );
    }
  }

  function onWebViewMessage(event: { nativeEvent: { data: string } }) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MARKER_CLICK') setSelectedPlace(data.place);
    } catch (_) {}
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      {/* 헤더 */}
      <View style={[s.headerRow, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]}>캠퍼스 지도</Text>
          <Text style={{ color: t.textSoft, fontSize: 12.5, marginTop: 1 }}>백석대학교</Text>
        </View>
      </View>

      {/* 검색창 */}
      <View style={[s.panel, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={s.searchRow}>
          <View style={[s.searchInner, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}>
            <View style={[s.searchIcon, { backgroundColor: t.blueSoft }]}>
              <Ionicons name="location-outline" size={17} color={t.blue}/>
            </View>
            <TextInput
              style={[s.input, { color: t.text }]}
              placeholder="어디로 갈까요? (예: 도서관, 학생식당)"
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

        {isNavigating ? (
          <View style={[s.navState, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}>
            <View style={[s.navStateIcon, { backgroundColor: t.blueSoft }]}>
              <Ionicons name="navigate-outline" size={16} color={t.blue} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.navStateTitle, { color: t.text }]} numberOfLines={1}>
                {selectedPlace?.place_name || '경로 안내 중'}
              </Text>
              <Text style={[s.navStateSub, { color: t.textSoft }]}>지도의 안내 패널을 확인해주세요.</Text>
            </View>
            <TouchableOpacity style={s.stopBtn} onPress={stopNavigation} activeOpacity={0.85}>
              <Text style={s.stopText}>종료</Text>
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

      {/* 카카오맵 WebView */}
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

      {/* 에러 배너 */}
      {mapError && (
        <View style={[s.errorBanner, { backgroundColor: '#FEF2F2', borderTopColor: '#FCA5A5' }]}>
          <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
          <Text style={s.errorText}>지도 오류: {mapError}</Text>
        </View>
      )}

      {/* 선택 장소 카드 */}
      {selectedPlace && !isNavigating && (
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
