import { Tabs } from 'expo-router';
import { View, Platform } from 'react-native';
import { Home, Search, Library } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { CrossMark } from '../../src/components/Primitives';
import { colors, fonts } from '../../src/theme/colors';

/** Teaching icon — open book with vertical spine */
const TeachingIcon = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6}>
    <Path d="M4 4h6a3 3 0 013 3v13M20 4h-6a3 3 0 00-3 3" />
  </Svg>
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.oxblood,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarLabelStyle: {
          fontFamily: fonts.ui,
          fontSize: 10,
          letterSpacing: 0.4,
        },
        tabBarStyle: {
          backgroundColor: colors.parchmentTranslucent,
          borderTopColor: colors.rule,
          borderTopWidth: 1,
          paddingTop: 6,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} strokeWidth={1.6} color={color} />,
        }}
      />
      <Tabs.Screen
        name="teaching"
        options={{
          title: 'Teaching',
          tabBarIcon: ({ color }) => <TeachingIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <Search size={22} strokeWidth={1.6} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bible"
        options={{
          title: 'Bible',
          tabBarIcon: ({ color }) => (
            <CrossMark size={20} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <Library size={22} strokeWidth={1.6} color={color} />,
        }}
      />
    </Tabs>
  );
}
