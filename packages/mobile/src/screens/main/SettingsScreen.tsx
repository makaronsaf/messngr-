import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/Avatar';
import { TG_COLORS } from '../../utils/colors';

export function SettingsScreen() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <ScrollView>
        {/* Profile */}
        <View style={styles.profileSection}>
          <Avatar src={user.avatarUrl} name={user.displayName} size={80} />
          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{user.displayName}</Text>
            <Text style={styles.username}>@{user.username}</Text>
          </View>
        </View>

        {/* Options */}
        <View style={styles.section}>
          <SettingItem icon="🔔" label="Notifications" />
          <SettingItem icon="🔒" label="Privacy & Security" />
          <SettingItem icon="🌙" label="Appearance" />
          <SettingItem icon="📱" label="Devices" />
          <SettingItem icon="💾" label="Storage & Data" />
          <SettingItem icon="❓" label="Help" />
          <TouchableOpacity style={[styles.settingItem, styles.logoutItem]} onPress={logout}>
            <Text style={{ fontSize: 20 }}>🚪</Text>
            <Text style={[styles.settingLabel, { color: TG_COLORS.red }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingItem({ icon, label }: { icon: string; label: string }) {
  return (
    <TouchableOpacity style={styles.settingItem}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={{ color: TG_COLORS.textHint, marginLeft: 'auto' }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  profileSection: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 20,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TG_COLORS.divider,
  },
  profileInfo: {},
  displayName: { fontSize: 20, fontWeight: '700' },
  username: { fontSize: 14, color: TG_COLORS.textSecondary, marginTop: 2 },
  section: { marginTop: 16 },
  settingItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TG_COLORS.divider,
  },
  settingLabel: { fontSize: 16 },
  logoutItem: {},
});
