import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View, ActivityIndicator } from "react-native";
import { AuthProvider, useAuth } from "../src/context/AuthContext";

// [W-12] QueryClient 전역 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="register"
            options={{
              title: "신규 품목 등록",
              presentation: "modal",
              headerShown: true,
            }}
          />
        </>
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </AuthProvider>
  );
}
