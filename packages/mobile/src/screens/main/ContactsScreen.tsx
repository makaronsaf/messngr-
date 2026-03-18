import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../utils/api';
import { useChatStore } from '../../store/chatStore';
import { Avatar } from '../../components/Avatar';
import { TG_COLORS } from '../../utils/colors';

export function ContactsScreen() {
  const navigation = useNavigation<any>();
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const { createPrivateChat } = useChatStore() as any;

  useEffect(() => {
    api.get('/users/me/contacts')
      .then((res) => setContacts(res.data.contacts))
      .catch(() => {});
  }, []);

  const handleContact = async (contact: any) => {
    try {
      const res = await api.post('/chats/private', { userId: contact.contact.id });
      navigation.navigate('Chat', {
        chatId: res.data.chat.id,
        chatName: contact.contact.displayName,
      });
    } catch {}
  };

  const filtered = contacts.filter((c) =>
    c.contact.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Contacts</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search contacts..."
          placeholderTextColor={TG_COLORS.textHint}
          style={styles.search}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.contactId}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => handleContact(item)}>
            <Avatar src={item.contact.avatarUrl} name={item.contact.displayName} size={50} />
            <View style={styles.info}>
              <Text style={styles.name}>{item.contact.displayName}</Text>
              <Text style={styles.username}>@{item.contact.username}</Text>
            </View>
            <View style={[styles.statusDot, {
              backgroundColor: item.contact.status === 'ONLINE' ? TG_COLORS.online : TG_COLORS.divider,
            }]} />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No contacts yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TG_COLORS.divider,
  },
  title: { fontSize: 20, fontWeight: '700' },
  searchContainer: { padding: 12 },
  search: {
    backgroundColor: TG_COLORS.bgSecondary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 15,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  username: { fontSize: 13, color: TG_COLORS.textSecondary, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: TG_COLORS.divider, marginLeft: 78 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: TG_COLORS.textSecondary },
});
