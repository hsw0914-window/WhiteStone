import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { API_URL } from './constants';
import ResponseCard from './components/ResponseCard';

export default function App() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState(null); // 성공 응답
  const [error, setError] = useState(null);        // 에러 메시지
  const [loading, setLoading] = useState(false);

  // ── API 호출 ────────────────────────────────────────────────────────────────
  async function handleSend() {
    // 빈 입력 검사
    if (!question.trim()) {
      Alert.alert('입력 오류', '질문을 입력해주세요.');
      return;
    }

    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!res.ok) {
        // 422 등 HTTP 에러 처리
        const errBody = await res.json().catch(() => null);
        const detail =
          errBody?.detail?.[0]?.msg ?? errBody?.detail ?? `HTTP ${res.status}`;
        setError(`서버 오류: ${detail}`);
        return;
      }

      const data = await res.json();
      setResponse(data);
    } catch (e) {
      // 네트워크 연결 실패 등
      setError(
        '백엔드 서버에 연결할 수 없습니다.\n' +
          '서버가 실행 중인지, API_URL이 올바른지 확인해주세요.\n\n' +
          `(constants.js 의 API_URL: ${API_URL})`
      );
    } finally {
      setLoading(false);
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    // KeyboardAvoidingView: 키보드가 올라올 때 레이아웃이 밀리지 않도록 처리
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled" // 스크롤 중 탭해도 키보드 닫힘 방지
      >
        <StatusBar style="auto" />

        {/* 앱 제목 */}
        <Text style={styles.title}>학교 안내 AI 챗봇 테스트</Text>
        <Text style={styles.subtitle}>질문을 입력하고 전송 버튼을 눌러주세요.</Text>

        {/* 입력 영역 */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="예: 수강신청 기간 언제예요?"
            placeholderTextColor="#9ca3af"
            value={question}
            onChangeText={setQuestion}
            onSubmitEditing={handleSend}   // 키보드 확인 버튼으로도 전송
            returnKeyType="send"
            editable={!loading}
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              // 로딩 중: 버튼 안에 스피너 표시
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>전송</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 로딩 안내 텍스트 */}
        {loading && (
          <Text style={styles.loadingText}>백엔드에 요청 중입니다...</Text>
        )}

        {/* 응답 카드 (성공 또는 에러) */}
        <ResponseCard data={response} error={error} />

        {/* 하단 여백 */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── 스타일 ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },

  // 입력창 + 버튼을 한 줄로
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    // 그림자
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  button: {
    width: 64,
    height: 48,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },

  bottomPadding: {
    height: 40,
  },
});
