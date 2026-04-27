import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { CampusPlace } from '../types/place';
import { fetchCampusPlaces } from '../services/placeService';
import { BASE_URL } from '../constants';

const MAP_URI = `${BASE_URL}/map`;

export default function MapScreen() {
  const webviewRef = useRef<WebView>(null);

  const [places, setPlaces]           = useState<CampusPlace[]>([]);
  const [userInput, setUserInput]     = useState('');
  const [selectedPlace, setSelectedPlace] = useState<CampusPlace | null>(null);
  const [loading, setLoading]         = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapError, setMapError]       = useState<string | null>(null);

  const locationSub = useRef<Location.LocationSubscription | null>(null);

  // ── 장소 데이터 로드 ──
  useEffect(() => {
    fetchCampusPlaces().then(setPlaces);
  }, []);

  // ── GPS 권한 요청 + 실시간 위치 추적 시작 ──
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한 필요', '네비게이션을 사용하려면 위치 권한이 필요합니다.');
        return;
      }

      locationSub.current = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.High,
          timeInterval:     2000,
          distanceInterval: 3,
        },
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
    };
  }, []);

  // ── AI 안내 요청 ──
  async function handleNavigate() {
    if (!userInput.trim()) return;
    setLoading(true);
    try {
      // 현재 위치 가져오기
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;

      // 백엔드 /navigate 호출 (Gemini 목적지 추출 + 카카오 경로 계산)
      const res = await fetch(`${BASE_URL}/navigate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: userInput, lat: latitude, lng: longitude }),
      });
      const data = await res.json();

      if (data.error) {
        Alert.alert('안내 실패', data.error);
        return;
      }

      setSelectedPlace(data.destination);
      setIsNavigating(true);

      // WebView에 경로 그리기 명령
      webviewRef.current?.postMessage(
        JSON.stringify({
          type:        'DRAW_ROUTE',
          route:       data.route,
          destination: data.destination,
        })
      );
    } catch (e) {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  // ── 안내 종료 ──
  function stopNavigation() {
    setIsNavigating(false);
    setSelectedPlace(null);
    webviewRef.current?.postMessage(JSON.stringify({ type: 'CLEAR_ROUTE' }));
  }

  // ── 빠른 선택 버튼 (테스트용) ──
  function quickMove(name: string) {
    const place = places.find(p => p.place_name === name);
    if (place) {
      setSelectedPlace(place);
      webviewRef.current?.postMessage(
        JSON.stringify({ type: 'MOVE_TO', lat: place.lat, lng: place.lng })
      );
    }
  }

  // ── WebView → RN 메시지 수신 ──
  function onWebViewMessage(event: { nativeEvent: { data: string } }) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MARKER_CLICK') setSelectedPlace(data.place);
    } catch (_) {}
  }

  return (
    <View style={styles.container}>
      {/* ── 검색창 ── */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="예: 인쇄하는 곳으로 안내해줘"
          placeholderTextColor="#9ca3af"
          value={userInput}
          onChangeText={setUserInput}
          onSubmitEditing={handleNavigate}
          returnKeyType="search"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleNavigate}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnText}>안내</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── 빠른 선택 / 안내 종료 ── */}
      <View style={styles.quickRow}>
        {isNavigating ? (
          <TouchableOpacity style={styles.stopBtn} onPress={stopNavigation}>
            <Text style={styles.stopBtnText}>■ 안내 종료</Text>
          </TouchableOpacity>
        ) : (
          ['진리관', '도서관', '학생식당', '학생복지관'].map(name => (
            <TouchableOpacity key={name} style={styles.quickBtn} onPress={() => quickMove(name)}>
              <Text style={styles.quickBtnText}>{name}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* ── 카카오맵 WebView ── */}
      <WebView
        ref={webviewRef}
        style={styles.map}
        source={{ uri: MAP_URI }}
        onError={e => setMapError(e.nativeEvent.description)}
        onMessage={onWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
      />

      {/* ── 에러 배너 ── */}
      {mapError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>지도 오류: {mapError}</Text>
        </View>
      )}

      {/* ── 선택 장소 카드 ── */}
      {selectedPlace && !isNavigating && (
        <View style={styles.placeCard}>
          <Text style={styles.placeName}>{selectedPlace.place_name}</Text>
          <Text style={styles.placeDesc}>{selectedPlace.description}</Text>
          <Text style={styles.placeTags}>{selectedPlace.services.join(' · ')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  searchBox: {
    flexDirection: 'row', padding: 12, gap: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  input: {
    flex: 1, height: 44, backgroundColor: '#f3f4f6',
    borderRadius: 8, paddingHorizontal: 12, fontSize: 14, color: '#111827',
  },
  btn: {
    width: 60, height: 44, backgroundColor: '#2563eb',
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: '#93c5fd' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  quickRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  quickBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#eff6ff', borderRadius: 6,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  quickBtnText: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },

  stopBtn: {
    flex: 1, paddingVertical: 8, backgroundColor: '#ef4444',
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  map: { flex: 1 },

  errorBanner: {
    backgroundColor: '#fef2f2', padding: 10,
    borderTopWidth: 1, borderTopColor: '#fca5a5',
  },
  errorText: { fontSize: 12, color: '#dc2626' },

  placeCard: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  placeName: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 4 },
  placeDesc: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  placeTags: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
});
