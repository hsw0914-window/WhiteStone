import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InputField } from './LoginScreen';

export default function ForgotScreen({ t, onBack }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={t.text}/>
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: t.text }]}>비밀번호 찾기</Text>
        </View>
        <View style={s.sentContent}>
          <View style={[s.sentIcon, { backgroundColor: t.blueSoft }]}>
            <Ionicons name="mail-outline" size={40} color={t.blue}/>
          </View>
          <Text style={[s.sentTitle, { color: t.text }]}>메일을 확인해 주세요</Text>
          <Text style={[s.sentSub, { color: t.textSoft }]}>
            <Text style={{ color: t.text, fontWeight: '700' }}>{email}</Text>
            {' '}으로{'\n'}비밀번호 재설정 링크를 보냈습니다.
          </Text>
          <TouchableOpacity onPress={onBack} style={[s.btn, { backgroundColor: t.blue, marginTop: 28, width: '100%' }]}>
            <Text style={s.btnText}>로그인으로 돌아가기</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSent(false)} style={{ marginTop: 14 }}>
            <Text style={{ color: t.textSoft, fontSize: 13, fontWeight: '600' }}>다시 보내기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={t.text}/>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: t.text }]}>비밀번호 찾기</Text>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.pageTitle, { color: t.text }]}>비밀번호를 잊으셨나요?</Text>
        <Text style={{ color: t.textSoft, fontSize: 13.5, marginTop: 8, marginBottom: 20, lineHeight: 22 }}>
          가입 시 등록한 이메일을 입력하시면{'\n'}비밀번호 재설정 링크를 보내드립니다.
        </Text>

        <InputField
          t={t} icon="globe-outline" placeholder="example@bu.ac.kr"
          value={email} onChangeText={setEmail}
          onSubmitEditing={() => email && setSent(true)}
        />

        <TouchableOpacity
          onPress={() => email && setSent(true)}
          disabled={!email}
          style={[s.btn, { backgroundColor: email ? t.blue : t.border, marginTop: 20 }]}
        >
          <Text style={s.btnText}>재설정 링크 받기</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  scroll: { padding: 24, paddingTop: 20 },
  pageTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  btn: { borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sentContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  sentIcon: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  sentTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  sentSub: { fontSize: 13.5, textAlign: 'center', marginTop: 10, lineHeight: 22 },
});
