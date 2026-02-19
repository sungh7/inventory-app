import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { usePushNotifications } from "../../src/hooks/usePushNotifications";

export default function TabLayout() {
  usePushNotifications();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#4CAF50", headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "재고",
          tabBarIcon: ({ color }) => <MaterialIcons name="inventory" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "스캔",
          tabBarIcon: ({ color }) => <MaterialIcons name="qr-code-scanner" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="operations"
        options={{
          title: "운영",
          tabBarIcon: ({ color }) => <MaterialIcons name="storefront" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "분석",
          tabBarIcon: ({ color }) => <MaterialIcons name="insights" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "더보기",
          tabBarIcon: ({ color }) => <MaterialIcons name="more-horiz" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
