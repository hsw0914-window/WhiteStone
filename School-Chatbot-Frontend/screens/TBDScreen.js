import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileMenuButton from '../components/ProfileMenuButton';

const MAJOR_META = {
  '빅데이터': { icon: 'analytics-outline', label: '빅데이터', accent: '#2563EB' },
  '핀테크': { icon: 'card-outline', label: '핀테크', accent: '#0EA5E9' },
  'IoT': { icon: 'hardware-chip-outline', label: 'IoT', accent: '#22C55E' },
  'AR·VR': { icon: 'cube-outline', label: 'AR·VR', accent: '#8B5CF6' },
};

const GROUP_META = {
  '기초': { color: '#2563EB', soft: '#EFF6FF', icon: 'book-outline' },
  '핵심': { color: '#D97706', soft: '#FFFBEB', icon: 'ribbon-outline' },
  '심화': { color: '#7C3AED', soft: '#F5F3FF', icon: 'trending-up-outline' },
  '응용': { color: '#16A34A', soft: '#F0FDF4', icon: 'construct-outline' },
};

export default function TBDScreen({ t, user, onMyPage, onSettings, onLogout, api }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const isSet = !!(user?.major && user?.grade);

  useEffect(() => {
    setResult(null);
  }, [user?.major, user?.grade]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = (message, tone = 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  const sections = result?.sections || [];
  const totalCourses = useMemo(
    () => sections.reduce((sum, section) => sum + (section.courses?.length || 0), 0),
    [sections]
  );
  const totalCredits = useMemo(
    () => sections.reduce(
      (sum, section) => sum + (section.courses || []).reduce((inner, course) => inner + (Number(course.credit) || 0), 0),
      0
    ),
    [sections]
  );

  const recommend = async () => {
    if (!api || !isSet || loading) return;
    setLoading(true);
    try {
      const data = await api('/recommend', 'POST', {
        major: user.major,
        grade: user.grade,
      });
      setResult(data);
    } catch (err) {
      showToast(err.message || 'AI 과목 추천을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]}>로드맵</Text>
          <Text style={[s.headerSub, { color: t.textSoft }]}>내 전공과 학년에 맞는 과목 추천</Text>
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
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}
      >
        {!isSet ? (
          <EmptyProfileCard t={t} onMyPage={onMyPage} />
        ) : (
          <>
            <ProfileCard t={t} user={user} onMyPage={onMyPage} />
            {!result && (
              <RecommendCard t={t} loading={loading} onPress={recommend} />
            )}
            {result && (
              <ResultCard
                t={t}
                user={user}
                result={result}
                sections={sections}
                totalCourses={totalCourses}
                totalCredits={totalCredits}
                loading={loading}
                onPress={recommend}
              />
            )}
            <NoticeCard t={t} />
          </>
        )}
      </ScrollView>
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
            name={toast.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
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

function EmptyProfileCard({ t, onMyPage }) {
  return (
    <View style={[s.emptyCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
      <View style={[s.emptyIcon, { backgroundColor: t.blueSoft }]}>
        <Ionicons name="person-add-outline" size={34} color={t.blue} />
      </View>
      <Text style={[s.emptyTitle, { color: t.text }]}>전공과 학년을 설정해주세요</Text>
      <Text style={[s.emptySub, { color: t.textSoft }]}>
        마이페이지에서 정보를 입력하면 맞춤 과목 추천을 받을 수 있어요.
      </Text>
      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: t.blue }]} onPress={onMyPage} activeOpacity={0.85}>
        <Text style={s.primaryBtnText}>마이페이지로 이동</Text>
        <Ionicons name="chevron-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function ProfileCard({ t, user, onMyPage }) {
  const meta = MAJOR_META[user.major] || MAJOR_META['빅데이터'];
  return (
    <View style={[s.profileCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
      <View style={[s.majorIcon, { backgroundColor: t.blueSoft }]}>
        <Ionicons name={meta.icon} size={22} color={meta.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.profileTitle, { color: t.text }]} numberOfLines={1}>
          {meta.label}전공 · {user.grade}학년
        </Text>
        <Text style={[s.profileSub, { color: t.textSoft }]} numberOfLines={1}>
          2024~2026 첨단IT학부 로드맵 기준
        </Text>
      </View>
      <TouchableOpacity onPress={onMyPage} style={[s.changeBtn, { backgroundColor: t.surface2, borderColor: t.borderSoft }]} activeOpacity={0.75}>
        <Text style={[s.changeText, { color: t.text }]}>변경</Text>
        <Ionicons name="chevron-forward" size={13} color={t.textSoft} />
      </TouchableOpacity>
    </View>
  );
}

function RecommendCard({ t, loading, onPress }) {
  return (
    <View style={[s.recommendCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
      <View style={s.recommendTop}>
        <View style={[s.sparkIcon, { backgroundColor: t.blue }]}>
          <Ionicons name="sparkles-outline" size={17} color="#fff" />
        </View>
        <Text style={[s.recommendTitle, { color: t.text }]}>AI 과목 추천</Text>
        <Text style={[s.beta, { color: t.blue, backgroundColor: t.blueSoft }]}>BETA</Text>
      </View>
      <Text style={[s.recommendDesc, { color: t.textSoft }]}>
        로드맵 데이터를 바탕으로 이번 학년에 들으면 좋은 과목을 추천해드려요.
      </Text>
      <TouchableOpacity style={[s.primaryBtn, { backgroundColor: t.blue }]} onPress={onPress} disabled={loading} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="sparkles-outline" size={17} color="#fff" />}
        <Text style={s.primaryBtnText}>{loading ? '추천 생성 중' : 'AI 추천받기'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ResultCard({ t, user, result, sections, totalCourses, totalCredits, loading, onPress }) {
  const sectionKey = sections.map(section => section.name).join('|');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setExpanded(prev => {
      const next = {};
      sections.forEach((section, index) => {
        next[section.name] = prev[section.name] ?? index === 0;
      });
      return next;
    });
  }, [sectionKey]);

  const allExpanded = sections.length > 0 && sections.every(section => expanded[section.name]);
  const toggleSection = name => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  const toggleAll = () => {
    const next = {};
    sections.forEach(section => { next[section.name] = !allExpanded; });
    setExpanded(next);
  };

  return (
    <View style={[s.resultCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
      <View style={s.resultHead}>
        <View style={{ flex: 1 }}>
          <Text style={[s.resultTitle, { color: t.text }]}>{user.grade}학년 {user.major} 추천 과목</Text>
          <Text style={[s.resultSub, { color: t.textSoft }]}>
            {totalCourses}개 과목 · {totalCredits || '-'}학점 · 참고 {result.source_count || 0}개
          </Text>
        </View>
        <TouchableOpacity style={[s.regenBtn, { backgroundColor: t.surface2 }]} onPress={onPress} disabled={loading}>
          {loading ? <ActivityIndicator color={t.blue} size="small" /> : <Ionicons name="refresh-outline" size={16} color={t.blue} />}
        </TouchableOpacity>
      </View>

      {sections.length > 0 && (
        <TouchableOpacity
          style={[s.foldAllBtn, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}
          onPress={toggleAll}
          activeOpacity={0.75}
        >
          <Ionicons name={allExpanded ? 'remove-circle-outline' : 'add-circle-outline'} size={15} color={t.blue} />
          <Text style={[s.foldAllText, { color: t.blue }]}>
            {allExpanded ? '전체 접기' : '전체 펼치기'}
          </Text>
        </TouchableOpacity>
      )}

      {sections.length > 0 ? sections.map(section => {
        const group = GROUP_META[section.name] || { color: t.blue, soft: t.blueSoft, icon: 'layers-outline' };
        const isExpanded = !!expanded[section.name];
        const courseCount = (section.courses || []).length;
        const previewNames = (section.courses || []).slice(0, 2).map(course => course.name).join(', ');
        return (
          <View key={section.name} style={[s.sectionBox, { borderColor: t.borderSoft }]}>
            <View style={[s.sectionAccent, { backgroundColor: group.color }]} />
            <TouchableOpacity style={s.sectionHead} onPress={() => toggleSection(section.name)} activeOpacity={0.75}>
              <View style={[s.sectionIcon, { backgroundColor: group.soft }]}>
                <Ionicons name={group.icon} size={16} color={group.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.sectionTitleRow}>
                  <Text style={[s.sectionName, { color: t.text }]}>{section.name}</Text>
                  <Text style={[s.sectionChip, { color: group.color, backgroundColor: group.soft }]}>
                    {(section.courses || []).length}개
                  </Text>
                </View>
                <Text style={[s.sectionDesc, { color: t.textSoft }]}>{section.description}</Text>
              </View>
              <View style={[s.foldIcon, { backgroundColor: group.soft }]}>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={group.color} />
              </View>
            </TouchableOpacity>
            {!isExpanded && !!previewNames && (
              <Text style={[s.collapsedPreview, { color: t.textSoft }]} numberOfLines={1}>
                {previewNames}{courseCount > 2 ? ` 외 ${courseCount - 2}개` : ''}
              </Text>
            )}
            {isExpanded && (section.courses || []).map(course => {
              return (
                <View key={`${section.name}-${course.name}`} style={[s.courseRow, { backgroundColor: t.surface2 }]}>
                  <View style={s.courseTextWrap}>
                    <Text style={[s.courseName, { color: t.text }]} numberOfLines={2}>{course.name}</Text>
                    {!!course.reason && (
                      <Text style={[s.courseReason, { color: t.textSoft }]} numberOfLines={2}>
                        {course.reason}
                      </Text>
                    )}
                  </View>
                  <Text style={[s.credit, { color: t.textSoft }]}>{course.credit || 3}학점</Text>
                </View>
              );
            })}
          </View>
        );
      }) : (
        <Text style={[s.emptyResult, { color: t.textSoft }]}>표시할 과목 데이터가 아직 부족해요.</Text>
      )}

      {!!result.answer && (
        <View style={[s.answerBox, { backgroundColor: t.blueSoft }]}>
          <Text style={[s.answerTitle, { color: t.blue }]}>AI 요약</Text>
          <Text style={[s.answerText, { color: t.text }]}>{result.answer}</Text>
        </View>
      )}
    </View>
  );
}

function NoticeCard({ t }) {
  return (
    <View style={[s.notice, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
      <View style={[s.noticeIcon, { backgroundColor: t.blueSoft }]}>
        <Ionicons name="information-circle-outline" size={17} color={t.blue} />
      </View>
      <Text style={[s.noticeText, { color: t.textSoft }]}>
        수강 정원, 선수과목, 개설 학기는 변동될 수 있어요. 최종 수강신청 전 학부 공지와 수업계획서를 확인해주세요.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0 },
  headerSub: { fontSize: 12.5, marginTop: 1, fontWeight: '600' },
  emptyCard: { borderWidth: 1, borderRadius: 8, padding: 22, alignItems: 'center' },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  emptySub: { fontSize: 13, lineHeight: 20, marginTop: 8, textAlign: 'center', fontWeight: '600' },
  primaryBtn: { marginTop: 18, minHeight: 48, borderRadius: 8, paddingHorizontal: 16, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '900' },
  profileCard: { borderWidth: 1, borderRadius: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  majorIcon: { width: 46, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  profileTitle: { fontSize: 15, fontWeight: '900' },
  profileSub: { fontSize: 11.5, marginTop: 3, fontWeight: '600' },
  changeBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 2 },
  changeText: { fontSize: 12, fontWeight: '900' },
  recommendCard: { borderWidth: 1, borderRadius: 8, padding: 16, marginTop: 10 },
  recommendTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  recommendTitle: { fontSize: 15, fontWeight: '900' },
  beta: { fontSize: 9.5, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  recommendDesc: { fontSize: 13, lineHeight: 20, marginTop: 10, fontWeight: '600' },
  resultCard: { borderWidth: 1, borderRadius: 8, padding: 14, marginTop: 10 },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  resultTitle: { fontSize: 16, fontWeight: '900' },
  resultSub: { fontSize: 11.5, marginTop: 3, fontWeight: '600' },
  regenBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  foldAllBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  foldAllText: { fontSize: 11.5, fontWeight: '900' },
  sectionBox: { borderWidth: 1, borderRadius: 8, padding: 10, paddingLeft: 14, marginTop: 8, overflow: 'hidden' },
  sectionAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionName: { fontSize: 13.5, fontWeight: '900' },
  sectionChip: { fontSize: 10, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  sectionDesc: { fontSize: 11, marginTop: 1, fontWeight: '600' },
  foldIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  collapsedPreview: { fontSize: 11.5, fontWeight: '700', marginTop: 8, paddingLeft: 41 },
  courseRow: { minHeight: 48, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  courseTextWrap: { flex: 1, minWidth: 0 },
  courseName: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  courseReason: { fontSize: 11.3, lineHeight: 16, marginTop: 2, fontWeight: '600' },
  credit: { fontSize: 11, fontWeight: '700', paddingTop: 2 },
  emptyResult: { fontSize: 13, fontWeight: '700', lineHeight: 20 },
  answerBox: { borderRadius: 8, padding: 12, marginTop: 12 },
  answerTitle: { fontSize: 12, fontWeight: '900', marginBottom: 6 },
  answerText: { fontSize: 13, lineHeight: 21, fontWeight: '600' },
  notice: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
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
