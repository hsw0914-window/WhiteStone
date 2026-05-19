/* 티더미 챗봇 – 회원가입 / 비밀번호 찾기 */
const { useState, useEffect } = React;

// ─────────────────────────────────────────────────────────────────────────────
// 공통: 상단 헤더 + 뒤로가기
// ─────────────────────────────────────────────────────────────────────────────
const AuthHeader = ({ t, title, onBack }) => (
  <div style={{
    padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
    fontFamily: font, background: t.bg,
  }}>
    <button onClick={onBack} style={{
      background: 'transparent', border: 'none', cursor: 'pointer',
      width: 40, height: 40, display: 'grid', placeItems: 'center',
    }}>
      <Icon name="back" size={22} color={t.text}/>
    </button>
    <div style={{ fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: '-0.01em' }}>{title}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 회원가입
// ─────────────────────────────────────────────────────────────────────────────
const SignupScreen = ({ t, onBack, onSignup, onComplete }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [agreeAll, setAgreeAll] = useState(false);
  const [agree, setAgree] = useState({ terms: false, privacy: false, marketing: false });
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setAll = (v) => { setAgreeAll(v); setAgree({ terms: v, privacy: v, marketing: v }); };
  useEffect(() => {
    const all = agree.terms && agree.privacy && agree.marketing;
    if (all !== agreeAll) setAgreeAll(all);
  }, [agree]);

  const required  = agree.terms && agree.privacy;
  const pwMatch   = pw && pw2 && pw === pw2;
  const pwMismatch= pw && pw2 && pw !== pw2;
  const canSubmit = name && email && pwMatch && required && codeSent && code.length >= 4;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSignup(name, email, pw);
      setDone(true);
    } catch (err) {
      alert(err.message || '회원가입에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', background: t.bg,
        fontFamily: font, padding: '40px 28px',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 88, height: 88, borderRadius: 28,
          background: `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`,
          display: 'grid', placeItems: 'center',
          boxShadow: `0 18px 36px ${t.blue}55`,
        }}>
          <Icon name="check" size={48} color="#fff" stroke={2.6}/>
        </div>
        <div style={{ fontSize: 24, fontWeight: 900, color: t.text, marginTop: 24, letterSpacing: '-0.02em' }}>
          가입 완료!
        </div>
        <div style={{ fontSize: 14, color: t.textSoft, marginTop: 8, textAlign: 'center', lineHeight: 1.55 }}>
          환영합니다, {name}님.<br/>이제 티더미와 대화를 시작해 보세요.
        </div>
        <button onClick={onComplete} style={{
          width: '100%', maxWidth: 320, marginTop: 32, padding: '15px',
          background: `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`,
          color: '#fff', border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 800, cursor: 'pointer',
          fontFamily: font, boxShadow: `0 10px 24px ${t.blue}55`,
        }}>시작하기</button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: font, overflow: 'auto' }}>
      <AuthHeader t={t} title="회원가입" onBack={onBack}/>

      <div style={{ padding: '12px 24px 24px' }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: t.text, letterSpacing: '-0.02em' }}>티더미 시작하기</div>
        <div style={{ fontSize: 13.5, color: t.textSoft, marginTop: 6 }}>백석대학교 학생만 가입 가능합니다.</div>

        {/* 이름 */}
        <AuthLabel t={t}>이름</AuthLabel>
        <Field t={t} icon="user" placeholder="홍길동" value={name} onChange={setName}/>

        {/* 이메일 + 인증 */}
        <AuthLabel t={t}>학교 이메일</AuthLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Field t={t} icon="globe" placeholder="example@bu.ac.kr" value={email} onChange={setEmail}/>
          </div>
          <button
            onClick={() => email && setCodeSent(true)}
            disabled={!email}
            style={{
              padding: '0 14px', borderRadius: 14,
              background: email ? t.blue : t.border,
              color: '#fff', border: 'none', fontSize: 13, fontWeight: 800,
              cursor: email ? 'pointer' : 'default', fontFamily: font,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>{codeSent ? '재전송' : '인증요청'}</button>
        </div>

        {codeSent && (
          <>
            <AuthLabel t={t}>인증코드</AuthLabel>
            <Field t={t} icon="shield" placeholder="이메일로 받은 6자리 코드" value={code} onChange={setCode}/>
            <div style={{ fontSize: 11.5, color: t.blue, marginTop: 6, paddingLeft: 4, fontWeight: 600 }}>
              인증 메일을 발송했습니다. (남은 시간 03:00)
            </div>
          </>
        )}

        {/* 비밀번호 */}
        <AuthLabel t={t}>비밀번호</AuthLabel>
        <Field t={t} icon="shield" placeholder="영문/숫자/특수문자 8자 이상" value={pw} onChange={setPw} password/>

        <AuthLabel t={t}>비밀번호 확인</AuthLabel>
        <Field t={t} icon="shield" placeholder="다시 한 번 입력해주세요" value={pw2} onChange={setPw2} password/>
        {pwMatch && (
          <div style={{ fontSize: 11.5, color: '#22C55E', marginTop: 6, paddingLeft: 4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="check" size={13} color="#22C55E" stroke={3}/> 비밀번호가 일치합니다
          </div>
        )}
        {pwMismatch && (
          <div style={{ fontSize: 11.5, color: '#EF4444', marginTop: 6, paddingLeft: 4, fontWeight: 700 }}>
            비밀번호가 일치하지 않습니다
          </div>
        )}

        {/* 약관 */}
        <div style={{
          marginTop: 20, padding: 14,
          background: t.surface, borderRadius: 14, border: `1px solid ${t.borderSoft}`,
        }}>
          <AgreeCheck t={t} on={agreeAll} onClick={() => setAll(!agreeAll)} label="전체 동의" bold/>
          <div style={{ height: 1, background: t.borderSoft, margin: '10px 0' }}/>
          <AgreeCheck t={t} on={agree.terms}     onClick={() => setAgree({...agree, terms:     !agree.terms})}     label="이용약관 동의"           req/>
          <AgreeCheck t={t} on={agree.privacy}   onClick={() => setAgree({...agree, privacy:   !agree.privacy})}   label="개인정보 처리방침 동의"  req/>
          <AgreeCheck t={t} on={agree.marketing} onClick={() => setAgree({...agree, marketing: !agree.marketing})} label="마케팅 정보 수신 동의"/>
        </div>

        {/* 제출 */}
        <button onClick={handleSubmit} style={{
          width: '100%', marginTop: 22, padding: '15px',
          background: canSubmit && !submitting ? `linear-gradient(135deg, ${t.blue}, ${t.blueDark})` : t.border,
          color: '#fff', border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 800, fontFamily: font,
          cursor: canSubmit && !submitting ? 'pointer' : 'default',
          boxShadow: canSubmit && !submitting ? `0 10px 24px ${t.blue}55` : 'none',
          opacity: canSubmit ? 1 : 0.6,
          transition: 'all 0.15s',
        }}>{submitting ? '가입 중...' : '가입 완료'}</button>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: t.textSoft, fontWeight: 600 }}>
          이미 회원이신가요?
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: t.blue, fontSize: 13, fontWeight: 800,
            fontFamily: font, padding: '0 4px', marginLeft: 4,
          }}>로그인</button>
        </div>
      </div>
    </div>
  );
};

