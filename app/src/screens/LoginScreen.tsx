import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력하세요");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signIn(username.trim(), password);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "로그인 실패";
      setError(msg);
      console.error("Login error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>재고관리 시스템</Text>
      <Text style={styles.subtitle}>관리자 로그인</Text>

      <TextInput
        style={styles.input}
        placeholder="아이디"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "로그인 중..." : "로그인"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f5f5f5" },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8, color: "#333" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  input: {
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
  },
  button: {
    width: "100%",
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#e53935", marginBottom: 10, fontSize: 14, textAlign: "center" },
});
