/* 티더미 챗봇 – 메인 앱 (상태 / 네비게이션 / API 연동) */
const { useState, useEffect, useRef, useMemo } = React;

const API_BASE = 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────────────────────
// 인증 헬퍼 (localStorage)
// ─────────────────────────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('tt_token');
const getUser  = () => { try { return JSON.parse(localStorage.getItem('tt_user')); } catch { return null; } };
const storeAuth = (token, user) => {
  localStorage.setItem('tt_token', token);
  localStorage.setItem('tt_user', JSON.stringify(user));
};
const clearAuth = () => {
  localStorage.removeItem('tt_token');
  localStorage.removeItem('tt_user');
};

// ─────────────────────────────────────────────────────────────────────────────
// 인증 포함 fetch 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
const authFetch = (path, opts) => {
  const options = opts || {};
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
      options.headers || {}
    ),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 시간 포맷터
// ─────────────────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '방금';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '어제';
  if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}일 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
const App = () => {
  const [dark, setDark] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());
  const [currentUser, setCurrentUser] = useState(getUser);
  const [authView, setAuthView] = useState('login');
  const [tab, setTab] = useState('chats');
  const [chats, setChats] = useState([]);
  const [chatMessages, setChatMessages] = useState({});
  const [openId, setOpenId] = useState(null);
  const pendingAuth = useRef(null);
  const t = useMemo(() => tokens(dark), [dark]);

  useEffect(() => {
    if (loggedIn) loadSessions();
  }, [loggedIn]);

  // ── 세션 로딩 ──────────────────────────────────────────────────────────────
  const loadSessions = async () => {
    try {
      const res = await authFetch('/sessions');
      if (res.status === 401) { handleLogout(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setChats(data.map(s => ({ ...s, time: fmtTime(s.time) })));
    } catch (e) {
      console.error('세션 로딩 실패:', e);
    }
  };

  const loadMessages = async (sessionId) => {
    if (chatMessages[sessionId]) return;
    try {
      const res = await authFetch(`/sessions/${sessionId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setChatMessages(prev => ({
        ...prev,
        [sessionId]: data.map(m => ({ ...m, time: fmtTime(m.time) })),
      }));
    } catch (e) {
      console.error('메시지 로딩 실패:', e);
    }
  };

  // ── 채팅 액션 ──────────────────────────────────────────────────────────────
  const openChat = async (id) => {
    setOpenId(id);
    setTab('chats');
    await loadMessages(id);
  };

  const backToList = () => {
    setOpenId(null);
    loadSessions();
  };

  const newChat = async () => {
    try {
      const res = await authFetch('/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: '새로운 대화' }),
      });
      if (!res.ok) return;
      const session = await res.json();
      const initMsgs = (session.messages || []).map(m => ({ ...m, time: fmtTime(m.time) }));
      setChatMessages(prev => ({ ...prev, [session.id]: initMsgs }));
      await loadSessions();
      setOpenId(session.id);
      setTab('chats');
    } catch (e) {
      console.error('채팅 생성 실패:', e);
    }
  };

  const handleTab = (id) => {
    if (id === 'new') { newChat(); return; }
    setOpenId(null);
    setTab(id);
  };

  const sendMessage = async (text) => {
    if (!openId) return;
    const time = fmtTime(new Date().toISOString());

    // 낙관적 업데이트
    setChatMessages(prev => ({
      ...prev,
      [openId]: [...(prev[openId] || []), { role: 'user', text, time }, { role: 'bot', typing: true }],
    }));

    try {
      const res = await authFetch(`/sessions/${openId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const botMsgs = (data.messages || []).map(m => ({ ...m, time: fmtTime(m.time) }));

      setChatMessages(prev => {
        const filtered = (prev[openId] || []).filter(m => !m.typing);
        return { ...prev, [openId]: [...filtered, ...botMsgs] };
      });

      setChats(cs => cs.map(c => {
        if (c.id !== openId) return c;
        const newTitle = c.title === '새로운 대화'
          ? text.slice(0, 25) + (text.length > 25 ? '...' : '')
          : c.title;
        return { ...c, title: newTitle, preview: data.bot_reply || text, time };
      }));
    } catch {
      setChatMessages(prev => ({
        ...prev,
        [openId]: (prev[openId] || []).filter(m => !m.typing),
      }));
    }
  };

  // ── 인증 액션 ──────────────────────────────────────────────────────────────
  const handleLogin = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.detail || '로그인에 실패했습니다.'); return; }
      storeAuth(data.token, data.user);
      setCurrentUser(data.user);
      setLoggedIn(true);
    } catch { alert('서버에 연결할 수 없습니다.\n백엔드가 실행 중인지 확인해주세요.'); }
  };

  // SignupScreen의 onSignup 콜백 – API 호출만 담당 (throw on error)
  const handleSignupApi = async (name, email, password) => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || '회원가입에 실패했습니다.');
    pendingAuth.current = { token: data.token, user: data.user };
  };

  // SignupScreen의 "시작하기" 버튼(done 화면)에서 호출
  const handleSignupComplete = () => {
    if (pendingAuth.current) {
      storeAuth(pendingAuth.current.token, pendingAuth.current.user);
      setCurrentUser(pendingAuth.current.user);
      pendingAuth.current = null;
    }
    setLoggedIn(true);
  };

  const handleLogout = () => {
    clearAuth();
    setLoggedIn(false);
    setCurrentUser(null);
    setChats([]);
    setChatMessages({});
    setOpenId(null);
    setAuthView('login');
  };

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  const currentChat = openId
    ? { ...(chats.find(c => c.id === openId) || {}), messages: chatMessages[openId] || [] }
    : null;

  if (!loggedIn) {
    let authBody;
    if (authView === 'signup') {
      authBody = <SignupScreen t={t}
        onBack={() => setAuthView('login')}
        onSignup={handleSignupApi}
        onComplete={handleSignupComplete}/>;
    } else if (authView === 'forgot') {
      authBody = <ForgotScreen t={t} onBack={() => setAuthView('login')}/>;
    } else {
      authBody = <LoginScreen t={t} dark={dark}
        onLogin={handleLogin}
        onToggleDark={setDark}
        onSignup={() => setAuthView('signup')}
        onForgot={() => setAuthView('forgot')}/>;
    }
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: t.bg, color: t.text, fontFamily: font }}>
        <FakeStatusBar t={t} dark={dark}/>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {authBody}
        </div>
        <div style={{ height: 18, display: 'flex', justifyContent: 'center', alignItems: 'center', background: t.surface }}>
          <div style={{ width: 110, height: 4, borderRadius: 2, background: t.textMute, opacity: 0.5 }}/>
        </div>
      </div>
    );
  }

  let body;
  if (currentChat) {
    body = <ChatRoom t={t} chat={currentChat} onBack={backToList} onSend={sendMessage}/>;
  } else if (tab === 'chats') {
    body = <ChatList t={t} chats={chats} onOpen={openChat} onNew={newChat}/>;
  } else if (tab === 'map') {
    body = <MapScreen t={t} apiBase={API_BASE}/>;
  } else if (tab === 'tbd') {
    body = <TBDScreen t={t}/>;
  } else if (tab === 'settings') {
    body = <SettingsScreen t={t} dark={dark} onToggleDark={setDark} onLogout={handleLogout} user={currentUser}/>;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: t.bg, color: t.text, fontFamily: font }}>
      <FakeStatusBar t={t} dark={dark}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {body}
      </div>
      <TabBar t={t} active={currentChat ? 'chats' : tab} onChange={handleTab}/>
      <div style={{ height: 18, display: 'flex', justifyContent: 'center', alignItems: 'center', background: t.surface }}>
        <div style={{ width: 110, height: 4, borderRadius: 2, background: t.textMute, opacity: 0.5 }}/>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 가짜 상태바
