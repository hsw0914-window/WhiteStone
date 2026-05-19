/* 티더미 챗봇 – 메인 앱 컴포넌트 */
const { useState, useEffect, useRef, useMemo } = React;

// ─────────────────────────────────────────────────────────────────────────────
// 디자인 토큰
// ─────────────────────────────────────────────────────────────────────────────
const tokens = (dark) => ({
  bg:          dark ? '#0B1220' : '#F6F8FC',
  surface:     dark ? '#121A2B' : '#FFFFFF',
  surface2:    dark ? '#1A2438' : '#EEF2FA',
  text:        dark ? '#E8ECF5' : '#0F172A',
  textSoft:    dark ? '#9AA6BE' : '#5B6479',
  textMute:    dark ? '#64708A' : '#94A0B5',
  border:      dark ? '#1F2A44' : '#E5EBF4',
  borderSoft:  dark ? '#172033' : '#EEF2FA',
  blue:        '#2563EB',
  blueSoft:    dark ? 'rgba(37,99,235,0.18)' : '#E6EEFE',
  blueDark:    '#1D4ED8',
  blueOn:      '#FFFFFF',
  shadow:      dark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(15, 23, 42, 0.06)',
});

const font = "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

// ─────────────────────────────────────────────────────────────────────────────
// 아이콘 (line, 24px)
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 22, color = 'currentColor', stroke = 1.8 }) => {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'chat':     return (<svg {...p}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/></svg>);
    case 'map':      return (<svg {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>);
    case 'plus':     return (<svg {...p}><path d="M12 5v14M5 12h14"/></svg>);
    case 'settings': return (<svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 16.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
    case 'search':   return (<svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>);
    case 'send':     return (<svg {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>);
    case 'mic':      return (<svg {...p}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></svg>);
    case 'back':     return (<svg {...p}><path d="m15 18-6-6 6-6"/></svg>);
    case 'menu':     return (<svg {...p}><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>);
    case 'sun':      return (<svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>);
    case 'moon':     return (<svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>);
    case 'pin':      return (<svg {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>);
    case 'crosshair':return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/></svg>);
    case 'plus-thick':return (<svg {...p} strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>);
    case 'chevron':  return (<svg {...p}><path d="m9 18 6-6-6-6"/></svg>);
    case 'bell':     return (<svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0"/></svg>);
    case 'user':     return (<svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>);
    case 'globe':    return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>);
    case 'shield':   return (<svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>);
    case 'info':     return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>);
    case 'logout':   return (<svg {...p}><path d="M15 17l5-5-5-5M20 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>);
    case 'compass':  return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/></svg>);
    case 'clock':    return (<svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>);
    case 'check':    return (<svg {...p}><path d="m5 12 5 5 9-12"/></svg>);
    default: return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 마스코트 (티더미)
// ─────────────────────────────────────────────────────────────────────────────
const Mascot = ({ size = 36, t }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', flexShrink: 0,
    boxShadow: `inset 0 -2px 4px rgba(0,0,0,0.15), 0 2px 6px ${t.blue}33`,
  }}>
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="#fff" strokeWidth="1.5"/>
      <circle cx="9" cy="11" r="1.5" fill="#fff"/>
      <circle cx="15" cy="11" r="1.5" fill="#fff"/>
      <path d="M9 15c1 1 4 1 5 0" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    </svg>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 상단 헤더 (공통)
// ─────────────────────────────────────────────────────────────────────────────
const Header = ({ t, title, subtitle, right, left, big = false }) => (
  <div style={{
    padding: big ? '20px 20px 14px' : '14px 20px',
    background: t.surface,
    borderBottom: `1px solid ${t.borderSoft}`,
    display: 'flex', alignItems: 'center', gap: 12,
    fontFamily: font,
  }}>
    {left}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, color: t.textSoft, marginTop: 2 }}>{subtitle}</div>}
    </div>
    {right}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 하단 탭 바
// ─────────────────────────────────────────────────────────────────────────────
const TabBar = ({ t, active, onChange }) => {
  const tabs = [
    { id: 'chats',    label: '채팅방',  icon: 'chat' },
    { id: 'map',      label: '지도',    icon: 'map' },
    { id: 'new',      label: '',        icon: 'plus-thick', center: true },
    { id: 'tbd',      label: '미정',    icon: 'compass' },
    { id: 'settings', label: '설정',    icon: 'settings' },
  ];
  return (
    <div style={{
      background: t.surface,
      borderTop: `1px solid ${t.borderSoft}`,
      padding: '8px 8px 6px',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
      fontFamily: font,
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        if (tab.center) {
          return (
            <button key={tab.id} onClick={() => onChange(tab.id)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                transform: 'translateY(-14px)',
              }}>
              <div style={{
                width: 54, height: 54, borderRadius: 18,
                background: `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', boxShadow: `0 8px 18px ${t.blue}55`,
              }}>
                <Icon name={tab.icon} size={28} color="#fff" stroke={2.4}/>
              </div>
            </button>
          );
        }
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            style={{
              background: 'none', border: 'none', padding: '6px 10px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: isActive ? t.blue : t.textSoft, minWidth: 56,
            }}>
            <Icon name={tab.icon} size={22} color={isActive ? t.blue : t.textSoft} stroke={isActive ? 2.2 : 1.8}/>
            <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, fontFamily: font }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

Object.assign(window, { tokens, font, Icon, Mascot, Header, TabBar });
