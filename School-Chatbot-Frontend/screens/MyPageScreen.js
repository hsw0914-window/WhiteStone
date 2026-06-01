import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileMenuButton from '../components/ProfileMenuButton';

const MAJORS = [
  { id: '빅데이터', name: '빅데이터', desc: 'AI · 데이터 분석', icon: 'analytics-outline' },
  { id: '핀테크', name: '핀테크', desc: '금융 · 블록체인', icon: 'card-outline' },
  { id: 'IoT', name: 'IoT', desc: '센서 · 네트워크', icon: 'hardware-chip-outline' },
  { id: 'AR·VR', name: 'AR·VR', desc: '실감미디어 · XR', icon: 'cube-outline' },
];

export default function MyPageScreen({
  t, user, onBack, onSaveProfile, onMyPage, onSettings, onLogout,
}) {
  const insets = useSafeAreaInsets();
  const [major, setMajor] = useState(user?.major || '');
  const [grade, setGrade] = useState(user?.grade || 0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const canSave = !!major && !!grade;
  const dirty = major !== (user?.major || '') || grade !== (user?.grade || 0);
  const initial = (user?.name || '?')[0];
  const status = useMemo(() => {
    if (user?.major && user?.grade) return `첨단IT학부 · ${user.major}전공 · ${user.grade}학년`;
    return '전공/학년 미설정';
  }, [user?.major, user?.grade]);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSaveProfile?.(major, grade);
      setSaved(true);
      setToast({ message: '저장되었어요', tone: 'success' });
      setTimeout(() => setSaved(false), 1600);
      setTimeout(() => setToast(null), 1800);
    } catch (err) {
      setToast({ message: err.message || '전공과 학년을 저장하지 못했어요.', tone: 'error' });
      setTimeout(() => setToast(null), 2200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {!!toast && (
        <View style={s.toastWrap} pointerEvents="none">
          <View
            style={[
              s.toast,
              {
                backgroundColor: toast.tone === 'error' ? '#EF4444' : t.surface,
                borderColor: toast.tone === 'error' ? '#EF4444' : t.borderSoft,
              },
            ]}
          >
            <View style={[s.toastIcon, { backgroundColor: toast.tone === 'error' ? 'rgba(255,255,255,0.22)' : '#22C55E' }]}>
              <Ionicons name={toast.tone === 'error' ? 'alert-circle-outline' : 'checkmark'} size={14} color="#fff" />
            </View>
            <Text style={[s.toastText, { color: toast.tone === 'error' ? '#fff' : t.text }]}>{toast.message}</Text>
          </View>
        </View>
      )}

      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]}>마이페이지</Text>
        </View>
        <ProfileMenuButton
          t={t}
          user={user}
          onMyPage={onMyPage}
          onSettings={onSettings}
          onLogout={onLogout}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 24) + 124 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.profileCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
          <View style={[s.avatar, { backgroundColor: t.blueSoft }]}>
            <Text style={[s.avatarText, { color: t.blue }]}>{initial}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.name, { color: t.text }]} numberOfLines={1}>{user?.name || '백석학우'}</Text>
            <Text style={[s.email, { color: t.textSoft }]} numberOfLines={1}>{user?.email || 'student@bu.ac.kr'}</Text>
            <View style={[s.statusPill, { backgroundColor: user?.major ? t.blueSoft : t.surface2, borderColor: user?.major ? `${t.blue}44` : t.borderSoft }]}>
              <View style={[s.statusDot, { backgroundColor: user?.major ? t.blue : t.textMute }]} />
              <Text style={[s.statusText, { color: user?.major ? t.blue : t.textSoft }]} numberOfLines={1}>
                {status}
              </Text>
            </View>
          </View>
        </View>

        <SectionHead t={t} title="전공 선택" desc="로드맵 추천에 사용할 전공을 선택해주세요" />
        <View style={s.majorGrid}>
          {MAJORS.map(item => (
            <MajorCard
              key={item.id}
              t={t}
              item={item}
              selected={major === item.id}
              onPress={() => setMajor(item.id)}
            />
          ))}
        </View>

        <SectionHead t={t} title="학년 선택" desc="현재 학년을 선택해주세요" />
        <View style={s.gradeRow}>
          {[1, 2, 3, 4].map(item => (
            <TouchableOpacity
              key={item}
              onPress={() => setGrade(item)}
              activeOpacity={0.8}
              style={[
                s.gradeBtn,
                {
                  backgroundColor: grade === item ? t.blue : t.surface,
                  borderColor: grade === item ? t.blue : t.borderSoft,
                  shadowColor: grade === item ? t.blue : 'transparent',
                },
              ]}
            >
              <Text style={[s.gradeMeta, { color: grade === item ? 'rgba(255,255,255,0.82)' : t.textSoft }]}>YEAR</Text>
              <Text style={[s.gradeText, { color: grade === item ? '#fff' : t.text }]}>{item}학년</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[s.infoCard, { backgroundColor: t.blueSoft, borderColor: `${t.blue}22` }]}>
          <View style={[s.infoIcon, { backgroundColor: t.surface }]}>
            <Ionicons name="information-circle-outline" size={17} color={t.blue} />
          </View>
          <Text style={[s.infoText, { color: t.text }]}>
            선택한 전공과 학년은 로드맵 탭의 AI 과목 추천 화면에 사용돼요.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          s.bottom,
          {
            backgroundColor: t.surface,
            borderTopColor: t.borderSoft,
            paddingBottom: Math.max(insets.bottom, 20) + 10,
          },
        ]}
      >
        <TouchableOpacity
          onPress={save}
          disabled={saving || !canSave || (!dirty && !saved)}
          activeOpacity={0.85}
          style={[
            s.saveBtn,
            {
              backgroundColor: canSave && (dirty || saved) ? t.blue : t.surface2,
              borderColor: canSave && (dirty || saved) ? t.blue : t.border,
            },
          ]}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : saved && <Ionicons name="checkmark" size={18} color="#fff" />}
          <Text style={[s.saveText, { color: canSave && (dirty || saved) ? '#fff' : t.textMute }]}>
            {saving ? '저장 중' : saved ? '저장 완료' : canSave ? '저장하기' : '전공과 학년을 선택해주세요'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SectionHead({ t, title, desc }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.sectionTitle, { color: t.text }]}>{title}</Text>
      <Text style={[s.sectionDesc, { color: t.textSoft }]}>{desc}</Text>
    </View>
  );
}