// ─────────────────────────────────────────────────────────────────────────────
const FakeStatusBar = ({ t, dark }) => (
  <div style={{
    height: 36, padding: '0 18px',
    background: t.surface,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    color: t.text, fontFamily: font, fontSize: 13, fontWeight: 600,
    position: 'relative',
  }}>
    <span>9:30</span>
    <div style={{
      position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)',
      width: 18, height: 18, borderRadius: '50%', background: '#0a0a0a',
    }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <svg width="14" height="14" viewBox="0 0 16 16">
        <path d="M8 13.3L.67 5.97a10.37 10.37 0 0114.66 0L8 13.3z" fill={t.text}/>
      </svg>
      <svg width="14" height="14" viewBox="0 0 16 16">
        <path d="M14.67 14.67V1.33L1.33 14.67h13.34z" fill={t.text}/>
      </svg>
      <svg width="20" height="12" viewBox="0 0 24 12">
        <rect x="0.5" y="0.5" width="20" height="11" rx="3" fill="none" stroke={t.text}/>
        <rect x="2.5" y="2.5" width="14" height="7" rx="1.5" fill={t.text}/>
        <rect x="21" y="3.5" width="1.5" height="5" rx="0.5" fill={t.text}/>
      </svg>
    </div>
  </div>
);

Object.assign(window, { App });

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App/>);
