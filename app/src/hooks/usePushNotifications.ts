import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { pushApi } from "../api/client";

// 포그라운드 알림 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  useEffect(() => {
    registerForPush();
  }, []);
}

async function registerForPush() {
  // 실기기 + 권한 필요
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("푸시 알림 권한 거부됨");
    return;
  }

  // Android 채널 설정
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("inventory", {
      name: "재고 알림",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    // [W-11] projectId 명시
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.expoConfig?.slug,
    })).data;
    await pushApi.registerToken(token);
    console.log("푸시 토큰 등록 완료:", token);
  } catch (e) {
    console.warn("푸시 토큰 등록 실패:", e);
  }
}
