import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ITEMS = [
  '📋 공지사항 바로가기',
  '🗓 학사일정 캘린더',
  '🏛 동아리 정보',
  '📊 성적 조회 바로가기',
];

export default function TBDScreen({ t }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <Text style={[s.headerTitle, { color: t.text }]}>탐색</Text>
        <Text style={{ color: t.textSoft, fontSize: 12.5, marginTop: 1 }}>준비 중</Text>
      </View>

      <View style={s.content}>
        <View style={[s.iconWrap, { backgroundColor: t.blueSoft }]}>
          <Ionicons name="compass-outline" size={40} color={t.blue}/>
        </View>
        <Text style={[s.title, { color: t.text }]}>준비 중입니다</Text>
        <Text style={[s.sub, { color: t.textSoft }]}>
          더 유용한 기능을 준비하고 있어요.{'\n'}조금만 기다려 주세요!
        </Text>
        <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
          {ITEMS.map((item, i) => (
            <Text key={i} style={[s.cardItem, { color: t.textSoft }]}>{item}</Text>
          ))}
          <Text style={[s.cardNote, { color: t.textMute }]}>— 곧 추가될 예정이에요</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  card: {
    marginTop: 28, padding: 16, borderRadius: 14, borderWidth: 1,
    width: '100%', gap: 10,
  },
  cardItem: { fontSize: 13.5, fontWeight: '600' },
  cardNote: { fontSize: 11, marginTop: 4 },
});
