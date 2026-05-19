import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mascot from '../components/Mascot';
import { formatTime } from '../utils/formatTime';

const QUICK_GRID = [
  { emoji: '📚', label: '도서관\n이용시간',    question: '도서관 이용시간 알려줘' },
  { emoji: '🚌', label: '셔틀버스\n시간표',    question: '셔틀버스 시간표 알려줘' },
  { emoji: '📅', label: '수강신청\n일정',      question: '수강신청 일정 알려줘' },
  { emoji: '🏠', label: '기숙사\n입사 안내',   question: '기숙사 입사 방법 알려줘' },
  { emoji: '📶', label: '교내\nWi-Fi 연결',   question: '교내 Wi-Fi 연결 방법 알려줘' },
  { emoji: '💰', label: '등록금\n납부 기간',   question: '등록금 납부 기간 알려줘' },
  { emoji: '🎓', label: '졸업\n이수학점',      question: '졸업 최저 이수학점 알려줘' },
  { emoji: '🍽️', label: '학내 식당\n위치 안내', question: '학내 식당 위치 안내해줘' },
  { emoji: '🎯', label: '비교과\n프로그램',    question: '비교과 프로그램 목록 알려줘' },
];

export default function ChatRoomScreen({ t, session, onBack, onSend, loading }) {
  const [input, setInput] = useState('');
  const flatRef = useRef(null);
  const messages = session?.messages || [];

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const submit = () => {
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput('');
  };

  const isNew = messages.length <= 1;

  return (
    <View style={{ flex: 1 }}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={t.text}/>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]} numberOfLines={1}>
            {session?.title || '대화'}
          </Text>
          <Text style={{ color: t.textSoft, fontSize: 11.5 }}>흰돌이 · 백석대학교 챗봇</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={22} color={t.textSoft}/>
      </View>

      {/* 메시지 목록 */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
        ListHeaderComponent={
          isNew ? (
            <>
              {/* 인트로 카드 */}
              <View style={[s.intro, { backgroundColor: t.blue }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Mascot size={36} t={t}/>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' }}>
                    백석대학교 AI 챗봇
                  </Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28 }}>
                  안녕하세요!{'\n'}흰돌이가 도와드릴게요.
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13.5, marginTop: 8, lineHeight: 21 }}>
                  학사일정, 시설, 학식, 수강신청까지{'\n'}무엇이든 물어보세요.
                </Text>
              </View>

              {/* 빠른 질문 3×3 그리드 */}
              <View style={s.gridWrap}>
                {[0, 1, 2].map(row => (
                  <View key={row} style={s.gridRow}>
                    {QUICK_GRID.slice(row * 3, row * 3 + 3).map(item => (
                      <TouchableOpacity
                        key={item.label}
                        disabled={loading}
                        onPress={() => onSend(item.question)}
                        style={[s.gridItem, { backgroundColor: t.surface, borderColor: t.borderSoft }]}
                        activeOpacity={0.7}
                      >
                        <Text style={s.gridEmoji}>{item.emoji}</Text>
                        <Text style={[s.gridLabel, { color: t.text }]}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            </>
          ) : null
        }
        renderItem={({ item }) => <Bubble key={item} t={t} m={item}/>}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
      />

      {/* 입력 영역 */}
      <View style={[s.inputArea, { backgroundColor: t.surface, borderTopColor: t.borderSoft }]}>
        <View style={[s.inputRow, { backgroundColor: t.surface2 }]}>
          <TextInput
            style={[s.input, { color: t.text }]}
            placeholder="흰돌이에게 메시지 보내기"
            placeholderTextColor={t.textMute}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={submit}
            multiline
            maxHeight={120}
            returnKeyType="send"
            submitBehavior="submit"
          />
          <TouchableOpacity
            onPress={submit}
            disabled={!input.trim() || loading}
            style={[s.sendBtn, { backgroundColor: input.trim() && !loading ? t.blue : t.border }]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff"/>
              : <Ionicons name="send" size={16} color="#fff"/>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Bubble({ t, m }) {
  const isMe = m.role === 'user';
  return (
    <View style={[s.bubbleWrap, { flexDirection: isMe ? 'row-reverse' : 'row' }]}>
      {!isMe && <Mascot size={32} t={t}/>}
      <View style={{
        maxWidth: '76%',
        alignItems: isMe ? 'flex-end' : 'flex-start',
        marginHorizontal: 6,
      }}>
        <View style={[s.bubble, {
          backgroundColor: isMe ? t.blue : t.surface,
          borderColor: isMe ? 'transparent' : t.borderSoft,
          borderBottomRightRadius: isMe ? 4 : 18,
          borderBottomLeftRadius: isMe ? 18 : 4,
        }]}>
          {m.typing
            ? <Text style={{ color: t.textSoft, fontSize: 18, letterSpacing: 2 }}>•••</Text>
            : <Text style={{ color: isMe ? '#fff' : t.text, fontSize: 14.5, lineHeight: 22 }}>{m.text}</Text>
          }
        </View>
        {m.time && !m.typing && (
          <Text style={{ fontSize: 11, color: t.textMute, marginTop: 3 }}>{formatTime(m.time)}</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  intro: { borderRadius: 20, padding: 20, marginBottom: 12 },
  gridWrap: { marginBottom: 10, gap: 8 },
  gridRow: { flexDirection: 'row', gap: 8 },
  gridItem: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  gridEmoji: { fontSize: 22, marginBottom: 6 },
  gridLabel: { fontSize: 11.5, fontWeight: '600', textAlign: 'center', lineHeight: 16 },
  bubbleWrap: { marginVertical: 6, alignItems: 'flex-end' },
  bubble: { padding: 12, borderRadius: 18, borderWidth: 1 },
  inputArea: { padding: 10, paddingBottom: 14, borderTopWidth: 1 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 24, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8,
  },
  input: { flex: 1, fontSize: 14.5, maxHeight: 120, paddingVertical: 4 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});
