import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Image, Animated, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useChatStore, Chat } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useSocketEvents } from '../../hooks/useSocketEvents';
import { getChatName, getChatAvatar, getLastMessagePreview, formatChatTime } from '../../utils/chatUtils';
import { Avatar } from '../../components/Avatar';
import { TG_COLORS } from '../../utils/colors';
import { RootStackParamList } from '../../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function ChatsScreen() {
  const navigation = useNavigation<NavProp>();
  const { chats, loadChats, selectChat } = useChatStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');

  useSocketEvents();

  useEffect(() => {
    loadChats();
  }, []);

  const filtered = chats.filter((chat) =>
    getChatName(chat, user?.id || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleChatPress = async (chat: Chat) => {
    await selectChat(chat.id);
    navigation.navigate('Chat', {
      chatId: chat.id,
      chatName: getChatName(chat, user?.id || ''),
    });
  };

  const renderChat = ({ item }: { item: Chat }) => {
    const name = getChatName(item, user?.id || '');
    const avatar = getChatAvatar(item, user?.id || '');
    const lastMsg = getLastMessagePreview(item.lastMessage, user?.id || '');
    const otherMember = item.type === 'PRIVATE'
      ? item.members?.find((m) => m.user.id !== user?.id)
      : null;

    return (
      <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(item)}>
        <View style={{ position: 'relative' }}>
          <Avatar src={avatar} name={name} size={54} />
          {otherMember?.user.status === 'ONLINE' && (
            <View style={styles.onlineDot} />
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>{name}</Text>
            {item.lastMessage && (
              <Text style={styles.chatTime}>
                {formatChatTime(item.lastMessage.sentAt)}
              </Text>
            )}
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>{lastMsg}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messngr</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Text style={styles.headerButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search"
          placeholderTextColor={TG_COLORS.textHint}
          style={styles.searchInput}
        />
      </View>

      {/* Chats list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderChat}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No chats yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TG_COLORS.divider,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  headerButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: TG_COLORS.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  headerButtonText: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: -2 },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  searchInput: {
    backgroundColor: TG_COLORS.bgSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: '#000',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2, borderColor: '#fff',
  },
  chatContent: { flex: 1, minWidth: 0 },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 3,
  },
  chatName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#000' },
  chatTime: { fontSize: 12, color: TG_COLORS.textSecondary },
  lastMessage: { fontSize: 14, color: TG_COLORS.textSecondary },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: TG_COLORS.divider, marginLeft: 82 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: TG_COLORS.textSecondary, fontSize: 15 },
});
