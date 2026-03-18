import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';

// Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ChatsScreen } from '../screens/main/ChatsScreen';
import { ChatScreen } from '../screens/main/ChatScreen';
import { ContactsScreen } from '../screens/main/ContactsScreen';
import { SettingsScreen } from '../screens/main/SettingsScreen';
import { StoriesScreen } from '../screens/main/StoriesScreen';
import { CallScreen } from '../screens/main/CallScreen';

import { useAuthStore } from '../store/authStore';
import { TGIcon } from '../components/TGIcon';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Chat: { chatId: string; chatName: string };
  Call: { callId: string; chatId: string; type: 'AUDIO' | 'VIDEO'; isIncoming?: boolean };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type TabParamList = {
  Chats: undefined;
  Stories: undefined;
  Contacts: undefined;
  Settings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2AABEE',
        tabBarInactiveTintColor: '#707579',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#E4E4E6',
          height: Platform.OS === 'ios' ? 84 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color }) => <TGIcon name="chat" color={color} />,
        }}
      />
      <Tab.Screen
        name="Stories"
        component={StoriesScreen}
        options={{
          tabBarLabel: 'Stories',
          tabBarIcon: ({ color }) => <TGIcon name="stories" color={color} />,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarLabel: 'Contacts',
          tabBarIcon: ({ color }) => <TGIcon name="people" color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <TGIcon name="settings" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { token } = useAuthStore();

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={TabNavigator} />
            <RootStack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Call"
              component={CallScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
