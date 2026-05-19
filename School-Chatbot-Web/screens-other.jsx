/* 티더미 챗봇 – 지도 / 미정 / 설정 화면 */
const { useState, useRef } = React;

// ─────────────────────────────────────────────────────────────────────────────
// 지도 화면
// ─────────────────────────────────────────────────────────────────────────────
const MapScreen = ({ t, apiBase }) => {
  const [navInput, setNavInput] = useState('');
  const [navLoading, setNavLoading] = useState(false);
  const iframeRef = useRef(null);

  const postToMap = (msg) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
    } catch (e) { /* cross-origin guard */ }
  };

  const handleNavigate = async () => {
    if (!navInput.trim() || navLoading) return;
    setNavLoading(true);
    try {
      let lat = 36.8397, lng = 127.1840;
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        postToMap({ type: 'UPDATE_LOCATION', lat, lng });
      } catch { /* 위치 권한 없으면 캠퍼스 중심 사용 */ }

      const res = await fetch(`${apiBase}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: navInput, lat, lng }),
      });
      const data = await res.json();

      if (data.error) { alert(data.error); return; }

      postToMap({
        type: 'DRAW_ROUTE',
        route: data.route,
        destination: data.destination,
        steps: data.steps,
        distance: data.distance,
        duration: data.duration,
      });
    } catch {
      alert('길안내 중 오류가 발생했습니다. 서버가 실행 중인지 확인해주세요.');
    } finally {
      setNavLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: font }}>
      <Header t={t} title="캠퍼스 지도" subtitle="백석대학교" big/>

      {/* 길안내 입력 */}
      <div style={{
        padding: '10px 16px',
        background: t.surface, borderBottom: `1px solid ${t.borderSoft}`,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: t.surface2, borderRadius: 14, padding: '10px 14px',
          }}>
            <Icon name="pin" size={18} color={t.blue}/>
            <input
              value={navInput}
              onChange={e => setNavInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNavigate()}
              placeholder="어디로 갈까요? (예: 도서관, 학생식당)"
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, color: t.text, fontFamily: font,
              }}
            />
          </div>
          <button
            onClick={handleNavigate}
            disabled={navLoading || !navInput.trim()}
            style={{
              padding: '0 18px', borderRadius: 14,
              background: navInput.trim() && !navLoading ? t.blue : t.border,
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: font,
              transition: 'background 0.15s', flexShrink: 0,
            }}>
            {navLoading ? '...' : '길안내'}
          </button>
        </div>
      </div>

      {/* 카카오맵 iframe */}
      <div style={{ flex: 1 }}>
        <iframe
          ref={iframeRef}
          src={`${apiBase}/map`}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          title="백석대학교 캠퍼스 지도"
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 미정 화면 (탐색 탭 placeholder)
// ─────────────────────────────────────────────────────────────────────────────
const TBDScreen = ({ t }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: font }}>
    <Header t={t} title="탐색" subtitle="준비 중" big/>
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: t.blueSoft, display: 'grid', placeItems: 'center', marginBottom: 20,
      }}>
        <Icon name="compass" size={40} color={t.blue} stroke={1.6}/>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: t.text, letterSpacing: '-0.02em', marginBottom: 8 }}>
        준비 중입니다
      </div>
      <div style={{ fontSize: 14, color: t.textSoft, textAlign: 'center', lineHeight: 1.6 }}>
        더 유용한 기능을 준비하고 있어요.<br/>조금만 기다려 주세요!
      </div>
      <div style={{
        marginTop: 28, padding: '12px 20px',
        background: t.surface, borderRadius: 14, border: `1px solid ${t.borderSoft}`,
        display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 280,
      }}>
        {['📋 공지사항 바로가기', '🗓 학사일정 캘린더', '🏛 동아리 정보', '📊 성적 조회 바로가기'].map((item, i) => (
          <div key={i} style={{
            fontSize: 13.5, color: t.textSoft, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>{item}</div>
        ))}
        <div style={{ fontSize: 11, color: t.textMute, marginTop: 4 }}>— 곧 추가될 예정이에요</div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 설정 화면
// ─────────────────────────────────────────────────────────────────────────────
const SettingsScreen = ({ t, dark, onToggleDark, onLogout, user }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: font, overflowY: 'auto' }}>
    <Header t={t} title="설정" big/>

    {/* 프로필 카드 */}
    <div style={{ padding: '12px 16px' }}>
      <div style={{
        background: t.surface, borderRadius: 18,
        border: `1px solid ${t.borderSoft}`,
        padding: '20px 16px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 54, height: 54, borderRadius: '50%',
          background: `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, fontWeight: 800, flexShrink: 0,
        }}>
          {(user?.name || '?')[0]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{user?.name || '사용자'}</div>
          <div style={{ fontSize: 13, color: t.textSoft, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || ''}
          </div>
        </div>
      </div>
    </div>

    {/* 설정 항목 */}
    <div style={{ padding: '4px 16px 24px' }}>
      <SettingGroup t={t} title="화면">
        <SettingRow t={t} icon="sun" label="다크 모드" toggle value={dark} onToggle={() => onToggleDark(!dark)}/>
      </SettingGroup>

      <SettingGroup t={t} title="앱 정보">
        <SettingRow t={t} icon="info" label="버전" value="1.0.0 β"/>
        <SettingRow t={t} icon="globe" label="백석대학교 공식 홈페이지" chevron/>
        <SettingRow t={t} icon="shield" label="개인정보 처리방침" chevron/>
      </SettingGroup>

      <SettingGroup t={t} title="계정">
        <SettingRow t={t} icon="logout" label="로그아웃" danger onClick={onLogout}/>
      </SettingGroup>
    </div>
  </div>
);

const SettingGroup = ({ t, title, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{
      fontSize: 12, fontWeight: 700, color: t.textMute,
      letterSpacing: '0.05em', padding: '8px 4px 6px',
    }}>{title}</div>
    <div style={{
      background: t.surface, borderRadius: 16,
      border: `1px solid ${t.borderSoft}`, overflow: 'hidden',
    }}>
      {children}
    </div>
  </div>
);

const SettingRow = ({ t, icon, label, value, toggle, onToggle, chevron, danger, onClick }) => (
  <div
    onClick={onClick || (toggle ? onToggle : undefined)}
    style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
      cursor: onClick || toggle ? 'pointer' : 'default',
      borderBottom: `1px solid ${t.borderSoft}`,
    }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: danger ? '#FEE2E2' : t.blueSoft,
      display: 'grid', placeItems: 'center', flexShrink: 0,
    }}>
      <Icon name={icon} size={18} color={danger ? '#EF4444' : t.blue}/>
    </div>
    <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: danger ? '#EF4444' : t.text }}>
      {label}
    </div>
    {value && !toggle && <div style={{ fontSize: 13, color: t.textSoft }}>{value}</div>}
    {toggle && (
      <div
        onClick={e => { e.stopPropagation(); onToggle && onToggle(); }}
        style={{
          width: 46, height: 26, borderRadius: 13,
          background: value ? t.blue : t.border,
          position: 'relative', cursor: 'pointer',
          transition: 'background 0.2s', flexShrink: 0,
        }}>
        <div style={{
          position: 'absolute', top: 3, left: value ? 23 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}/>
      </div>
    )}
    {chevron && <Icon name="chevron" size={18} color={t.textMute}/>}
  </div>
);

Object.assign(window, { MapScreen, TBDScreen, SettingsScreen });
