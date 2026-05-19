/* 티더미 챗봇 – 채팅 화면 (목록, 대화방) */
const { useState, useEffect, useRef } = React;

// ─────────────────────────────────────────────────────────────────────────────
// 채팅 목록
// ─────────────────────────────────────────────────────────────────────────────
const ChatList = ({ t, chats, onOpen, onNew }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: font }}>
    <Header t={t} title="채팅방" subtitle={`${chats.length}개의 대화`} big
      right={
        <button onClick={onNew} style={{
          background: t.blueSoft, color: t.blue, border: 'none',
          width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
          cursor: 'pointer',
        }}>
          <Icon name="plus" size={22} color={t.blue} stroke={2.2}/>
        </button>
      }/>

    {/* 검색 */}
    <div style={{ padding: '14px 16px 6px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: t.surface, border: `1px solid ${t.borderSoft}`,
        borderRadius: 14, padding: '10px 14px',
      }}>
        <Icon name="search" size={18} color={t.textSoft}/>
        <input placeholder="대화 검색"
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            flex: 1, fontSize: 14, color: t.text, fontFamily: font,
          }}/>
      </div>
    </div>

    {/* 추천 빠른질문 */}
    <div style={{ padding: '8px 16px 4px' }}>
      <div style={{ fontSize: 12.5, color: t.textSoft, fontWeight: 600, padding: '8px 4px' }}>빠른 질문</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {['📚 도서관 이용시간', '🍱 오늘 학식 메뉴', '🚌 셔틀버스 시간표', '📅 수강신청 일정', '🖨 인쇄 위치'].map((q, i) => (
          <div key={i} style={{
            padding: '8px 14px', borderRadius: 999,
            background: t.surface, border: `1px solid ${t.border}`,
            color: t.text, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
            cursor: 'pointer',
          }}>{q}</div>
        ))}
      </div>
    </div>

    {/* 대화 목록 */}
    <div style={{ flex: 1, padding: '6px 12px 12px', overflowY: 'auto' }}>
      {chats.length === 0 && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '48px 24px',
          color: t.textSoft, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>아직 대화가 없어요</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>+ 버튼을 눌러 티더미와<br/>첫 대화를 시작해 보세요!</div>
        </div>
      )}
      {chats.map(c => (
        <button key={c.id} onClick={() => onOpen(c.id)}
          style={{
            width: '100%', textAlign: 'left',
            background: t.surface, border: `1px solid ${t.borderSoft}`,
            borderRadius: 16, padding: '14px 14px',
            margin: '6px 0', display: 'flex', gap: 12, alignItems: 'center',
            cursor: 'pointer', fontFamily: font,
          }}>
          <Mascot size={44} t={t}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{
                fontSize: 15.5, fontWeight: 700, color: t.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>{c.title}</div>
              <div style={{ fontSize: 11.5, color: t.textMute, flexShrink: 0 }}>{c.time}</div>
            </div>
            <div style={{
              fontSize: 13, color: t.textSoft, marginTop: 4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{c.preview}</div>
          </div>
          {c.unread > 0 && (
            <div style={{
              background: t.blue, color: '#fff',
              fontSize: 11, fontWeight: 700, borderRadius: 999,
              minWidth: 20, height: 20, padding: '0 6px',
              display: 'grid', placeItems: 'center',
            }}>{c.unread}</div>
          )}
        </button>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 대화방
// ─────────────────────────────────────────────────────────────────────────────
const ChatRoom = ({ t, chat, onBack, onSend }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat.messages && chat.messages.length]);

  const submit = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: font }}>
      {/* 헤더 */}
      <Header t={t} title={chat.title || '대화'} subtitle="티더미 · 백석대학교 챗봇"
        left={
          <button onClick={onBack} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            width: 36, height: 36, display: 'grid', placeItems: 'center',
          }}>
            <Icon name="back" size={22} color={t.text}/>
          </button>
        }
        right={
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <Icon name="menu" size={22} color={t.textSoft}/>
          </button>
        }/>

      {/* 메시지 영역 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>
        {/* 인트로 카드 (첫 대화) */}
        {(!chat.messages || chat.messages.length <= 1) && (
          <div style={{
            background: `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`,
            color: '#fff', borderRadius: 20, padding: '20px 18px',
            margin: '4px 4px 16px', boxShadow: t.shadow,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Mascot size={36} t={t}/>
              <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.9 }}>백석대학교 AI 챗봇</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
              안녕하세요!<br/>티더미가 도와드릴게요.
            </div>
            <div style={{ fontSize: 13.5, marginTop: 8, opacity: 0.9, lineHeight: 1.5 }}>
              학사일정, 시설, 학식, 수강신청까지<br/>무엇이든 물어보세요.
            </div>
          </div>
        )}

        {(chat.messages || []).map((m, i) => <Bubble key={i} t={t} m={m}/>)}
      </div>

      {/* 입력 영역 */}
      <div style={{
        padding: '10px 12px 14px',
        background: t.surface, borderTop: `1px solid ${t.borderSoft}`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: t.surface2, borderRadius: 24, padding: '6px 6px 6px 14px',
        }}>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon name="plus" size={22} color={t.textSoft}/>
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
            placeholder="티더미에게 메시지 보내기"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14.5, color: t.text, fontFamily: font, padding: '8px 4px',
            }}/>
          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon name="mic" size={20} color={t.textSoft}/>
          </button>
          <button onClick={submit} style={{
            background: input.trim() ? t.blue : t.border,
            border: 'none', cursor: input.trim() ? 'pointer' : 'default',
            width: 40, height: 40, borderRadius: 20,
            display: 'grid', placeItems: 'center',
            transition: 'background 0.15s',
          }}>
            <Icon name="send" size={18} color="#fff" stroke={2.2}/>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 말풍선
// ─────────────────────────────────────────────────────────────────────────────
const Bubble = ({ t, m }) => {
  const isMe = m.role === 'user';
  return (
    <div style={{
      display: 'flex', gap: 8, margin: '8px 0',
      flexDirection: isMe ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
    }}>
      {!isMe && <Mascot size={32} t={t}/>}
      <div style={{ maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        <div style={{
          background: isMe ? t.blue : t.surface,
          color: isMe ? '#fff' : t.text,
          border: isMe ? 'none' : `1px solid ${t.borderSoft}`,
          padding: m.typing ? '12px 14px' : '11px 14px',
          borderRadius: 18,
          borderBottomRightRadius: isMe ? 6 : 18,
          borderBottomLeftRadius: isMe ? 18 : 6,
          fontSize: 14.5, lineHeight: 1.55, letterSpacing: '-0.01em',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          boxShadow: isMe ? 'none' : t.shadow,
        }}>
          {m.typing ? <TypingDots t={t}/> : m.text}
        </div>
        {m.time && (
          <div style={{ fontSize: 11, color: t.textMute, marginTop: 4, padding: '0 6px' }}>{m.time}</div>
        )}
      </div>
    </div>
  );
};

const TypingDots = ({ t }) => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 6, height: 6, borderRadius: '50%',
        background: t.textSoft, opacity: 0.6,
        animation: `dot 1.2s ${i * 0.15}s infinite ease-in-out`,
      }}/>
    ))}
    <style>{`@keyframes dot { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-3px);opacity:1} }`}</style>
  </div>
);

Object.assign(window, { ChatList, ChatRoom, Bubble, TypingDots });
