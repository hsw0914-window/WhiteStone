import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, View, Text, Platform, StatusBar as RNStatusBar } from 'react-native';
import { ResponseType, getDefaultReturnUrl, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { tokens } from './utils/tokens';
import { setAuth, getToken, saveAuth, restoreAuth, clearAuth } from './utils/auth';
import { BASE_URL, GOOGLE_REDIRECT_URI, GOOGLE_WEB_CLIENT_ID } from './constants';

import TabBar from './components/TabBar';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotScreen from './screens/ForgotScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatRoomScreen from './screens/ChatRoomScreen';
import MapScreen from './screens/MapScreen';
import InsightScreen from './screens/InsightScreen';
import TBDScreen from './screens/TBDScreen';
import SettingsScreen from './screens/SettingsScreen';
import MyPageScreen from './screens/MyPageScreen';

const TOP_PAD = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 44;

// ── Google OAuth ─────────────────────────────────────────────────────────────
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

function AppContent() {
  const [dark, setDark] = useState(false);
  const t = tokens(dark);


  // ── 내비게이션 상태 ──────────────────────────────────────────────────────────
  const [screen, setScreen] = useState('login'); // 'login' | 'signup' | 'forgot' | 'main'
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState('chats');
  const [beforeMyPageTab, setBeforeMyPageTab] = useState('roadmap');
  const [openSessionId, setOpenSessionId] = useState(null);

  // ── 데이터 상태 ──────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [roadmapProfile, setRoadmapProfile] = useState({ major: '', grade: 0 });
  const [sessions, setSessions] = useState([]);
  const [sessionMessages, setSessionMessages] = useState({});
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [appToast, setAppToast] = useState(null);
  const appToastTimerRef = useRef(null);

  const showToast = useCallback((message, tone = 'error') => {
    if (appToastTimerRef.current) clearTimeout(appToastTimerRef.current);
    setAppToast({ message, tone });
    appToastTimerRef.current = setTimeout(() => setAppToast(null), 2400);
  }, []);

  // ── API 헬퍼 ─────────────────────────────────────────────────────────────────
  const api = useCallback(async (path, method = 'GET', body) => {
    const token = getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  // ── 인증 ────────────────────────────────────────────────────────────────────
  const handleLogin = useCallback(async (email, pw) => {
    try {
      const data = await api('/auth/login', 'POST', { email, password: pw });
      await saveAuth(data.token, data.user);
      setUser(data.user);
      setRoadmapProfile({ major: data.user?.major || '', grade: data.user?.grade || 0 });
      setScreen('main');
      loadSessions();
    } catch (err) {
      showToast(`로그인 실패: ${err.message}`);
      throw err;
    }
  }, [api, showToast]);

  const handleSignup = useCallback(async (name, email, pw) => {
    const data = await api('/auth/signup', 'POST', { name, email, password: pw });
    await saveAuth(data.token, data.user);
    setUser(data.user);
    setRoadmapProfile({ major: data.user?.major || '', grade: data.user?.grade || 0 });
  }, [api]);

  const handleGoogleLogin = useCallback(async (code, codeVerifier) => {
    try {
      const data = await api('/auth/google/code', 'POST', {
        code,
        code_verifier: codeVerifier,
        redirect_uri: GOOGLE_REDIRECT_URI,
        client_id: GOOGLE_WEB_CLIENT_ID,
      });
      await saveAuth(data.token, data.user);
      setUser(data.user);
      setRoadmapProfile({ major: data.user?.major || '', grade: data.user?.grade || 0 });
      setScreen('main');
      loadSessions();
    } catch (err) {
      showToast(`Google 로그인 실패: ${err.message}`);
    }
  }, [api, showToast]);

  const [googleRequest] = useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      responseType: ResponseType.Code,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: GOOGLE_REDIRECT_URI,
    },
    GOOGLE_DISCOVERY
  );

  const startGoogleLogin = useCallback(async () => {
    if (!googleRequest?.url) {
      showToast('Google 로그인 준비 중입니다. 잠시 후 다시 시도해 주세요.', 'info');
      return;
    }

    const returnUrl = getDefaultReturnUrl();
    const startUrl = `${GOOGLE_REDIRECT_URI}/start?authUrl=${encodeURIComponent(googleRequest.url)}&returnUrl=${encodeURIComponent(returnUrl)}`;

    try {
      const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
      if (result.type !== 'success') return;

      const parsed = googleRequest.parseReturnUrl(result.url);
      if (parsed.type === 'error') {
        showToast(parsed.error?.message || 'Google 인증이 취소되었거나 실패했습니다.');
        return;
      }

      const { code } = parsed.params;
      if (!code) {
        showToast('Google 인증 코드를 받지 못했습니다.');
        return;
      }

      await handleGoogleLogin(code, googleRequest.codeVerifier);
    } catch (err) {
      showToast(`Google 로그인 실패: ${err.message}`);
    }
  }, [googleRequest, handleGoogleLogin, showToast]);

  const handleLogout = useCallback(async () => {
    await clearAuth();
    setUser(null);
    setRoadmapProfile({ major: '', grade: 0 });
    setSessions([]);
    setSessionMessages({});
    setOpenSessionId(null);
    setTab('chats');
    setScreen('login');
  }, []);

  const openMyPage = useCallback(() => {
    setBeforeMyPageTab(tab === 'mypage' ? 'roadmap' : tab);
    if (tab === 'chats') setOpenSessionId(null);
    setTab('mypage');
  }, [tab]);

  const handleSaveProfile = useCallback(async (major, grade) => {
    const data = await api('/auth/profile', 'PATCH', { major, grade });
    setRoadmapProfile({ major: data.user?.major || major, grade: data.user?.grade || grade });
    setUser(prev => prev ? { ...prev, ...data.user } : data.user);
    const token = getToken();
    if (token) await saveAuth(token, data.user);
    return data.user;
  }, [api]);

  // ── 세션 ────────────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await api('/sessions');
      setSessions(data);
    } catch { /* 조용히 실패 */ }
    finally { setSessionsLoading(false); }
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const restored = await restoreAuth();
        if (cancelled) return;
        if (restored?.token && restored?.user) {
          const data = await api('/auth/me');
          const restoredUser = data.user || restored.user;
          setUser(restoredUser);
          setRoadmapProfile({
            major: restoredUser?.major || '',
            grade: restoredUser?.grade || 0,
          });
          await saveAuth(restored.token, restoredUser);
          setScreen('main');
          await loadSessions();
        }
      } catch {
        await clearAuth();
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, loadSessions]);

  const handleNewChat = useCallback(async () => {
    try {
      const sess = await api('/sessions', 'POST', { title: '새로운 대화' });
      await loadSessions();
      // 첫 메시지(봇 인사) 로드
      const msgs = await api(`/sessions/${sess.id}/messages`);
      setSessionMessages(prev => ({ ...prev, [sess.id]: msgs }));
      setOpenSessionId(sess.id);
      setTab('chats');
    } catch (err) {
      showToast(err.message);
    }
  }, [api, loadSessions, showToast]);

  const handleOpenSession = useCallback(async (id) => {
    setOpenSessionId(id);
    if (!sessionMessages[id]) {
      try {
        const msgs = await api(`/sessions/${id}/messages`);
        setSessionMessages(prev => ({ ...prev, [id]: msgs }));
      } catch { /* 조용히 실패 */ }
    }
  }, [api, sessionMessages]);

  const handleSendMessage = useCallback(async (text) => {
    if (!openSessionId) return;
    const sid = openSessionId;
    const ts = new Date().toISOString();

    const userMsg = { role: 'user', text, time: ts };
    const typingMsg = { role: 'bot', typing: true };
    setSessionMessages(prev => ({
      ...prev,
      [sid]: [...(prev[sid] || []), userMsg, typingMsg],
    }));
    setChatLoading(true);

    try {
      const data = await api(`/sessions/${sid}/messages`, 'POST', { text });
      const botMsg = { role: 'bot', text: data.bot_reply, time: ts };
      setSessionMessages(prev => ({
        ...prev,
        [sid]: [...(prev[sid] || []).filter(m => !m.typing), botMsg],
      }));
      loadSessions(); // 목록 제목/미리보기 갱신
    } catch (err) {
      setSessionMessages(prev => ({
        ...prev,
        [sid]: (prev[sid] || []).filter(m => !m.typing),
      }));
      showToast(err.message);
    } finally {
      setChatLoading(false);
    }
  }, [api, openSessionId, loadSessions, showToast]);

  const handleDeleteSession = useCallback(async (id) => {
    try {
      await api(`/sessions/${id}`, 'DELETE');
      setSessions(prev => prev.filter(s => s.id !== id));
      setSessionMessages(prev => { const n = { ...prev }; delete n[id]; return n; });
      if (openSessionId === id) setOpenSessionId(null);
    } catch (err) {
      showToast(err.message);
    }
  }, [api, openSessionId, showToast]);

  const handleRenameSession = useCallback(async (id, newTitle) => {
    try {
      await api(`/sessions/${id}`, 'PATCH', { title: newTitle });
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    } catch (err) {
      showToast(err.message);
    }
  }, [api, showToast]);

  const handleTabChange = useCallback((newTab) => {
    if (newTab === 'new') {
      handleNewChat();
      return;
    }
    if (newTab !== 'chats') setOpenSessionId(null);
    setTab(newTab);
  }, [handleNewChat]);

  // ── 현재 열린 세션 객체 조합 ─────────────────────────────────────────────────
  const currentSession = openSessionId ? {
    id: openSessionId,
    title: sessions.find(s => s.id === openSessionId)?.title || '대화',
    messages: sessionMessages[openSessionId] || [],
  } : null;

  const inChatRoom = tab === 'chats' && !!openSessionId;
  const profileUser = user ? {
    ...user,
    major: roadmapProfile.major || user.major || '',
    grade: roadmapProfile.grade || user.grade || 0,
  } : user;

  const renderToast = () => !!appToast && (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: screen === 'main' ? 96 : 24,
        zIndex: 1000,
        borderWidth: 1,
        borderColor: appToast.tone === 'error' ? '#EF4444' : t.borderSoft,
        borderRadius: 8,
        backgroundColor: appToast.tone === 'error' ? '#EF4444' : t.surface,
        paddingHorizontal: 14,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      <Text style={{ color: appToast.tone === 'error' ? '#fff' : t.text, fontSize: 12.5, fontWeight: '800', textAlign: 'center' }}>
        {appToast.message}
      </Text>
    </View>
  );

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: TOP_PAD, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style={dark ? 'light' : 'dark'}/>
        <ActivityIndicator color={t.blue} />
        <Text style={{ color: t.textSoft, fontSize: 12.5, fontWeight: '700', marginTop: 12 }}>
          로그인 상태 확인 중
        </Text>
      </View>
    );
  }

  // ── 인증 화면 렌더 ───────────────────────────────────────────────────────────
  if (screen === 'login') {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: TOP_PAD }}>
        <StatusBar style={dark ? 'light' : 'dark'}/>
        <LoginScreen
          t={t}
          onLogin={handleLogin}
          onSignup={() => setScreen('signup')}
          onForgot={() => setScreen('forgot')}
          onGoogleLogin={startGoogleLogin}
        />
        {renderToast()}
      </View>
    );
  }

  if (screen === 'signup') {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: TOP_PAD }}>
        <StatusBar style={dark ? 'light' : 'dark'}/>
        <SignupScreen
          t={t}
          onBack={() => setScreen('login')}
          onSignup={handleSignup}
          onComplete={() => { setScreen('main'); loadSessions(); }}
        />
        {renderToast()}
      </View>
    );
  }

  if (screen === 'forgot') {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: TOP_PAD }}>
        <StatusBar style={dark ? 'light' : 'dark'}/>
        <ForgotScreen t={t} onBack={() => setScreen('login')}/>
        {renderToast()}
      </View>
    );
  }

  // ── 메인 앱 ─────────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (tab === 'chats') {
      if (inChatRoom && currentSession) {
        return (
          <ChatRoomScreen
            t={t}
            session={currentSession}
            onBack={() => setOpenSessionId(null)}
            onSend={handleSendMessage}
            loading={chatLoading}
            user={profileUser}
            onMyPage={openMyPage}
            onSettings={() => setTab('settings')}
            onLogout={handleLogout}
          />
        );
      }
      return (
        <ChatListScreen
          t={t}
          sessions={sessions}
          loading={sessionsLoading}
          onOpen={handleOpenSession}
          onNew={handleNewChat}
          onRefresh={loadSessions}
          onDelete={handleDeleteSession}
          onRename={handleRenameSession}
          user={profileUser}
          onMyPage={openMyPage}
          onSettings={() => setTab('settings')}
          onLogout={handleLogout}
        />
      );
    }
    if (tab === 'map')      return <MapScreen t={t}/>;
    if (tab === 'insight')  return <InsightScreen t={t} user={profileUser} onMyPage={openMyPage} onSettings={() => setTab('settings')} onLogout={handleLogout} api={api}/>;
    if (tab === 'roadmap')  return <TBDScreen t={t} user={profileUser} onMyPage={openMyPage} onSettings={() => setTab('settings')} onLogout={handleLogout} api={api}/>;
    if (tab === 'mypage')   return (
      <MyPageScreen
        t={t}
        user={profileUser}
        onBack={() => setTab(beforeMyPageTab || 'roadmap')}
        onSaveProfile={handleSaveProfile}
        onMyPage={openMyPage}
        onSettings={() => setTab('settings')}
        onLogout={handleLogout}
      />
    );
    if (tab === 'settings') return (
      <SettingsScreen
        t={t} dark={dark}
        onToggleDark={setDark}
        onLogout={handleLogout}
        user={profileUser}
        onMyPage={openMyPage}
        onSettings={() => setTab('settings')}
      />
    );
    return null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: TOP_PAD }}>
      <StatusBar style={dark ? 'light' : 'dark'}/>
      <View style={{ flex: 1 }}>
        {renderContent()}
      </View>
      {/* 채팅방에서는 탭바 숨김 (키보드 충돌 방지) */}
      {!inChatRoom && tab !== 'mypage' && (
        <TabBar t={t} active={tab} onChange={handleTabChange}/>
      )}
      {renderToast()}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
