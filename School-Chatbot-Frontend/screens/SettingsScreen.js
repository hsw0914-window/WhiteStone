import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen({ t, dark, onToggleDark, onLogout, user }) {
  const initial = (user?.name || '?')[0];
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <Text style={[s.headerTitle, { color: t.text }]}>설정</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* 프로필 카드 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={[s.profileCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
            <View style={[s.avatar, { backgroundColor: t.blue }]}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.profileName, { color: t.text }]}>{user?.name || '사용자'}</Text>
              <Text style={[s.profileEmail, { color: t.textSoft }]} numberOfLines={1}>
                {user?.email || ''}
              </Text>
            </View>
          </View>
        </View>

        {/* 화면 */}
        <SectionTitle t={t}>화면</SectionTitle>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[s.group, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
            <Row t={t} icon="sunny-outline" label="다크 모드" last
              right={
                <Switch
                  value={dark}
                  onValueChange={onToggleDark}
                  trackColor={{ true: t.blue, false: t.border }}
                  thumbColor="#fff"
                />
              }
            />
          </View>
        </View>

        {/* 앱 정보 */}
        <SectionTitle t={t}>앱 정보</SectionTitle>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[s.group, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
            <Row t={t} icon="information-circle-outline" label="버전"
              right={<Text style={{ color: t.textSoft, fontSize: 13 }}>1.0.0 β</Text>}
            />
            <Row t={t} icon="globe-outline" label="백석대학교 공식 홈페이지" chevron last
              onPress={() => Linking.openURL('https://www.bu.ac.kr/web/index.do')}
            />
          </View>
        </View>

        {/* 계정 */}
        <SectionTitle t={t}>계정</SectionTitle>
        <View style={{ paddingHorizontal: 16 }}>
          <View style={[s.group, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
            <Row t={t} icon="log-out-outline" label="로그아웃" danger onPress={onLogout} last/>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ t, children }) {
  return (
    <Text style={{
      color: t.textMute, fontSize: 12, fontWeight: '700',
      letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6,
    }}>
      {children}
    </Text>
  );
}

function Row({ t, icon, label, right, danger, onPress, chevron, last }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: t.borderSoft }]}
    >
      <View style={[s.rowIcon, { backgroundColor: danger ? '#FEE2E2' : t.blueSoft }]}>
        <Ionicons name={icon} size={18} color={danger ? '#EF4444' : t.blue}/>
      </View>
      <Text style={[s.rowLabel, { color: danger ? '#EF4444' : t.text }]}>{label}</Text>
      {right}
      {chevron && <Ionicons name="chevron-forward" size={18} color={t.textMute}/>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, borderRadius: 18, borderWidth: 1, padding: 18,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  profileName: { fontSize: 16, fontWeight: '800' },
  profileEmail: { fontSize: 13, marginTop: 2 },
  group: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowLabel: { flex: 1, fontSize: 14.5, fontWeight: '600' },
});
