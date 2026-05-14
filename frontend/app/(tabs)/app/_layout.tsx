import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { UnreadNotificationsProvider, useUnreadNotifications } from '@/components/UnreadNotificationsContext';

function NotificationsTabIcon({ color }: { color: string }) {
  const { unread } = useUnreadNotifications();
  return (
    <View>
      <IconSymbol size={28} name="bell.fill" color={color} />
      {unread && (
        <View
          style={{
            position: 'absolute',
            right: -4,
            top: -2,
            backgroundColor: 'red',
            width: 9,
            height: 9,
            borderRadius: 5,
          }}
        />
      )}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <UnreadNotificationsProvider>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
        }}
      />
        <Tabs.Screen
          name="NotificationsScreen"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color }) => <NotificationsTabIcon color={color} />,
          }}
        />
    </Tabs>
    </UnreadNotificationsProvider>
  );
}
