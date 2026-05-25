import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileMenuButton({ t, user, onMyPage, onSettings, onLogout }) {
  const [open, setOpen] = useState(false);
  const initial = (user?.name || '?')[0];
  const profileText = user?.major && user?.grade
    ? `${user.major}전공 · ${user.grade}학년`
    : (user?.email || '전공/학년 미설정');

  const press = (handler) => {
    setOpen(false);
    handler?.();
  };

  return (
    <View style={s.wrap}>
      <TouchableOpacity
        onPress={() => setOpen(value => !value)}
        activeOpacity={0.75}
        style={[
          s.button,
          {
            backgroundColor: open ? t.surface : t.blueSoft,
            borderColor: open ? t.blue : 'transparent',
          },
        ]}
      >
        <Text style={[s.initial, { color: t.blue }]}>{initial}</Text>
      </TouchableOpacity>

      {open && (
        <View style={[s.menu, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
          <View style={s.head}>
            <View style={[s.avatar, { backgroundColor: t.blueSoft }]}>
              <Text style={[s.initial, { color: t.blue }]}>{initial}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[s.name, { color: t.text }]} numberOfLines={1}>
                {user?.name || '백석학우'}
              </Text>
              <Text style={[s.sub, { color: t.textSoft }]} numberOfLines={1}>
                {profileText}
              </Text>
            </View>
          </View>

          <MenuRow
            t={t}
            icon="person-circle-outline"
            label="마이페이지"
            onPress={() => press(onMyPage)}
          />
          <MenuRow
            t={t}
            icon="settings-outline"
            label="설정"
            onPress={() => press(onSettings)}
          />
          <MenuRow
            t={t}
            icon="log-out-outline"
            label="로그아웃"
            danger
            onPress={() => press(onLogout)}
          />
        </View>
      )}
    </View>
  );
}

function MenuRow({ t, icon, label, danger, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.row, { borderTopColor: t.borderSoft }]}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={18} color={danger ? '#EF4444' : t.textSoft} />
      <Text style={[s.rowText, { color: danger ? '#EF4444' : t.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative', zIndex: 30 },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 14, fontWeight: '900' },
  menu: {
    position: 'absolute',
    top: 46,
    right: 0,
    width: 214,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  row: {
    minHeight: 44,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  rowText: { fontSize: 13.5, fontWeight: '800' },
});
