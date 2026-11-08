import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="wardrobe" />
      <Tabs.Screen name="prices" />
      <Tabs.Screen name="profile" />
      {/* Old links only: the bar has no button for them (see `TAB_ITEMS`). */}
      <Tabs.Screen name="tracking" options={{ href: null }} />
      <Tabs.Screen name="add" options={{ href: null }} />
    </Tabs>
  );
}