function MajorCard({ t, item, selected, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        s.majorCard,
        {
          backgroundColor: selected ? t.blueSoft : t.surface,
          borderColor: selected ? t.blue : t.borderSoft,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <View style={[s.majorIcon, { backgroundColor: selected ? t.surface : t.surface2 }]}>
        <Ionicons name={item.icon} size={20} color={selected ? t.blue : t.textSoft} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.majorName, { color: selected ? t.blue : t.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[s.majorDesc, { color: t.textSoft }]} numberOfLines={1}>{item.desc}</Text>
      </View>
      {selected && (
        <View style={[s.check, { backgroundColor: t.blue }]}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  toastIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { fontSize: 13, fontWeight: '800' },
  header: {
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0 },
  profileCard: { borderWidth: 1, borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '900' },
  name: { fontSize: 16, fontWeight: '900' },
  email: { fontSize: 12.5, marginTop: 2, fontWeight: '600' },
  statusPill: { marginTop: 8, alignSelf: 'flex-start', maxWidth: '100%', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11.5, fontWeight: '800' },
  sectionHead: { paddingTop: 22, paddingBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 14.5, fontWeight: '900' },
  sectionDesc: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  majorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  majorCard: { width: '48.8%', minHeight: 78, borderRadius: 8, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 9, position: 'relative' },
  majorIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  majorName: { fontSize: 13.5, fontWeight: '900' },
  majorDesc: { fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  check: { position: 'absolute', top: 7, right: 7, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  gradeRow: { flexDirection: 'row', gap: 8 },
  gradeBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
    elevation: 2,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  gradeMeta: { fontSize: 10, fontWeight: '900' },
  gradeText: { fontSize: 14, fontWeight: '900', marginTop: 3 },
  infoCard: { marginTop: 18, borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  saveBtn: { minHeight: 52, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveText: { fontSize: 15, fontWeight: '900' },
});
