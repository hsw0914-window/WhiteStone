import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  RefreshControl, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mascot from '../components/Mascot';
import { formatTime } from '../utils/formatTime';

export default function ChatListScreen({ t, sessions, loading, onOpen, onNew, onRefresh, onDelete, onRename }) {
  const [renaming, setRenaming] = useState(null); // { id, title }
  const [renameText, setRenameText] = useState('');

  const openRenameModal = (session) => {
    setRenaming(session);
    setRenameText(session.title);
  };

  const confirmRename = () => {
    if (!renameText.trim() || !renaming) return;
    onRename(renaming.id, renameText.trim());
    setRenaming(null);
  };

  const confirmDelete = (session) => {
    Alert.alert(
      '대화 삭제',
      `"${session.title}" 대화를 삭제할까요?\n삭제된 대화는 복구할 수 없어요.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => onDelete(session.id) },
      ]
    );
  };

  const handleLongPress = (session) => {
    Alert.alert(
      session.title,
      '',
      [
        { text: '이름 변경', onPress: () => openRenameModal(session) },
        { text: '삭제', style: 'destructive', onPress: () => confirmDelete(session) },
        { text: '취소', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]}>채팅방</Text>
          <Text style={{ color: t.textSoft, fontSize: 12.5, marginTop: 1 }}>{sessions.length}개의 대화</Text>
        </View>
        <TouchableOpacity onPress={onNew} style={[s.newBtn, { backgroundColor: t.blueSoft }]}>
          <Ionicons name="add" size={22} color={t.blue}/>
        </TouchableOpacity>
      </View>

      {/* 이름 변경 모달 */}
      <Modal
        visible={!!renaming}
        transparent
        animationType="fade"
        onRequestClose={() => setRenaming(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={s.backdrop}
            activeOpacity={1}
            onPress={() => setRenaming(null)}
          >
            <TouchableOpacity activeOpacity={1} style={[s.modalBox, { backgroundColor: t.surface }]}>
              <Text style={[s.modalTitle, { color: t.text }]}>이름 변경</Text>
              <TextInput
                style={[s.modalInput, { color: t.text, borderColor: t.border, backgroundColor: t.surface2 }]}
                value={renameText}
                onChangeText={setRenameText}
                autoFocus
                selectTextOnFocus
                onSubmitEditing={confirmRename}
                returnKeyType="done"
                maxLength={50}
                placeholderTextColor={t.textMute}
              />
              <View style={s.modalBtns}>
                <TouchableOpacity
                  style={[s.modalBtn, { borderColor: t.border }]}
                  onPress={() => setRenaming(null)}
                >
                  <Text style={{ color: t.textSoft, fontWeight: '600', fontSize: 15 }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, s.modalBtnPrimary, { backgroundColor: t.blue }]}
                  onPress={confirmRename}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>변경</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={sessions}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={t.blue}/>
        }
        ListHeaderComponent={
          <View style={[s.searchBar, { backgroundColor: t.surface, borderColor: t.borderSoft }]}>
            <Ionicons name="search-outline" size={18} color={t.textSoft}/>
            <Text style={{ flex: 1, color: t.textMute, fontSize: 14, marginLeft: 8 }}>대화 검색</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>💬</Text>
            <Text style={[s.emptyTitle, { color: t.text }]}>아직 대화가 없어요</Text>
            <Text style={[s.emptySub, { color: t.textSoft }]}>
              + 버튼을 눌러 흰돌이와{'\n'}첫 대화를 시작해 보세요!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onOpen(item.id)}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={400}
            style={[s.item, { backgroundColor: t.surface, borderColor: t.borderSoft }]}
          >
            <Mascot size={44} t={t}/>
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={[s.itemTitle, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.itemTime, { color: t.textMute }]}>{formatTime(item.time)}</Text>
              </View>
              <Text style={[s.itemPreview, { color: t.textSoft }]} numberOfLines={1}>
                {item.preview}
              </Text>
            </View>
            {item.unread > 0 && (
              <View style={[s.badge, { backgroundColor: t.blue }]}>
                <Text style={s.badgeText}>{item.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  newBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, paddingBottom: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8,
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1, padding: 14, marginVertical: 5,
  },
  itemTitle: { flex: 1, fontSize: 15.5, fontWeight: '700' },
  itemTime: { fontSize: 11.5, marginLeft: 8, flexShrink: 0 },
  itemPreview: { fontSize: 13, marginTop: 3 },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 48 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalBox: {
    width: '100%', borderRadius: 20,
    padding: 24, gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  modalInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  modalBtnPrimary: { borderWidth: 0 },
});
