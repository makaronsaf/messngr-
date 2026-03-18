import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { socketService } from '../../utils/socket';

export function CallScreen() {
  const navigation = useNavigation<any>();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const endCall = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.name}>Calling...</Text>
        <Text style={styles.duration}>{formatTime(duration)}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn}>
          <Text style={styles.controlIcon}>🔇</Text>
          <Text style={styles.controlLabel}>Mute</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={endCall}>
          <Text style={styles.controlIcon}>📵</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn}>
          <Text style={styles.controlIcon}>📢</Text>
          <Text style={styles.controlLabel}>Speaker</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  duration: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  controls: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: 32, paddingBottom: 48,
  },
  controlBtn: { alignItems: 'center', gap: 6 },
  controlIcon: { fontSize: 32 },
  controlLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  endCallBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center',
  },
});
