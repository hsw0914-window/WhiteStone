import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

const TABS = [
  { id: 'chats',    label: '채팅방', icon: 'chatbubble-ellipses-outline' },
  { id: 'map',      label: '지도',   icon: 'map-outline' },
  { id: 'new',      center: true },
  { id: 'insight',  label: '인사이트', icon: 'bs-pie-chart' },
  { id: 'roadmap',  label: '로드맵', icon: 'git-branch-outline' },
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
        const color = isActive ? t.blue : t.textSoft;
        return (
          <TouchableOpacity key={tab.id} onPress={() => onChange(tab.id)} style={s.tab}>
            {tab.icon === 'bs-pie-chart'
              ? <BsPieChartIcon size={22} color={color} />
              : <Ionicons name={tab.icon} size={22} color={color}/>
            }
            <Text style={{ fontSize: 10.5, marginTop: 2, color, fontWeight: isActive ? '700' : '500' }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BsPieChartIcon({ size = 22, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M7.5 1.02a7 7 0 1 0 6.98 7.48H7.5V1.02Z"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 1.02A7 7 0 0 1 14.98 7.5H8.5V1.02Z"
        stroke={color}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
