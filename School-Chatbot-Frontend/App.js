import React, { useState, useCallback, useEffect } from 'react';
import { View, Alert, Platform, StatusBar as RNStatusBar } from 'react-native';
import { useAuthRequest, makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();
import { StatusBar } from 'expo-status-bar';

import { tokens } from './utils/tokens';
import { setAuth, getToken, clearAuth } from './utils/auth';
import { BASE_URL } from './constants';

import TabBar from './components/TabBar';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotScreen from './screens/ForgotScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatRoomScreen from './screens/ChatRoomScreen';
import MapScreen from './screens/MapScreen';
import TBDScreen from './screens/TBDScreen';
import SettingsScreen from './screens/SettingsScreen';

const TOP_PAD = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 44;

// ── Google OAuth ─────────────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID = '985939853275-46vknlh7ahkag296e278h135qcuesm34.apps.googleusercontent.com';
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};
const GOOGLE_REDIRECT_URI = makeRedirectUri({ useProxy: true });

export default function App() {
  const [dark, setDark] = useState(false);
  const t = tokens(dark);


  // ── 내비게이션 상태 ──────────────────────────────────────────────────────────
  const [screen, setScreen] = useState('login'); // 'login' | 'signup' | 'forgot' | 'main'
  const [tab, setTab] = useState('chats');
  const [openSessionId, setOpenSessionId] = useState(null);

  // ── 데이터 상태 ──────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionMessages, setSessionMessages] = useState({});
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

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
      setAuth(data.token, data.user);
      setUser(data.user);
      setScreen('main');
      loadSessions();
    } catch (err) {
      Alert.alert('로그인 실패', err.message);
      throw err;
    }
  }, [api]);

  const handleSignup = useCallback(async (name, email, pw) => {
    const data = await api('/auth/signup', 'POST', { name, email, password: pw });
    setAuth(data.token, data.user);
    setUser(data.user);
  }, [api]);

  const handleGoogleLogin = useCallback(async (code, codeVerifier) => {
    try {
      const data = await api('/auth/google/code', 'POST', {
        code,
        code_verifier: codeVerifier,
        redirect_uri: GOOGLE_REDIRECT_URI,
        client_id: GOOGLE_WEB_CLIENT_ID,
      });
      setAuth(data.token, data.user);
      setUser(data.user);
      setScreen('main');
      loadSessions();
    } catch (err) {
      Alert.alert('Google 로그인 실패', err.message);
    }
  }, [api]);

  const [googleRequest, googleResponse, googlePromptAsync] = useAuthRequest(
    {
      clientId: GOOGLE_WEB_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: GOOGLE_REDIRECT_URI,
    },
    GOOGLE_DISCOVERY
  );

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { code } = googleResponse.params;
      handleGoogleLogin(code, googleRequest?.codeVerifier);
    }
  }, [googleResponse]);

  const handleLogout = useCallback(() => {
    clearAuth();
    setUser(null);
    setSessions([]);
    setSessionMessages({});
    setOpenSessionId(null);
    setTab('chats');
    setScreen('login');
  }, []);

  // ── 세션 ────────────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await api('/sessions');
      setSessions(data);
    } catch { /* 조용히 실패 */ }
    finally { setSessionsLoading(false); }
  }, [api]);

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
      Alert.alert('오류', err.message);
    }
  }, [api, loadSessions]);

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
      Alert.alert('오류', err.message);
    } finally {
      setChatLoading(false);
    }
  }, [api, openSessionId, loadSessions]);

  const handleDeleteSession = useCallback(async (id) => {
    try {
      await api(`/sessions/${id}`, 'DELETE');
      setSessions(prev => prev.filter(s => s.id !== id));
      setSessionMessages(prev => { const n = { ...prev }; delete n[id]; return n; });
      if (openSessionId === id) setOpenSessionId(null);
    } catch (err) {
      Alert.alert('오류', err.message);
    }
  }, [api, openSessionId]);

  const handleRenameSession = useCallback(async (id, newTitle) => {
    try {
      await api(`/sessions/${id}`, 'PATCH', { title: newTitle });
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
    } catch (err) {
      Alert.alert('오류', err.message);
    }
  }, [api]);

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
          onGoogleLogin={() => googlePromptAsync()}
        />
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
      </View>
    );
  }

  if (screen === 'forgot') {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: TOP_PAD }}>
        <StatusBar style={dark ? 'light' : 'dark'}/>
        <ForgotScreen t={t} onBack={() => setScreen('login')}/>
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
        />
      );
    }
    if (tab === 'map')      return <MapScreen t={t}/>;
    if (tab === 'tbd')      return <TBDScreen t={t}/>;
    if (tab === 'settings') return (
      <SettingsScreen
        t={t} dark={dark}
        onToggleDark={setDark}
        onLogout={handleLogout}
        user={user}
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
      {!inChatRoom && (
        <TabBar t={t} active={tab} onChange={handleTabChange}/>
      )}
    </View>
  );
}
