/* 티더미 챗봇 – 앱 아이콘 + 로그인 화면 */
const { useState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// 앱 아이콘 (SVG)
// ─────────────────────────────────────────────────────────────────────────────
const AppIcon = ({ size = 96, shadow = true }) => {
  const id = 'iconGrad';
  const ringId = 'ringGrad';
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{
      filter: shadow ? 'drop-shadow(0 18px 36px rgba(30,90,200,0.45))' : 'none',
      display: 'block',
    }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#3B82F6"/>
          <stop offset="55%"  stopColor="#1D4ED8"/>
          <stop offset="100%" stopColor="#0B2A6B"/>
        </linearGradient>
        <radialGradient id={ringId} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0%"   stopColor="#5EA0FF"/>
          <stop offset="60%"  stopColor="#1E4FCF"/>
          <stop offset="100%" stopColor="#0A1F58"/>
        </radialGradient>
        <linearGradient id="hi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fff" stopOpacity="0.32"/>
          <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="196" height="196" rx="48" fill={`url(#${id})`}/>
      <rect x="2" y="2" width="196" height="98"  rx="48" fill="url(#hi)"/>
      <circle cx="100" cy="100" r="72" fill={`url(#${ringId})`} stroke="#fff" strokeWidth="2" opacity="0.95"/>
      <circle cx="100" cy="100" r="64" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
      <circle cx="100" cy="100" r="56" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"/>
      <path d="M100 50 L150 138 Q152 144 145 144 L55 144 Q48 144 50 138 Z"
        fill="rgba(255,255,255,0.98)" stroke="rgba(30,80,200,0.2)" strokeWidth="1"/>
      <g transform="translate(100 78)">
        <line x1="0" y1="-10" x2="0" y2="-16" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="0" cy="-18" r="2.2" fill="#1D4ED8"/>
        <rect x="-11" y="-10" width="22" height="18" rx="5" fill="#1D4ED8"/>
        <circle cx="-4" cy="-1" r="1.8" fill="#fff"/>
        <circle cx="4"  cy="-1" r="1.8" fill="#fff"/>
        <rect x="-4" y="3" width="8" height="2" rx="1" fill="#fff"/>
        <rect x="-13" y="-4" width="2" height="6" rx="1" fill="#1D4ED8"/>
        <rect x="11"  y="-4" width="2" height="6" rx="1" fill="#1D4ED8"/>
      </g>
      <text x="100" y="115" textAnchor="middle"
        fontFamily="Pretendard, system-ui" fontSize="22" fontWeight="900"
        fill="#0B2A6B" letterSpacing="-0.5">티더미</text>
      <text x="100" y="132" textAnchor="middle"
        fontFamily="Pretendard, system-ui" fontSize="9" fontWeight="800"
        fill="#1D4ED8" letterSpacing="2">CHATBOT</text>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 로그인 화면
// ─────────────────────────────────────────────────────────────────────────────
const LoginScreen = ({ t, dark, onLogin, onToggleDark, onSignup, onForgot }) => {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [saveId, setSaveId] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!id.trim() || !pw) return;
    setLoading(true);
    try {
      await onLogin(id.trim(), pw);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: t.bg, fontFamily: font, overflow: 'auto',
    }}>
      {/* 우상단 테마 토글 */}
      <div style={{ padding: '14px 18px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => onToggleDark(!dark)} style={{
          background: t.surface, border: `1px solid ${t.borderSoft}`,
          width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
          display: 'grid', placeItems: 'center',
        }}>
          <Icon name={dark ? 'sun' : 'moon'} size={18} color={t.text}/>
        </button>
      </div>

      {/* 로고 + 이름 */}
      <div style={{ padding: '24px 28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <AppIcon size={104}/>
        <div style={{ fontSize: 28, fontWeight: 900, color: t.text, letterSpacing: '-0.03em', marginTop: 18 }}>
          티더미
        </div>
        <div style={{ fontSize: 13.5, color: t.textSoft, marginTop: 6, letterSpacing: '-0.01em' }}>
          백석대학교 AI 챗봇
        </div>
      </div>

      {/* 폼 */}
      <div style={{ padding: '6px 24px 0' }}>
        <Field t={t} icon="user" placeholder="학번 또는 이메일" value={id} onChange={setId}/>
        <div style={{ height: 10 }}/>
        <Field t={t} icon="shield" placeholder="비밀번호" value={pw} onChange={setPw} password
          onEnter={submit}/>

        {/* 옵션 행 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 14, padding: '0 2px',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div onClick={() => setSaveId(!saveId)} style={{
              width: 18, height: 18, borderRadius: 6,
              border: `1.6px solid ${saveId ? t.blue : t.border}`,
              background: saveId ? t.blue : 'transparent',
              display: 'grid', placeItems: 'center', cursor: 'pointer',
              transition: 'all 0.15s', flexShrink: 0,
            }}>
              {saveId && <Icon name="check" size={12} color="#fff" stroke={3}/>}
            </div>
            <span style={{ fontSize: 13, color: t.textSoft, fontWeight: 600 }}>아이디 저장</span>
          </label>
          <button onClick={onForgot} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: t.textSoft, fontSize: 13, fontWeight: 600, fontFamily: font, padding: 0,
          }}>비밀번호 찾기</button>
        </div>

        {/* 로그인 버튼 */}
        <button onClick={submit} disabled={loading || !id.trim() || !pw} style={{
          width: '100%', marginTop: 18, padding: '15px',
          background: !loading && id.trim() && pw
            ? `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`
            : t.border,
          color: '#fff', border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 800, cursor: 'pointer',
          fontFamily: font, letterSpacing: '-0.01em',
          boxShadow: !loading && id && pw ? `0 10px 24px ${t.blue}55` : 'none',
          opacity: loading ? 0.7 : 1,
          transition: 'all 0.15s',
        }}>{loading ? '로그인 중...' : '로그인'}</button>

        {/* 회원가입 */}
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: t.textSoft, fontWeight: 600 }}>
          아직 회원이 아닌가요?
          <button onClick={onSignup} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: t.blue, fontSize: 13, fontWeight: 800,
            fontFamily: font, padding: '0 4px', marginLeft: 4,
          }}>회원가입</button>
        </div>

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '26px 0 16px' }}>
          <div style={{ flex: 1, height: 1, background: t.borderSoft }}/>
          <div style={{ fontSize: 12, color: t.textMute, fontWeight: 600 }}>간편 로그인</div>
          <div style={{ flex: 1, height: 1, background: t.borderSoft }}/>
        </div>

        {/* 소셜 로그인 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SocialBtn t={t} kind="kakao"  onClick={() => alert('카카오 로그인은 준비 중입니다.')}/>
          <SocialBtn t={t} kind="google" onClick={() => alert('구글 로그인은 준비 중입니다.')}/>
          <SocialBtn t={t} kind="bu"     onClick={() => alert('학교 계정 SSO는 준비 중입니다.')}/>
        </div>

        {/* 푸터 */}
        <div style={{ textAlign: 'center', marginTop: 22, paddingBottom: 20 }}>
          <div style={{ fontSize: 11, color: t.textMute, lineHeight: 1.6 }}>
            로그인 시 <span style={{ color: t.textSoft, textDecoration: 'underline' }}>이용약관</span> 및{' '}
            <span style={{ color: t.textSoft, textDecoration: 'underline' }}>개인정보 처리방침</span>에<br/>
            동의하는 것으로 간주됩니다.
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 입력 필드
// ─────────────────────────────────────────────────────────────────────────────
const Field = ({ t, icon, placeholder, value, onChange, password, onEnter }) => {
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: t.surface,
      border: `1.5px solid ${focused ? t.blue : t.borderSoft}`,
      borderRadius: 14, padding: '0 14px',
      transition: 'border-color 0.15s',
      boxShadow: focused ? `0 0 0 4px ${t.blue}1a` : 'none',
    }}>
      <Icon name={icon} size={18} color={focused ? t.blue : t.textSoft}/>
      <input
        type={password && !show ? 'password' : 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => e.key === 'Enter' && onEnter && onEnter()}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          fontSize: 14.5, color: t.text, fontFamily: font, padding: '14px 0',
          minWidth: 0,
        }}/>
      {password && (
        <button onClick={() => setShow(!show)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.textSoft, fontSize: 11.5, fontWeight: 700, fontFamily: font,
          padding: 4,
        }}>{show ? '숨기기' : '보기'}</button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 소셜 로그인 버튼
// ─────────────────────────────────────────────────────────────────────────────
const SocialBtn = ({ t, kind, onClick }) => {
  const cfg = {
    kakao: {
      bg: '#FEE500', fg: '#191600', label: '카카오로 계속하기',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="#191600">
        <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7-.2.7-.8 2.7-.9 3.1 0 0-.1.3.2.3.1 0 .3 0 .4-.1.4-.3 3.1-2 3.7-2.4.6.1 1.3.1 1.9.1 5.5 0 10-3.6 10-8s-4.5-7.7-10-7.7z"/>
      </svg>,
    },
    google: {
      bg: '#fff', fg: '#1F1F1F', border: t.border, label: '구글 계정으로 계속하기',
      icon: <svg width="18" height="18" viewBox="0 0 24 24">
        <path d="M21.6 12.23c0-.78-.07-1.53-.2-2.25H12v4.26h5.39c-.23 1.25-.94 2.31-2 3.02v2.51h3.24c1.9-1.75 2.97-4.32 2.97-7.54z" fill="#4285F4"/>
        <path d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22z" fill="#34A853"/>
        <path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.06a10 10 0 0 0 0 9l3.34-2.59z" fill="#FBBC05"/>
        <path d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.97 14.7 2 12 2A10 10 0 0 0 3.06 7.5L6.4 10.1c.78-2.36 3-4.16 5.6-4.16z" fill="#EA4335"/>
      </svg>,
    },
    bu: {
      bg: t.surface, fg: t.text, border: t.border, label: '백석대학교 계정으로 계속하기',
      icon: <div style={{
        width: 20, height: 20, borderRadius: 6,
        background: `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`,
        display: 'grid', placeItems: 'center',
        color: '#fff', fontSize: 11, fontWeight: 900,
      }}>BU</div>,
    },
  }[kind];

  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '13px 16px',
      background: cfg.bg, color: cfg.fg,
      border: cfg.border ? `1px solid ${cfg.border}` : 'none',
      borderRadius: 14, cursor: 'pointer', fontFamily: font,
      fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em',
      display: 'flex', alignItems: 'center', gap: 12, position: 'relative',
    }}>
      <div style={{ width: 20, display: 'grid', placeItems: 'center' }}>{cfg.icon}</div>
      <div style={{ flex: 1, textAlign: 'center', paddingRight: 20 }}>{cfg.label}</div>
    </button>
  );
};

Object.assign(window, { AppIcon, LoginScreen, Field });
