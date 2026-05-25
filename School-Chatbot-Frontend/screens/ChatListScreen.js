import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  RefreshControl, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Mascot from '../components/Mascot';
import ProfileMenuButton from '../components/ProfileMenuButton';
import { formatTime } from '../utils/formatTime';

export default function ChatListScreen({ t, sessions, loading, onOpen, onNew, onRefresh, onDelete, onRename, user, onMyPage, onSettings, onLogout }) {
  const [renaming, setRenaming] = useState(null); // { id, title }
  const [renameText, setRenameText] = useState('');
  const [actionSession, setActionSession] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openRenameModal = (session) => {
    if (!session) return;
    setRenaming(session);
    setRenameText(session.title);
  };

  const confirmRename = () => {
    if (!renameText.trim() || !renaming) return;
    onRename(renaming.id, renameText.trim());
    setRenaming(null);
  };

  const openDeleteModal = (session) => {
    if (!session) return;
    setActionSession(null);
    setDeleteTarget(session);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleLongPress = (session) => {
    setActionSession(session);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* 헤더 */}
      <View style={[s.header, { backgroundColor: t.surface, borderBottomColor: t.borderSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitle, { color: t.text }]}>채팅방</Text>
          <Text style={{ color: t.textSoft, fontSize: 12.5, marginTop: 1 }}>{sessions.length}개의 대화</Text>
        </View>
        <ProfileMenuButton t={t} user={user} onMyPage={onMyPage} onSettings={onSettings} onLogout={onLogout} />
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

      {/* 대화 메뉴 모달 */}
      <Modal
        visible={!!actionSession}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSession(null)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setActionSession(null)}
        >
          <TouchableOpacity activeOpacity={1} style={[s.modalBox, s.sheetBox, { backgroundColor: t.surface }]}>
            <View style={s.sheetHeader}>
              <View style={[s.sheetIcon, { backgroundColor: t.blueSoft }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={t.blue} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.modalTitle, { color: t.text }]} numberOfLines={2}>
                  {actionSession?.title}
                </Text>
                <Text style={[s.modalSub, { color: t.textSoft }]}>대화 관리</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}
              activeOpacity={0.8}
              onPress={() => {
                const target = actionSession;
                setActionSession(null);
                openRenameModal(target);
              }}
            >
              <Ionicons name="create-outline" size={18} color={t.blue} />
              <Text style={[s.actionText, { color: t.text }]}>이름 변경</Text>
              <Ionicons name="chevron-forward" size={16} color={t.textMute} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: t.surface2, borderColor: t.borderSoft }]}
              activeOpacity={0.8}
              onPress={() => openDeleteModal(actionSession)}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
              <Text style={[s.actionText, { color: '#EF4444' }]}>삭제</Text>
              <Ionicons name="chevron-forward" size={16} color={t.textMute} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.modalBtn, { borderColor: t.border }]}
              onPress={() => setActionSession(null)}
            >
              <Text style={{ color: t.textSoft, fontWeight: '700', fontSize: 15 }}>취소</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 대화 삭제 확인 모달 */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <TouchableOpacity
          style={s.backdrop}
          activeOpacity={1}
          onPress={() => setDeleteTarget(null)}
        >
          <TouchableOpacity activeOpacity={1} style={[s.modalBox, { backgroundColor: t.surface }]}>
            <View style={[s.deleteIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </View>
            <Text style={[s.modalTitle, { color: t.text }]}>대화 삭제</Text>
            <Text style={[s.modalMessage, { color: t.textSoft }]}>
              "{deleteTarget?.title}" 대화를 삭제할까요?{'\n'}삭제된 대화는 복구할 수 없어요.
            </Text>
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, { borderColor: t.border }]}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={{ color: t.textSoft, fontWeight: '700', fontSize: 15 }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, { backgroundColor: '#EF4444' }]}
                onPress={confirmDelete}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>삭제</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    width: '100%', borderRadius: 8,
    padding: 20, gap: 14,
  },
  sheetBox: { padding: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  sheetIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0 },
  modalSub: { fontSize: 12, fontWeight: '700', marginTop: 2, letterSpacing: 0 },
  modalMessage: { fontSize: 13.5, fontWeight: '600', lineHeight: 21, letterSpacing: 0 },
  deleteIcon: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionBtn: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  actionText: { flex: 1, fontSize: 14, fontWeight: '800', letterSpacing: 0 },
  modalInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15,
  },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: {
    flex: 1, borderWidth: 1, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  modalBtnPrimary: { borderWidth: 0 },
});
