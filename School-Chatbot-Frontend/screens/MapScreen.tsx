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
import { Ionicons } from '@expo/vector-icons';
import { CampusPlace } from '../types/place';
import { fetchCampusPlaces } from '../services/placeService';
import { BASE_URL } from '../constants';

const MAP_URI = `${BASE_URL}/map`;

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

  const locationSub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    fetchCampusPlaces().then(setPlaces);
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('위치 권한 필요', '네비게이션을 사용하려면 위치 권한이 필요합니다.');
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
    return () => { locationSub.current?.remove(); };
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
      if (data.error) { Alert.alert('안내 실패', data.error); return; }
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
      Alert.alert('오류', '서버 연결에 실패했습니다.');
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
      <View style={[s.searchBox, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={[s.searchInner, { backgroundColor: t.surface2 }]}>
          <Ionicons name="location-outline" size={18} color={t.blue}/>
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
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small"/>
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>길안내</Text>
          }
        </TouchableOpacity>
      </View>

      {/* 빠른 선택 / 안내 종료 */}
      <View style={[s.quickRow, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        {isNavigating ? (
          <TouchableOpacity style={[s.stopBtn, { backgroundColor: '#EF4444' }]} onPress={stopNavigation}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>■ 안내 종료</Text>
          </TouchableOpacity>
        ) : (
          ['진리관', '도서관', '학생식당', '학생복지관'].map(name => (
            <TouchableOpacity
              key={name}
              style={[s.quickBtn, { backgroundColor: t.blueSoft, borderColor: t.blue + '44' }]}
              onPress={() => quickMove(name)}
            >
              <Text style={{ fontSize: 12, color: t.blue, fontWeight: '600' }}>{name}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* 카카오맵 WebView */}
      <WebView
        ref={webviewRef}
        style={s.map}
        source={{ uri: MAP_URI }}
        onError={e => setMapError(e.nativeEvent.description)}
        onMessage={onWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
      />

      {/* 에러 배너 */}
      {mapError && (
        <View style={[s.errorBanner, { backgroundColor: '#FEF2F2', borderTopColor: '#FCA5A5' }]}>
          <Text style={{ fontSize: 12, color: '#DC2626' }}>지도 오류: {mapError}</Text>
        </View>
      )}

      {/* 선택 장소 카드 */}
      {selectedPlace && !isNavigating && (
        <View style={[s.placeCard, { backgroundColor: t.surface }]}>
          <Text style={[s.placeName, { color: t.text }]}>{selectedPlace.place_name}</Text>
          <Text style={[s.placeDesc, { color: t.textSoft }]}>{selectedPlace.description}</Text>
          <Text style={{ fontSize: 12, color: t.blue, fontWeight: '600', marginTop: 4 }}>
            {selectedPlace.services.join(' · ')}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  searchBox: {
    flexDirection: 'row', padding: 12, gap: 8,
    borderBottomWidth: 1,
  },
  searchInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    gap: 8, borderRadius: 14, paddingHorizontal: 12, height: 44,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  navBtn: {
    paddingHorizontal: 16, height: 44,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  quickRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    gap: 6, borderBottomWidth: 1,
  },
  quickBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  stopBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  map: { flex: 1 },
  errorBanner: { padding: 10, borderTopWidth: 1 },
  placeCard: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  placeName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  placeDesc: { fontSize: 13 },
});
