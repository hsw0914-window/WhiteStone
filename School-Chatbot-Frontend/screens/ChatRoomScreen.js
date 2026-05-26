import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mascot from '../components/Mascot';
import ProfileMenuButton from '../components/ProfileMenuButton';
import { formatTime } from '../utils/formatTime';

const QUICK_GRID = [
  { emoji: '📅', title: '학사일정', subtitle: '수강·정정', question: '백석대학교 수강신청 및 수강정정 일정을 알려줘.' },
  { emoji: '📚', title: '수강신청', subtitle: '2025-1학기', question: '백석대학교 2025-1학기 수강신청 안내에 대해 자세히 알려줘.' },
  { emoji: '💰', title: '등록금', subtitle: '납부 안내', question: '백석대학교 2026-1학기 등록금 세부안내에 대해 자세히 알려줘.' },
  { emoji: '🏠', title: '기숙사', subtitle: '입퇴사', question: '백석대학교 기숙사 입/퇴사 안내 및 입주절차에 대해 자세히 알려줘.' },
  { emoji: '🚌', title: '셔틀버스', subtitle: '시간표', question: '백석대학교 2026-1학기 통학버스 및 셔틀버스 시간표 안내에 대해 자세히 알려줘.' },
  { emoji: '📖', title: '도서관', subtitle: '이용방법', question: '백석대학교 도서관 이용방법에 대해 자세히 알려줘.' },
  { emoji: '🎓', title: '장학금', subtitle: '지급 방식', question: '백석대학교 장학금은 어떻게 지급돼? 학비감면이야?' },
  { emoji: '🙏', title: '채플', subtitle: '필수 여부', question: '백석대학교 채플(예배)은 필수야? 안 들으면 어떻게 돼?' },
  { emoji: '🧾', title: '증명서', subtitle: '발급 위치', question: '백석대학교 교내 증명서 무인발급기(자동발급기) 위치랑 이용 시간 알려줘.' },
];

export default function ChatRoomScreen({ t, session, onBack, onSend, loading, user, onMyPage, onSettings, onLogout }) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const flatRef = useRef(null);
  const messages = session?.messages || [];
  const initialBotMessage = isNewChat(messages) ? messages[0] : null;
  const listMessages = initialBotMessage ? messages.slice(1) : messages;

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
        <ProfileMenuButton t={t} user={user} onMyPage={onMyPage} onSettings={onSettings} onLogout={onLogout} />
      </View>

      {/* 메시지 목록 */}
      <FlatList
        ref={flatRef}
        data={listMessages}
        keyExtractor={(_, i) => String(i)}
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={{ padding: 14, paddingBottom: Math.max(insets.bottom, 18) + 18 }}
        ListHeaderComponent={
          isNew ? (
            <>
              {initialBotMessage && <Bubble t={t} m={initialBotMessage} />}

              {/* 빠른 질문 3×3 그리드 */}
              <View style={s.quickHead}>
                <Text style={s.quickHeadIcon}>💡</Text>
                <Text style={[s.quickHeadText, { color: t.textSoft }]}>자주 묻는 질문</Text>
              </View>
              <View style={s.gridWrap}>
                {[0, 1, 2].map(row => (
                  <View key={row} style={s.gridRow}>
                    {QUICK_GRID.slice(row * 3, row * 3 + 3).map(item => (
                      <TouchableOpacity
                        key={item.title}
                        disabled={loading}
                        onPress={() => onSend(item.question)}
                        style={[s.gridItem, { backgroundColor: t.surface, borderColor: t.borderSoft }]}
                        activeOpacity={0.7}
                      >
                        <View style={[s.gridEmojiWrap, { backgroundColor: t.blueSoft }]}>
                          <Text style={s.gridEmoji}>{item.emoji}</Text>
                        </View>
                        <Text style={[s.gridTitle, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[s.gridSub, { color: t.textSoft }]} numberOfLines={1}>{item.subtitle}</Text>
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
      <View
        style={[
          s.inputArea,
          {
            backgroundColor: t.surface,
            borderTopColor: t.borderSoft,
            paddingBottom: Math.max(insets.bottom, 20) + 8,
          },
        ]}
      >
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

function isNewChat(messages) {
  return messages.length === 1 && messages[0]?.role === 'bot';
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
  quickHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingTop: 2,
    paddingBottom: 8,
  },
  quickHeadIcon: { fontSize: 13 },
  quickHeadText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  gridWrap: { marginBottom: 10, gap: 8 },
  gridRow: { flexDirection: 'row', gap: 8 },
  gridItem: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  gridEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  gridEmoji: { fontSize: 19 },
  gridTitle: { fontSize: 11.5, fontWeight: '800', textAlign: 'center', lineHeight: 15 },
  gridSub: { fontSize: 10.5, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  bubbleWrap: { marginVertical: 6, alignItems: 'flex-end' },
  bubble: { padding: 12, borderRadius: 18, borderWidth: 1 },
  inputArea: { paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 1 },
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
