import React from "react";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { IconSymbol } from "@/components/IconSymbol";

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <IconSymbol ios_icon_name="house.fill" android_material_icon_name="home" size={24} color="#1B6B3A" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(groups)">
        <IconSymbol ios_icon_name="person.3.fill" android_material_icon_name="group" size={24} color="#1B6B3A" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(wallet)">
        <IconSymbol ios_icon_name="wallet.pass.fill" android_material_icon_name="account_balance_wallet" size={24} color="#1B6B3A" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(profile)">
        <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={24} color="#1B6B3A" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
