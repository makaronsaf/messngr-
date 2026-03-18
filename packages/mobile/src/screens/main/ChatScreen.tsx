import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useChatStore, Message } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { socketService } from '../../utils/socket';
import { Avatar } from '../../components/Avatar';
import { formatMessageTime, formatChatTime } from '../../utils/chatUtils';
import { TG_COLORS } from '../../utils/colors';

export function ChatScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { chatId, chatName } = route.params;
  const { messages, loadMessages, sendMessage, typingUsers, replyingTo, setReplyingTo } = useChatStore();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const chatMessages = messages[chatId] || [];
  const typing = typingUsers[chatId] || [];

  useEffect(() => {
    loadMessages(chatId);
  }, [chatId]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [chatMessages.length]);

  const handleSend = () => {
    if (!text.trim() || !user) return;
    sendMessage(chatId, {
      type: 'TEXT',
      content: text.trim(),
      senderId: user.id,
      sender: user,
      replyToMessageId: replyingTo?.id,
    });
    setText('');
    setReplyingTo(null);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === user?.id;
    const prevMsg = index > 0 ? chatMessages[index - 1] : null;
    const showSender = !isOwn && (!prevMsg || prevMsg.senderId !== item.senderId);

    return (
      <View style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}>
        {!isOwn && (
          <View style={styles.avatarSpace}>
            {showSender && (
              <Avatar src={item.sender.avatarUrl} name={item.sender.displayName} size={32} />
            )}
          </View>
        )}

        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {showSender && !isOwn && (
            <Text style={styles.senderName}>{item.sender.displayName}</Text>
          )}

          {item.replyToMessage && (
            <View style={styles.replyPreview}>
              <Text style={styles.replyName}>{item.replyToMessage.sender?.displayName}</Text>
              <Text style={styles.replyContent} numberOfLines={1}>
                {item.replyToMessage.content || `[${item.replyToMessage.type}]`}
              </Text>
            </View>
          )}

          {item.type === 'TEXT' && (
            <Text style={[styles.messageText, isOwn ? styles.messageTextOwn : styles.messageTextOther]}>
              {item.content}
            </Text>
          )}

          {(item.type === 'VOICE' || item.type === 'AUDIO') && (
            <Text style={styles.mediaPlaceholder}>🎤 Voice message</Text>
          )}

          {item.type === 'IMAGE' && (
            <Text style={styles.mediaPlaceholder}>📷 Photo</Text>
          )}

          {item.type === 'VIDEO_NOTE' && (
            <Text style={styles.mediaPlaceholder}>📹 Video message</Text>
          )}

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwn ? { color: 'rgba(0,0,0,0.4)' } : { color: TG_COLORS.textSecondary }]}>
              {formatMessageTime(item.sentAt)}
              {item.isEdited ? ' (edited)' : ''}
            </Text>
            {isOwn && <Text style={styles.readIndicator}>{item.readBy?.length ? '✓✓' : '✓'}</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{chatName}</Text>
          {typing.length > 0 ? (
            <Text style={styles.typingText}>typing...</Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerAction}>
            <Text>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction}>
            <Text>📹</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={chatMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messageList}
        contentContainerStyle={{ paddingVertical: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Reply preview */}
      {replyingTo && (
        <View style={styles.replyBar}>
          <View style={styles.replyBarContent}>
            <Text style={styles.replyBarName}>{replyingTo.sender.displayName}</Text>
            <Text style={styles.replyBarText} numberOfLines={1}>
              {replyingTo.content || `[${replyingTo.type}]`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Text style={{ color: TG_COLORS.textSecondary, fontSize: 20 }}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.inputAction}>
            <Text>😊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inputAction}>
            <Text>📎</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(t) => {
              setText(t);
              socketService.emit(t ? 'typing:start' : 'typing:stop', { chatId });
            }}
            placeholder="Message"
            placeholderTextColor={TG_COLORS.textHint}
            multiline
            maxLength={4096}
          />
          {text.trim() ? (
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Text style={styles.sendButtonText}>▶</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sendButton}>
              <Text style={styles.sendButtonText}>🎤</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EFEBE0' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TG_COLORS.divider,
    gap: 8,
  },
  backButton: { padding: 4 },
  backText: { fontSize: 20, color: TG_COLORS.blue },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '600', color: '#000' },
  typingText: { fontSize: 12, color: TG_COLORS.blue },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerAction: { padding: 6 },

  messageList: { flex: 1 },
  messageRow: { flexDirection: 'row', marginHorizontal: 8, marginVertical: 2 },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  avatarSpace: { width: 36, alignItems: 'center', justifyContent: 'flex-end', marginRight: 4 },
  bubble: { maxWidth: '75%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 6 },
  bubbleOwn: { backgroundColor: '#EFFDDE', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  senderName: { fontSize: 13, fontWeight: '600', color: TG_COLORS.blue, marginBottom: 2 },
  messageText: { fontSize: 15, lineHeight: 20 },
  messageTextOwn: { color: '#000' },
  messageTextOther: { color: '#000' },
  mediaPlaceholder: { fontSize: 14, color: TG_COLORS.textSecondary },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  messageTime: { fontSize: 11 },
  readIndicator: { fontSize: 11, color: TG_COLORS.blue },
  replyPreview: {
    borderLeftWidth: 2, borderLeftColor: TG_COLORS.blue,
    paddingLeft: 8, marginBottom: 4, backgroundColor: 'rgba(42,171,238,0.08)', borderRadius: 4, padding: 4,
  },
  replyName: { fontSize: 12, fontWeight: '600', color: TG_COLORS.blue },
  replyContent: { fontSize: 12, color: TG_COLORS.textSecondary },

  replyBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: TG_COLORS.divider,
  },
  replyBarContent: { flex: 1, borderLeftWidth: 2, borderLeftColor: TG_COLORS.blue, paddingLeft: 8 },
  replyBarName: { fontSize: 12, fontWeight: '600', color: TG_COLORS.blue },
  replyBarText: { fontSize: 12, color: TG_COLORS.textSecondary },

  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: TG_COLORS.divider,
    gap: 4,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  inputAction: { padding: 8 },
  input: {
    flex: 1, backgroundColor: '#F4F4F5', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 15,
    maxHeight: 120, color: '#000',
  },
  sendButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: TG_COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonText: { color: '#fff', fontSize: 16 },
});
