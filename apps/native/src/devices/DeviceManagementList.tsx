import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { AccountSummary, RemoteDevice, RemoteProviderSummary } from '../types';
import { DeviceCard } from './DeviceCard';
import { DeviceOptionsMenu } from './DeviceOptionsMenu';
import { deviceColors, useStyles } from './styles';

interface DeviceManagementListProps {
  devices: RemoteDevice[];
  accounts: AccountSummary[];
  providers: RemoteProviderSummary[];
  refreshing: boolean;
  deletingDeviceId: string | null;
  switchingModelDeviceId: string | null;
  switchingAuthDeviceId: string | null;
  onRefresh: () => Promise<void>;
  onDelete: (device: RemoteDevice) => void;
  onRevokeService: (device: RemoteDevice) => void;
  onScreenControl: (device: RemoteDevice, enabled: boolean) => void;
  onSwitchModel: (deviceId: string) => void;
  onSelectAuthAccount: (deviceId: string) => void;
}

function DeviceOverview({ devices }: { devices: RemoteDevice[] }) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const online = devices.filter((device) => device.online).length;
  return <View style={styles.summary}>
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name="phone-portrait-outline" size={20} color={color(deviceColors.green, 'accent')} />
      </View>
      <Text style={styles.statLabel}>{t("client.app.onlineNow")}</Text>
      <Text style={styles.statValue}>{online}</Text>
    </View>
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name="layers-outline" size={20} color={color(deviceColors.green, 'accent')} />
      </View>
      <Text style={styles.statLabel}>{t("client.app.allDevices")}</Text>
      <Text style={styles.statValue}>{devices.length}</Text>
    </View>
  </View>;
}

export function DeviceManagementList(props: DeviceManagementListProps) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [menuDeviceId, setMenuDeviceId] = useState<string | null>(null);
  const { devices, refreshing, onRefresh } = props;
  const menuDevice = devices.find((device) => device.deviceId === menuDeviceId) ?? null;
  return <>
    <ScrollView style={styles.page} contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()}
        tintColor={color(deviceColors.green, 'accent')} colors={[deviceColors.green]} />}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t("client.app.devices.7e708d")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("client.app.refreshDeviceList")} disabled={refreshing}
          accessibilityState={{ disabled: refreshing, busy: refreshing }} onPress={() => void onRefresh()}
          style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}>
          {refreshing ? <ActivityIndicator color={color(deviceColors.green, 'accent')} />
            : <Ionicons name="sync-outline" size={23} color={color(deviceColors.green, 'accent')} />}
        </Pressable>
      </View>
      <Text style={styles.subtitle}>{t("client.app.viewDeviceStatusAndSelectACardToSwitchModels")}</Text>
      <DeviceOverview devices={devices} />
      {devices.map((device) => <DeviceCard key={device.deviceId} device={device}
        accounts={props.accounts} providers={props.providers}
        busy={props.switchingModelDeviceId === device.deviceId || props.deletingDeviceId === device.deviceId}
        onSwitchModel={() => props.onSwitchModel(device.deviceId)}
        onOpenMenu={() => setMenuDeviceId(device.deviceId)} />)}
      {devices.length ? <View style={styles.hint}>
        <Ionicons name="information-circle-outline" size={23} color={color(deviceColors.green, 'accent')} />
        <Text style={styles.hintText}>{t("client.app.onlineDevicesCannotBeRemoved")}{'\n'}{t("client.app.signOutOnTheDeviceBeforeRemovingIt")}</Text>
      </View> : <View style={styles.empty}>
        <Ionicons name="desktop-outline" size={40} color={color(deviceColors.green, 'accent')} />
        <Text style={styles.emptyTitle}>{t("client.app.noDevicesYet")}</Text>
        <Text style={styles.emptyText}>{t("client.app.signInWithTheSameAccountOnYourComputerTo")}</Text>
      </View>}
    </ScrollView>
    <DeviceOptionsMenu device={menuDevice} deletingDeviceId={props.deletingDeviceId}
      onScreenControl={props.onScreenControl}
      switchingAuthDeviceId={props.switchingAuthDeviceId} onClose={() => setMenuDeviceId(null)}
      onDelete={props.onDelete} onRevokeService={props.onRevokeService} onSelectAuthAccount={props.onSelectAuthAccount} />
  </>;
}
