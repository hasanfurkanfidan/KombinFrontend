import { Tabs, router } from 'expo-router';

import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wardrobe" />
      <Tabs.Screen
        name="add"
        listeners={{
          // The raised "+" opens the outfit builder on top of the tabs instead of switching to a tab.
          tabPress: (event) => {
            event.preventDefault();
            router.push('/outfits/daily');
          },
        }}
      />
      <Tabs.Screen name="tracking" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
