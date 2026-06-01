import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Svg, { Circle } from 'react-native-svg';
import ProfileMenuButton from '../components/ProfileMenuButton';

const CATEGORY_META = {
  '학사일정': { icon: 'calendar-outline', color: '#2563EB' },
  '수강신청': { icon: 'clipboard-outline', color: '#1D4ED8' },
  '장학금': { icon: 'ribbon-outline', color: '#0EA5E9' },
  '기숙사': { icon: 'home-outline', color: '#3B82F6' },
  '교통/버스': { icon: 'bus-outline', color: '#60A5FA' },
  '도서관': { icon: 'library-outline', color: '#22C55E' },
  '등록금': { icon: 'card-outline', color: '#F59E0B' },
  '캠퍼스맵': { icon: 'map-outline', color: '#6366F1' },
  '성적': { icon: 'stats-chart-outline', color: '#14B8A6' },
  '졸업': { icon: 'school-outline', color: '#8B5CF6' },
  '생활편의': { icon: 'cafe-outline', color: '#EF4444' },
  '미지원 질문': { icon: 'help-circle-outline', color: '#F97316' },
  '기타': { icon: 'chatbubble-ellipses-outline', color: '#64748B' },
};

const FALLBACK_INSIGHT = {
  period_days: 30,
  total: 0,
  daily_average: 0,
  topic_count: 0,
  categories: [],
  top_category: null,
  recommendation: {
    topic: '기타',
    blurb: '질문이 쌓이면 관심이 반복되는 주제를 기준으로 추천 질문을 보여줄게요.',
    questions: ['학교 일정은 어디서 확인해?', '도서관 운영 시간을 알려줘', '셔틀버스 시간표를 알려줘'],
  },
};

const TABS = [
  { id: 'summary', label: '요약', icon: 'sparkles-outline' },
  { id: 'topics', label: '주제별', icon: 'bar-chart-outline' },
  { id: 'recommend', label: '추천', icon: 'compass-outline' },
];

