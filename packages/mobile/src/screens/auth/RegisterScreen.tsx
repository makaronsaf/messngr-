import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { TG_COLORS } from '../../utils/colors';

export function RegisterScreen() {
  const navigation = useNavigation<any>();
  const { register, isLoading } = useAuthStore();
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
  const update = (f: string) => (v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleRegister = async () => {
    if (!form.displayName || !form.username || !form.email || !form.password) {
      return Alert.alert('Error', 'Please fill in all fields');
    }
    try {
      await register(form.username, form.displayName, form.email, form.password);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.response?.data?.error || 'Please try again');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Text style={styles.logoText}>Create Account</Text>
            <Text style={styles.logoSubtext}>Join Messngr today</Text>
          </View>

          <View style={styles.form}>
            <TextInput style={styles.input} placeholder="Display Name" placeholderTextColor={TG_COLORS.textHint}
              value={form.displayName} onChangeText={update('displayName')} />
            <TextInput style={styles.input} placeholder="Username" placeholderTextColor={TG_COLORS.textHint}
              value={form.username} onChangeText={update('username')} autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={TG_COLORS.textHint}
              value={form.email} onChangeText={update('email')} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password (min. 8 chars)" placeholderTextColor={TG_COLORS.textHint}
              value={form.password} onChangeText={update('password')} secureTextEntry />

            <TouchableOpacity style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleRegister} disabled={isLoading}>
              <Text style={styles.buttonText}>{isLoading ? 'Creating...' : 'Create Account'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TG_COLORS.blue },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { alignItems: 'center', marginBottom: 32 },
  logoText: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 6 },
  logoSubtext: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12, marginBottom: 20 },
  input: { backgroundColor: TG_COLORS.bgSecondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#000' },
  button: { backgroundColor: TG_COLORS.blue, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontSize: 14 },
  linkBold: { color: '#fff', fontWeight: '700' },
});
