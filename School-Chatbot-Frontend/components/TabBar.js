import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { id: 'chats',    label: '채팅방', icon: 'chatbubble-ellipses-outline' },
  { id: 'map',      label: '지도',   icon: 'map-outline' },
  { id: 'new',      center: true },
  { id: 'tbd',      label: '탐색',   icon: 'compass-outline' },
  { id: 'settings', label: '설정',   icon: 'settings-outline' },
];

export default function TabBar({ t, active, onChange }) {
  return (
    <View style={[s.bar, { backgroundColor: t.surface, borderTopColor: t.borderSoft }]}>
      {TABS.map(tab => {
        if (tab.center) {
          return (
            <TouchableOpacity key="new" onPress={() => onChange('new')} style={s.centerWrap}>
              <View style={[s.centerBtn, { backgroundColor: t.blue }]}>
                <Ionicons name="add" size={30} color="#fff"/>
              </View>
            </TouchableOpacity>
          );
        }
        const isActive = active === tab.id;
        return (
          <TouchableOpacity key={tab.id} onPress={() => onChange(tab.id)} style={s.tab}>
            <Ionicons name={tab.icon} size={22} color={isActive ? t.blue : t.textSoft}/>
            <Text style={{ fontSize: 10.5, marginTop: 2, color: isActive ? t.blue : t.textSoft, fontWeight: isActive ? '700' : '500' }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'flex-end',
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 4,
  },
  centerWrap: {
    flex: 1, alignItems: 'center', marginBottom: 10,
  },
  centerBtn: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
});
