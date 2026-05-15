import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
  EBGaramond_500Medium_Italic,
} from '@expo-google-fonts/eb-garamond';
import {
  NotoSerifEthiopic_400Regular,
  NotoSerifEthiopic_500Medium,
} from '@expo-google-fonts/noto-serif-ethiopic';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
} from '@expo-google-fonts/jetbrains-mono';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    EBGaramond_500Medium_Italic,
    NotoSerifEthiopic_400Regular,
    NotoSerifEthiopic_500Medium,
    Inter_400Regular,
    Inter_500Medium,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="article/[slug]" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}
