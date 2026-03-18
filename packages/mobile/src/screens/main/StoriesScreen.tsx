import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../utils/api';
import { Avatar } from '../../components/Avatar';
import { TG_COLORS } from '../../utils/colors';

export function StoriesScreen() {
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    api.get('/stories/feed')
      .then((res) => setFeed(res.data.feed))
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Stories</Text>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.user.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.storyItem}>
            <View style={[styles.storyRing, !item.hasUnread && styles.storyRingViewed]}>
              <View style={styles.storyAvatarWrapper}>
                <Avatar src={item.user.avatarUrl} name={item.user.displayName} size={56} />
              </View>
            </View>
            <Text style={styles.storyName} numberOfLines={1}>
              {item.user.displayName.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        )}
        numColumns={4}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No stories from your contacts</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  storyItem: { width: '25%', alignItems: 'center', marginBottom: 16 },
  storyRing: {
    padding: 2, borderRadius: 36,
    borderWidth: 2, borderColor: TG_COLORS.blue,
  },
  storyRingViewed: { borderColor: TG_COLORS.divider },
  storyAvatarWrapper: { borderWidth: 2, borderColor: '#fff', borderRadius: 30 },
  storyName: { fontSize: 11, color: TG_COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: TG_COLORS.textSecondary },
});