const AuthLabel = ({ t, children }) => (
  <div style={{ fontSize: 12.5, fontWeight: 700, color: t.textSoft, padding: '14px 4px 8px', letterSpacing: '-0.01em' }}>
    {children}
  </div>
);

const AgreeCheck = ({ t, on, onClick, label, bold, req }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '4px 0', cursor: 'pointer',
  }}>
    <div style={{
      width: 20, height: 20, borderRadius: bold ? 6 : 999,
      border: `1.6px solid ${on ? t.blue : t.border}`,
      background: on ? t.blue : 'transparent',
      display: 'grid', placeItems: 'center', flexShrink: 0,
      transition: 'all 0.15s',
    }}>
      {on && <Icon name="check" size={12} color="#fff" stroke={3}/>}
    </div>
    <div style={{ flex: 1, fontSize: bold ? 14 : 13, color: t.text, fontWeight: bold ? 800 : 600 }}>
      {req && <span style={{ color: t.blue, marginRight: 4 }}>[필수]</span>}
      {!req && !bold && <span style={{ color: t.textMute, marginRight: 4 }}>[선택]</span>}
      {label}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 비밀번호 찾기
// ─────────────────────────────────────────────────────────────────────────────
const ForgotScreen = ({ t, onBack }) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: font }}>
        <AuthHeader t={t} title="비밀번호 찾기" onBack={onBack}/>
        <div style={{
          flex: 1, padding: '40px 28px', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 88, height: 88, borderRadius: 28, background: t.blueSoft,
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name="bell" size={42} color={t.blue} stroke={2}/>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: t.text, marginTop: 22, letterSpacing: '-0.02em' }}>
            메일을 확인해 주세요
          </div>
          <div style={{ fontSize: 13.5, color: t.textSoft, marginTop: 10, textAlign: 'center', lineHeight: 1.6 }}>
            <strong style={{ color: t.text }}>{email}</strong> 으로<br/>
            비밀번호 재설정 링크를 보냈습니다.
          </div>
          <div style={{
            background: t.surface, border: `1px solid ${t.borderSoft}`,
            padding: 14, borderRadius: 14, marginTop: 22, width: '100%', maxWidth: 320,
          }}>
            <div style={{ fontSize: 11.5, color: t.textMute, fontWeight: 700, letterSpacing: '0.05em' }}>안내</div>
            <div style={{ fontSize: 12.5, color: t.textSoft, marginTop: 6, lineHeight: 1.6 }}>
              · 메일이 오지 않으면 스팸함을 확인해 주세요.<br/>
              · 링크는 24시간 동안 유효합니다.
            </div>
          </div>
          <button onClick={onBack} style={{
            width: '100%', maxWidth: 320, marginTop: 22, padding: '15px',
            background: `linear-gradient(135deg, ${t.blue}, ${t.blueDark})`,
            color: '#fff', border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 800, cursor: 'pointer',
            fontFamily: font, boxShadow: `0 10px 24px ${t.blue}55`,
          }}>로그인으로 돌아가기</button>
          <button onClick={() => setSent(false)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: t.textSoft, fontSize: 13, fontWeight: 600,
            fontFamily: font, padding: '14px 0 0',
          }}>다시 보내기</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: font, overflow: 'auto' }}>
      <AuthHeader t={t} title="비밀번호 찾기" onBack={onBack}/>
      <div style={{ padding: '12px 24px 24px' }}>
        <div style={{ fontSize: 24, fontWeight: 900, color: t.text, letterSpacing: '-0.02em' }}>
          비밀번호를 잊으셨나요?
        </div>
        <div style={{ fontSize: 13.5, color: t.textSoft, marginTop: 8, lineHeight: 1.55 }}>
          가입 시 등록한 이메일을 입력하시면<br/>비밀번호 재설정 링크를 보내드립니다.
        </div>

        <AuthLabel t={t}>이메일</AuthLabel>
        <Field t={t} icon="globe" placeholder="example@bu.ac.kr" value={email} onChange={setEmail}
          onEnter={() => email && setSent(true)}/>

        <button onClick={() => email && setSent(true)} style={{
          width: '100%', marginTop: 22, padding: '15px',
          background: email ? `linear-gradient(135deg, ${t.blue}, ${t.blueDark})` : t.border,
          color: '#fff', border: 'none', borderRadius: 14,
          fontSize: 15, fontWeight: 800, fontFamily: font,
          cursor: email ? 'pointer' : 'default',
          boxShadow: email ? `0 10px 24px ${t.blue}55` : 'none',
          opacity: email ? 1 : 0.6,
        }}>재설정 링크 받기</button>

        <div style={{
          marginTop: 22, padding: 14,
          background: t.surface, border: `1px solid ${t.borderSoft}`, borderRadius: 14,
        }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>도움이 더 필요하신가요?</div>
          <div style={{ fontSize: 12.5, color: t.textSoft, marginTop: 6, lineHeight: 1.55 }}>
            학교 이메일 접근이 불가능하시면 학사지원팀(041-550-0000)으로 문의해 주세요.
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { SignupScreen, ForgotScreen, AuthHeader, AuthLabel, AgreeCheck });