export default function InsightScreen({ t, user, onMyPage, onSettings, onLogout, api }) {
  const [view, setView] = useState('summary');
  const [insight, setInsight] = useState(FALLBACK_INSIGHT);
  const [recommendation, setRecommendation] = useState(FALLBACK_INSIGHT.recommendation);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState('');
  const [recommendLoadedKey, setRecommendLoadedKey] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const loadInsight = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError('');
    try {
      const data = await api('/insights');
      setInsight({ ...FALLBACK_INSIGHT, ...data });
      setRecommendation(data.recommendation || FALLBACK_INSIGHT.recommendation);
      setRecommendLoadedKey('');
    } catch (err) {
      setError(err.message || '인사이트를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadInsight();
  }, [loadInsight]);

  const categories = useMemo(
    () => (insight.categories || []).map((item) => ({
      ...item,
      ...getCategoryMeta(item.name),
    })),
    [insight.categories]
  );
  const total = insight.total || 0;
  const top = categories[0] || { name: '기타', count: 0, percent: 0, ...getCategoryMeta('기타') };
  const recommendationKey = `${top.name}:${total}`;

  const loadRecommendation = useCallback(async () => {
    if (!api || total === 0 || recommendLoading || recommendLoadedKey === recommendationKey) return;
    setRecommendLoading(true);
    setRecommendError('');
    try {
      const data = await api('/insights/recommendation');
      setRecommendation({ ...FALLBACK_INSIGHT.recommendation, ...data });
      setRecommendLoadedKey(recommendationKey);
    } catch (err) {
      setRecommendError(err.message || '추천 질문을 만들지 못했어요.');
    } finally {
      setRecommendLoading(false);
    }
  }, [api, total, recommendLoading, recommendLoadedKey, recommendationKey]);

  useEffect(() => {
    if (view === 'recommend' && !loading && !error && total > 0) {
      loadRecommendation();
    }
  }, [view, loading, error, total, loadRecommendation]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const showToast = useCallback((message, tone = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const copyQuestion = useCallback(async (question) => {
    try {
      await Clipboard.setStringAsync(question);
      showToast('클립보드에 복사했어요.');
    } catch (err) {
      showToast('질문을 복사하지 못했어요.', 'error');
    }
  }, [showToast]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]}>인사이트</Text>
          <Text style={[s.headerSub, { color: t.textSoft }]}>
            최근 {insight.period_days || 30}일 · 총 {total}개 질문
          </Text>
        </View>
        <ProfileMenuButton t={t} user={user} onMyPage={onMyPage} onSettings={onSettings} onLogout={onLogout} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <SegmentedTabs t={t} value={view} onChange={setView} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}
      >
        {loading && <LoadingCard t={t} />}
        {!loading && !!error && <ErrorCard t={t} message={error} onRetry={loadInsight} />}
        {!loading && !error && total === 0 && (
          <EmptyView t={t} recommendation={recommendation} onRefresh={loadInsight} onCopyQuestion={copyQuestion} />
        )}
        {!loading && !error && total > 0 && (
          <>
            {view === 'summary' && (
              <SummaryView
                t={t}
                total={total}
                top={top}
                categories={categories}
                insight={insight}
                onRecommend={() => setView('recommend')}
                onRefresh={loadInsight}
              />
            )}
            {view === 'topics' && <TopicsView t={t} total={total} categories={categories} />}
            {view === 'recommend' && (
              <RecommendView
                t={t}
                top={top}
                categories={categories}
                recommendation={recommendation}
                loading={recommendLoading}
                error={recommendError}
                onRetry={loadRecommendation}
                onCopyQuestion={copyQuestion}
              />
            )}
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
            size={18}
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

function getCategoryMeta(name) {
  return CATEGORY_META[name] || CATEGORY_META['기타'];
}

function SegmentedTabs({ t, value, onChange }) {
  return (
    <View style={[s.segment, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}>
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[s.segmentItem, active && { backgroundColor: t.surface }]}
            activeOpacity={0.75}
          >
            <Ionicons name={tab.icon} size={15} color={active ? t.blue : t.textSoft} />
            <Text style={[s.segmentText, { color: active ? t.blue : t.textSoft }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function LoadingCard({ t }) {
  return (
    <View style={[s.stateCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
      <ActivityIndicator color={t.blue} />
      <Text style={[s.stateText, { color: t.textSoft }]}>질문 패턴을 분석하는 중이에요.</Text>
    </View>
  );
}

function ErrorCard({ t, message, onRetry }) {
  return (
    <View style={[s.stateCard, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
      <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
      <Text style={[s.stateTitle, { color: t.text }]}>인사이트를 불러오지 못했어요</Text>
      <Text style={[s.stateText, { color: t.textSoft }]}>{message}</Text>
      <TouchableOpacity style={[s.retryBtn, { backgroundColor: t.blue }]} onPress={onRetry} activeOpacity={0.85}>
        <Ionicons name="refresh-outline" size={16} color="#fff" />
        <Text style={s.retryText}>다시 불러오기</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyView({ t, recommendation, onRefresh, onCopyQuestion }) {
  return (
    <>
      <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
        <View style={s.cardTop}>
          <Text style={[s.overline, { color: t.textSoft }]}>대화 한눈에 보기</Text>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: t.surface2 }]} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={16} color={t.textSoft} />
          </TouchableOpacity>
        </View>
        <View style={s.emptyGraphic}>
          <Ionicons name="analytics-outline" size={42} color={t.blue} />
        </View>
        <Text style={[s.emptyTitle, { color: t.text }]}>아직 분석할 질문이 없어요</Text>
        <Text style={[s.emptyBody, { color: t.textSoft }]}>
          채팅방에서 학교 생활 관련 질문을 하면 주제별 횟수와 추천 질문이 여기에 쌓여요.
        </Text>
      </View>
      <RecommendationPreview t={t} recommendation={recommendation} onCopyQuestion={onCopyQuestion} />
    </>
  );
}

function SummaryView({ t, total, top, categories, insight, onRecommend, onRefresh }) {
  return (
    <>
      <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
        <View style={s.cardTop}>
          <Text style={[s.overline, { color: t.textSoft }]}>대화 한눈에 보기</Text>
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: t.surface2 }]} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={16} color={t.textSoft} />
          </TouchableOpacity>
        </View>

        <View style={s.donutWrap}>
          <DonutChart t={t} total={total} categories={categories} />
          <View style={s.donutCenter}>
            <Text style={[s.donutLabel, { color: t.textSoft }]}>총 질문</Text>
            <Text style={[s.donutValue, { color: t.text }]}>{total}</Text>
            <Text style={[s.donutMeta, { color: t.textSoft }]}>
              {insight.topic_count || categories.length}개 주제 · {insight.period_days || 30}일
            </Text>
          </View>
        </View>

        <View style={[s.topPill, { backgroundColor: t.blueSoft }]}>
          <View style={[s.topicIcon, { backgroundColor: '#fff' }]}>
            <Ionicons name={top.icon} size={20} color={top.color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.pillLabel, { color: t.blue }]}>가장 많이 물어본 주제</Text>
            <Text style={[s.pillTitle, { color: t.text }]} numberOfLines={1}>{top.name}</Text>
          </View>
          <View style={[s.percentBadge, { backgroundColor: t.blue }]}>
            <Text style={s.percentText}>{top.percent}%</Text>
          </View>
        </View>
      </View>

      <View style={s.statsRow}>
        <StatCard t={t} label="활동 기간" value={String(insight.period_days || 30)} unit="일" />
        <StatCard t={t} label="하루 평균" value={String(insight.daily_average || 0)} unit="회" />
        <StatCard t={t} label="다룬 주제" value={String(insight.topic_count || categories.length)} unit="개" />
      </View>

      <TouchableOpacity style={[s.cta, { backgroundColor: t.blue }]} activeOpacity={0.85} onPress={onRecommend}>
        <View style={s.ctaIcon}>
          <Ionicons name="sparkles-outline" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.ctaTitle}>맞춤 질문 추천 받기</Text>
          <Text style={s.ctaSub}>{top.name} 관련 추천 3가지</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </TouchableOpacity>
    </>
  );
}

function DonutChart({ t, total, categories }) {
  const size = 196;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={t.surface2} strokeWidth={stroke} fill="none" />
      {categories.map((cat) => {
        const length = total > 0 ? circumference * (cat.count / total) : 0;
        const dashOffset = -offset;
        offset += length;
        return (
          <Circle
            key={cat.name}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={cat.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashOffset}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        );
      })}
    </Svg>
  );
}

function StatCard({ t, label, value, unit }) {
  return (
    <View style={[s.stat, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
      <Text style={[s.statLabel, { color: t.textSoft }]}>{label}</Text>
      <View style={s.statValueRow}>
        <Text style={[s.statValue, { color: t.text }]}>{value}</Text>
        <Text style={[s.statUnit, { color: t.textSoft }]}>{unit}</Text>
      </View>
    </View>
  );
}

function TopicsView({ t, total, categories }) {
  const max = Math.max(...categories.map((cat) => cat.count), 1);

  return (
    <>
      <Text style={[s.description, { color: t.textSoft }]}>
        모든 채팅방의 사용자 질문을 모아 어떤 주제를 자주 물어봤는지 보여줘요.
      </Text>
      <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
        <View style={s.sectionTitleRow}>
          <View style={[s.smallIcon, { backgroundColor: t.blueSoft }]}>
            <Ionicons name="bar-chart-outline" size={15} color={t.blue} />
          </View>
          <Text style={[s.sectionTitle, { color: t.text }]}>주제별 질문 분포</Text>
          <Text style={[s.totalText, { color: t.textSoft }]}>총 {total}개</Text>
        </View>

        {categories.map((cat, index) => {
          const width = `${(cat.count / max) * 100}%`;
          return (
            <View key={cat.name} style={s.topicRow}>
              <View style={s.topicHead}>
                <Ionicons name={cat.icon} size={17} color={cat.color} />
                <Text style={[s.topicName, { color: t.text }]}>{cat.name}</Text>
                {index === 0 && <Text style={s.topBadge}>TOP</Text>}
                <View style={{ flex: 1 }} />
                <Text style={[s.topicCount, { color: t.text }]}>{cat.count}개</Text>
                <Text style={[s.topicPct, { color: cat.color, backgroundColor: t.blueSoft }]}>{cat.percent}%</Text>
              </View>
              <View style={[s.barTrack, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}>
                <View style={[s.barFill, { width, backgroundColor: cat.color }]} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={[s.note, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={[s.smallIcon, { backgroundColor: t.blueSoft }]}>
          <Ionicons name="information-circle-outline" size={15} color={t.blue} />
        </View>
        <Text style={[s.noteText, { color: t.textSoft }]}>
          많이 물어본 주제는 취약점일 수도 있지만, 지금 필요한 관심 주제일 수도 있어요.
        </Text>
      </View>
    </>
  );
}

function RecommendView({ t, top, categories, recommendation, loading, error, onRetry, onCopyQuestion }) {
  const rest = categories.filter((cat) => cat.name !== top.name).slice(0, 4);
  const fallbackReason = recommendation.reason
    ? ` · ${recommendation.reason}`
    : '';

  return (
    <>
      <Text style={[s.description, { color: t.textSoft }]}>
        가장 자주 물어본 주제를 기준으로 다음에 확인하면 좋은 질문을 추천해요.
      </Text>
      <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
        <View style={s.recommendHeader}>
          <View style={[s.recommendIcon, { backgroundColor: t.blue }]}>
            <Ionicons name="sparkles-outline" size={19} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.aiRow}>
              <Text style={[s.sectionTitle, { color: t.text }]}>AI 추천 질문</Text>
              <Text style={[s.aiBadge, { color: t.blue, backgroundColor: t.blueSoft }]}>AI</Text>
            </View>
            <Text style={[s.recommendSub, { color: t.textSoft }]}>
              {loading ? 'AI가 추천 질문을 만드는 중' : recommendation.source === 'ai' ? 'AI 생성 완료' : `기본 추천 표시 중${fallbackReason}`}
            </Text>
          </View>
          {loading && <ActivityIndicator size="small" color={t.blue} />}
        </View>

        <View style={[s.messageBox, { backgroundColor: t.blueSoft }]}>
          <Ionicons name={top.icon} size={22} color={top.color} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.messageTitle, { color: t.text }]}>
              <Text style={{ color: t.blue }}>{recommendation.topic || top.name}</Text>에 관심이 많아 보여요
            </Text>
            <Text style={[s.messageBody, { color: t.textSoft }]}>{recommendation.blurb}</Text>
          </View>
        </View>

        {!!error && (
          <TouchableOpacity style={[s.inlineError, { borderColor: t.borderSoft }]} onPress={onRetry} activeOpacity={0.75}>
            <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
            <Text style={[s.inlineErrorText, { color: t.textSoft }]} numberOfLines={1}>{error}</Text>
            <Ionicons name="refresh-outline" size={15} color={t.textSoft} />
          </TouchableOpacity>
        )}

        <Text style={[s.questionLabel, { color: t.textSoft }]}>이런 질문은 어때요?</Text>
        {(recommendation.questions || []).map((question, index) => (
          <View key={`${question}-${index}`} style={[s.question, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}>
            <View style={[s.questionNumber, { backgroundColor: t.surface, borderColor: t.border }]}>
              <Text style={[s.questionNumberText, { color: t.blue }]}>{index + 1}</Text>
            </View>
            <Text style={[s.questionText, { color: t.text }]} numberOfLines={2}>{question}</Text>
            <TouchableOpacity
              style={[s.copyBtn, { backgroundColor: t.surface, borderColor: t.borderSoft }]}
              onPress={() => onCopyQuestion(question)}
              activeOpacity={0.75}
              accessibilityLabel="추천 질문 복사"
            >
              <Ionicons name="copy-outline" size={16} color={t.textSoft} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {rest.length > 0 && <Text style={[s.otherTitle, { color: t.textSoft }]}>다른 주제도 살펴보기</Text>}
      {rest.map((cat) => (
        <View key={cat.name} style={[s.otherTopic, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
          <View style={[s.otherIcon, { backgroundColor: t.blueSoft }]}>
            <Ionicons name={cat.icon} size={17} color={cat.color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.otherName, { color: t.text }]}>{cat.name}</Text>
            <Text style={[s.otherSub, { color: t.textSoft }]} numberOfLines={1}>
              {cat.count}개 질문 · {cat.percent}%
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

function RecommendationPreview({ t, recommendation, onCopyQuestion }) {
  return (
    <View style={[s.card, { backgroundColor: t.surface, borderColor: t.borderSoft, marginTop: 12 }]}>
      <Text style={[s.sectionTitle, { color: t.text }]}>추천 예시</Text>
      {(recommendation.questions || []).map((question, index) => (
        <View key={`${question}-${index}`} style={[s.question, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}>
          <View style={[s.questionNumber, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[s.questionNumberText, { color: t.blue }]}>{index + 1}</Text>
          </View>
          <Text style={[s.questionText, { color: t.text }]}>{question}</Text>
          <TouchableOpacity
            style={[s.copyBtn, { backgroundColor: t.surface, borderColor: t.borderSoft }]}
            onPress={() => onCopyQuestion(question)}
            activeOpacity={0.75}
            accessibilityLabel="추천 질문 복사"
          >
            <Ionicons name="copy-outline" size={16} color={t.textSoft} />
          </TouchableOpacity>
        </View>
      ))}
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
  headerSub: { fontSize: 12.5, marginTop: 1, fontWeight: '600', letterSpacing: 0 },
  segment: { flexDirection: 'row', borderRadius: 999, padding: 4, borderWidth: 1 },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  segmentText: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0 },
  card: { borderWidth: 1, borderRadius: 8, padding: 14 },
  stateCard: { borderWidth: 1, borderRadius: 8, padding: 22, alignItems: 'center', gap: 10 },
  stateTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 0 },
  stateText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18, textAlign: 'center', letterSpacing: 0 },
  retryBtn: { marginTop: 4, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  retryText: { color: '#fff', fontSize: 12.5, fontWeight: '800', letterSpacing: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overline: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  emptyGraphic: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 22, backgroundColor: '#EFF6FF' },
  emptyTitle: { textAlign: 'center', fontSize: 18, fontWeight: '900', marginTop: 16, letterSpacing: 0 },
  emptyBody: { textAlign: 'center', fontSize: 12.5, lineHeight: 19, marginTop: 7, fontWeight: '600', letterSpacing: 0 },
  donutWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutLabel: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0 },
  donutValue: { fontSize: 52, fontWeight: '900', letterSpacing: 0, lineHeight: 58 },
  donutMeta: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0 },
  topPill: { marginTop: 14, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pillLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0 },
  pillTitle: { fontSize: 16, fontWeight: '900', marginTop: 1, letterSpacing: 0 },
  percentBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  percentText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: { flex: 1, borderRadius: 8, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 5, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '900', letterSpacing: 0 },
  statUnit: { fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  cta: { marginTop: 12, borderRadius: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0 },
  ctaSub: { color: 'rgba(255,255,255,0.88)', fontSize: 11.5, marginTop: 1, fontWeight: '600', letterSpacing: 0 },
  description: { fontSize: 12.5, fontWeight: '600', lineHeight: 19, paddingHorizontal: 4, marginBottom: 10, letterSpacing: 0 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  smallIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0 },
  totalText: { marginLeft: 'auto', fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  topicRow: { marginBottom: 14 },
  topicHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  topicName: { fontSize: 13, fontWeight: '800', letterSpacing: 0 },
  topBadge: { color: '#fff', backgroundColor: '#F59E0B', fontSize: 9, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, letterSpacing: 0 },
  topicCount: { fontSize: 12, fontWeight: '800', letterSpacing: 0 },
  topicPct: { fontSize: 10.5, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, letterSpacing: 0 },
  barTrack: { height: 12, borderRadius: 999, borderWidth: 1, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  note: { marginTop: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600', letterSpacing: 0 },
  recommendHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recommendIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiBadge: { fontSize: 9.5, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, letterSpacing: 0 },
  recommendSub: { fontSize: 11.5, fontWeight: '600', marginTop: 1, letterSpacing: 0 },
  inlineError: { marginTop: 12, borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  inlineErrorText: { flex: 1, fontSize: 11.5, fontWeight: '700', letterSpacing: 0 },
  messageBox: { marginTop: 12, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  messageTitle: { fontSize: 13.5, fontWeight: '800', lineHeight: 20, letterSpacing: 0 },
  messageBody: { fontSize: 12.5, lineHeight: 19, marginTop: 4, fontWeight: '600', letterSpacing: 0 },
  questionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0, paddingTop: 14, paddingBottom: 8 },
  question: { borderRadius: 8, borderWidth: 1, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  questionNumber: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  questionNumberText: { fontSize: 10, fontWeight: '800', letterSpacing: 0 },
  questionText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18, letterSpacing: 0 },
  copyBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  otherTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0, paddingHorizontal: 4, paddingTop: 20, paddingBottom: 10 },
  otherTopic: { borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  otherIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  otherName: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0 },
  otherSub: { fontSize: 11, marginTop: 1, fontWeight: '600', letterSpacing: 0 },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 96,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toastText: { fontSize: 13.5, fontWeight: '800', letterSpacing: 0 },
});
