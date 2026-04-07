import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';

/**
 * 백엔드 응답 결과를 카드 형태로 보여주는 컴포넌트.
 *
 * props:
 *   data  - /chat API 응답 객체 (null이면 렌더링 안 함)
 *   error - 에러 메시지 문자열 (null이면 렌더링 안 함)
 */
export default function ResponseCard({ data, error }) {
  // 에러 상태
  if (error) {
    return (
      <View style={[styles.card, styles.errorCard]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // 응답 없음
  if (!data) return null;

  const confidencePercent = (data.confidence * 100).toFixed(1);

  return (
    <View style={styles.card}>
      {/* 카테고리 뱃지 */}
      <View style={styles.row}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{data.category}</Text>
        </View>
        <Text style={styles.confidence}>신뢰도 {confidencePercent}%</Text>
      </View>

      <Divider />

      {/* 내 질문 */}
      <Label text="내 질문" />
      <Text style={styles.value}>{data.question}</Text>

      <Divider />

      {/* 매칭된 질문 */}
      <Label text="매칭된 질문" />
      <Text style={styles.value}>
        {data.matched_question ?? '매칭된 질문 없음'}
      </Text>

      <Divider />

      {/* 답변 */}
      <Label text="답변" />
      <Text style={[styles.value, styles.answer]}>{data.answer}</Text>

      {/* 관련 URL */}
      {data.related_url ? (
        <>
          <Divider />
          <Label text="관련 링크" />
          <TouchableOpacity onPress={() => Linking.openURL(data.related_url)}>
            <Text style={styles.link}>{data.related_url}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {/* 출처 */}
      <Text style={styles.source}>출처: {data.source}</Text>
    </View>
  );
}

// ── 작은 헬퍼 컴포넌트 ──────────────────────────────────────────────────────
function Label({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

// ── 스타일 ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    // 그림자 (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    // 그림자 (Android)
    elevation: 3,
  },
  errorCard: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  confidence: {
    fontSize: 13,
    color: '#6b7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
  },
  answer: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 23,
    fontWeight: '500',
  },
  link: {
    fontSize: 13,
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  source: {
    marginTop: 16,
    fontSize: 11,
    color: '#d1d5db',
    textAlign: 'right',
  },
});
