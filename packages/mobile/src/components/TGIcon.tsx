import React from 'react';
import { View } from 'react-native';

// Simple SVG-like icons using View/Text - in production use react-native-vector-icons
interface TGIconProps {
  name: 'chat' | 'stories' | 'people' | 'settings';
  color: string;
  size?: number;
}

export function TGIcon({ name, color, size = 24 }: TGIconProps) {
  const icons: Record<string, string> = {
    chat: '💬',
    stories: '🔵',
    people: '👥',
    settings: '⚙️',
  };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* In production: use Icon from 'react-native-vector-icons/MaterialIcons' */}
    </View>
  );
}
