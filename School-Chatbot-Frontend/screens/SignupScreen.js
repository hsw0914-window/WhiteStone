import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InputField } from './LoginScreen';

export default function SignupScreen({ t, onBack, onSignup, onComplete }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const pwMatch = pw && pw2 && pw === pw2;
  const pwMismatch = pw && pw2 && pw !== pw2;
  const canSubmit = name && email && pwMatch && agreeTerms && agreePrivacy;

  const toggleAll = () => {
    const v = !(agreeTerms && agreePrivacy);
    setAgreeTerms(v);
    setAgreePrivacy(v);
  };

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
      <View style={[s.doneWrap, { backgroundColor: t.bg }]}>
        <View style={[s.doneIcon, { backgroundColor: t.blue }]}>
          <Ionicons name="checkmark" size={44} color="#fff"/>
        </View>
        <Text style={[s.doneTitle, { color: t.text }]}>가입 완료!</Text>
        <Text style={[s.doneSub, { color: t.textSoft }]}>
          환영합니다, {name}님.{'\n'}흰돌이와 대화를 시작해 보세요.
        </Text>
        <TouchableOpacity onPress={onComplete} style={[s.submitBtn, { backgroundColor: t.blue, marginTop: 32, width: '100%' }]}>
          <Text style={s.submitBtnText}>시작하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={t.text}/>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: t.text }]}>회원가입</Text>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.pageTitle, { color: t.text }]}>흰돌이 시작하기</Text>
        <Text style={{ color: t.textSoft, fontSize: 13.5, marginTop: 4, marginBottom: 16 }}>
          백석대학교 학생만 가입 가능합니다.
        </Text>

        <Label t={t}>이름</Label>
        <InputField t={t} icon="person-outline" placeholder="홍길동" value={name} onChangeText={setName}/>

        <Label t={t}>학교 이메일</Label>
        <InputField t={t} icon="globe-outline" placeholder="example@bu.ac.kr" value={email} onChangeText={setEmail}/>

        <Label t={t}>비밀번호</Label>
        <InputField
          t={t} icon="lock-closed-outline" placeholder="영문/숫자/특수문자 8자 이상"
          value={pw} onChangeText={setPw} secureTextEntry={!showPw}
          right={
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Text style={{ color: t.textSoft, fontSize: 12, fontWeight: '700' }}>
                {showPw ? '숨기기' : '보기'}
              </Text>
            </TouchableOpacity>
          }
        />

        <Label t={t}>비밀번호 확인</Label>
        <InputField
          t={t} icon="lock-closed-outline" placeholder="다시 한 번 입력해주세요"
          value={pw2} onChangeText={setPw2} secureTextEntry
        />
        {pwMatch && (
          <Text style={{ color: '#22C55E', fontSize: 11.5, marginTop: 5, fontWeight: '700' }}>✓ 비밀번호가 일치합니다</Text>
        )}
        {pwMismatch && (
          <Text style={{ color: '#EF4444', fontSize: 11.5, marginTop: 5, fontWeight: '700' }}>비밀번호가 일치하지 않습니다</Text>
        )}

        {/* 약관 */}
        <View style={[s.agreeBox, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
          <AgreeRow t={t} on={agreeTerms && agreePrivacy} onPress={toggleAll} label="전체 동의" bold/>
          <View style={{ height: 1, backgroundColor: t.borderSoft, marginVertical: 8 }}/>
          <AgreeRow t={t} on={agreeTerms} onPress={() => setAgreeTerms(!agreeTerms)} label="이용약관 동의" req/>
          <AgreeRow t={t} on={agreePrivacy} onPress={() => setAgreePrivacy(!agreePrivacy)} label="개인정보 처리방침 동의" req/>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          style={[s.submitBtn, { backgroundColor: canSubmit && !submitting ? t.blue : t.border, marginTop: 20 }]}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small"/>
            : <Text style={s.submitBtnText}>가입 완료</Text>
          }
        </TouchableOpacity>

        <View style={s.altRow}>
          <Text style={{ color: t.textSoft, fontSize: 13 }}>이미 회원이신가요?</Text>
          <TouchableOpacity onPress={onBack}>
            <Text style={{ color: t.blue, fontSize: 13, fontWeight: '800', marginLeft: 6 }}>로그인</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 24 }}/>
      </ScrollView>
    </View>
  );
}

function Label({ t, children }) {
  return (
    <Text style={{ color: t.textSoft, fontSize: 12.5, fontWeight: '700', marginTop: 14, marginBottom: 6 }}>
      {children}
    </Text>
  );
}

function AgreeRow({ t, on, onPress, label, bold, req }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <View style={{
        width: 20, height: 20, borderRadius: bold ? 6 : 10,
        borderWidth: 1.6, borderColor: on ? t.blue : t.border,
        backgroundColor: on ? t.blue : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {on && <Ionicons name="checkmark" size={12} color="#fff"/>}
      </View>
      <Text style={{ flex: 1, fontSize: bold ? 14 : 13, color: t.text, fontWeight: bold ? '800' : '600' }}>
        {req && <Text style={{ color: t.blue }}>[필수] </Text>}
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  scroll: { padding: 24, paddingTop: 16 },
  pageTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  agreeBox: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1 },
  submitBtn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  altRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, alignItems: 'center' },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneIcon: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  doneTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  doneSub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
});
