import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const COLORS = [
  '#E53935', '#D81B60', '#8E24AA', '#5E35B1',
  '#1E88E5', '#039BE5', '#00ACC1', '#00897B',
  '#43A047', '#7CB342', '#F4511E', '#FB8C00',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
}

export function Avatar({ src, name, size = 40 }: AvatarProps) {
  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        defaultSource={require('../assets/avatar-placeholder.png')}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: getColor(name) },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '600' },
});
