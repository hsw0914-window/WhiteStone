import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import Mascot from '../components/Mascot';

function GoogleColorG() {
  return (
    <Svg width={24} height={24} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.37-.76-2.83-.76-4.59s.27-3.22.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </Svg>
  );
}

export default function LoginScreen({ t, onLogin, onSignup, onForgot, onGoogleLogin }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim() && pw;

  const submit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    try { await onLogin(email.trim(), pw); }
    finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* 로고 */}
        <View style={s.logoArea}>
          <Mascot size={84}/>
          <Text style={[s.appName, { color: t.text }]}>흰돌이</Text>
          <Text style={[s.appSub, { color: t.textSoft }]}>백석대학교 AI 챗봇</Text>
        </View>

        {/* 폼 */}
        <View>
          <InputField
            t={t} icon="person-outline" placeholder="학번 또는 이메일"
            value={email} onChangeText={setEmail}
          />
          <View style={{ height: 10 }}/>
          <InputField
            t={t} icon="lock-closed-outline" placeholder="비밀번호"
            value={pw} onChangeText={setPw}
            secureTextEntry={!showPw}
            onSubmitEditing={submit}
            right={
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <Text style={{ color: t.textSoft, fontSize: 12, fontWeight: '700' }}>
                  {showPw ? '숨기기' : '보기'}
                </Text>
              </TouchableOpacity>
            }
          />

          <TouchableOpacity onPress={onForgot} style={s.forgotWrap}>
            <Text style={{ color: t.textSoft, fontSize: 13, fontWeight: '600' }}>비밀번호 찾기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={submit}
            disabled={!canSubmit || loading}
            style={[s.btn, { backgroundColor: canSubmit && !loading ? t.blue : t.border }]}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small"/>
              : <Text style={s.btnText}>로그인</Text>
            }
          </TouchableOpacity>

          {/* 구분선 */}
          <View style={s.dividerRow}>
            <View style={[s.dividerLine, { backgroundColor: t.borderSoft }]}/>
            <Text style={{ color: t.textMute, fontSize: 12, marginHorizontal: 10 }}>또는</Text>
            <View style={[s.dividerLine, { backgroundColor: t.borderSoft }]}/>
          </View>

          {/* Google 로그인 */}
          <TouchableOpacity
            onPress={onGoogleLogin}
            style={[s.googleBtn, { borderColor: t.border, backgroundColor: t.surface }]}
          >
            <GoogleColorG />
            <Text style={[s.googleText, { color: t.text }]}>Google로 로그인</Text>
          </TouchableOpacity>

          <View style={s.altRow}>
            <Text style={{ color: t.textSoft, fontSize: 13 }}>아직 회원이 아닌가요?</Text>
            <TouchableOpacity onPress={onSignup}>
              <Text style={{ color: t.blue, fontSize: 13, fontWeight: '800', marginLeft: 6 }}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function InputField({ t, icon, placeholder, value, onChangeText, secureTextEntry, onSubmitEditing, right }) {
  return (
    <View style={[s.field, {
      backgroundColor: t.surface,
      borderColor: t.borderSoft,
    }]}>
      <Ionicons name={icon} size={18} color={t.textSoft}/>
      <TextInput
        style={[s.fieldInput, { color: t.text }]}
        placeholder={placeholder}
        placeholderTextColor={t.textMute}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="none"
        returnKeyType={onSubmitEditing ? 'done' : 'next'}
      />
      {right}
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 32 },
  logoArea: { alignItems: 'center', marginBottom: 36, gap: 10 },
  appName: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  appSub: { fontSize: 14, marginTop: 5 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, height: 52,
  },
  fieldInput: { flex: 1, fontSize: 14.5, paddingVertical: 0 },
  forgotWrap: { alignItems: 'flex-end', paddingVertical: 10 },
  btn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  altRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, alignItems: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, borderWidth: 1.5, height: 52, gap: 10,
  },
  googleText: { fontSize: 15, fontWeight: '700' },
});
