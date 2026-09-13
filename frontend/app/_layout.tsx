import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import Feather from "@react-native-vector-icons/feather";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";

LogBox.ignoreAllLogs(true);

// Prewarm vector icons so Expo Go Android doesn't render tofu.
async function prewarmIcons() {
  try {
    // @ts-ignore
    await Feather.loadFont?.();
  } catch {}
}

export default function RootLayout() {
  useEffect(() => {
    prewarmIcons();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </QueryClientProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
