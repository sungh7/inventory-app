import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { authApi, setAuthToken, setUnauthorizedHandler } from "../api/client";

export interface AuthUser {
  id?: number;
  username?: string;
  role?: string;
  [key: string]: unknown;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  bootstrap: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "access_token";
const isWeb = typeof window !== "undefined";
const getStoredToken = async () => {
  if (isWeb) return window.localStorage.getItem(TOKEN_KEY);
  return AsyncStorage.getItem(TOKEN_KEY);
};
const setStoredToken = async (token: string | null) => {
  if (isWeb) {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
    return;
  }
  if (token) return AsyncStorage.setItem(TOKEN_KEY, token);
  return AsyncStorage.removeItem(TOKEN_KEY);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = async () => {
    setLoading(true);
    try {
      const storedToken = await getStoredToken();
      if (!storedToken) {
        setToken(null);
        setUser(null);
        return;
      }
      setToken(storedToken);
      setAuthToken(storedToken);
      const meRes = await authApi.me();
      setUser(meRes.data ?? null);
    } catch (error) {
      await setStoredToken(null);
      setToken(null);
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      const res = await authApi.login({ username, password });
      const accessToken = res.data?.access_token;
      if (!accessToken) throw new Error("No access token");
      await setStoredToken(accessToken);
      setToken(accessToken);
      setAuthToken(accessToken);
      const meRes = await authApi.me();
      setUser(meRes.data ?? null);
      router.replace("/(tabs)");
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    await setStoredToken(null);
    setToken(null);
    setUser(null);
    router.replace("/(auth)/login");
  };

  useEffect(() => {
    bootstrap();
    setUnauthorizedHandler(() => {
      signOut();
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, signIn, signOut, bootstrap }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
