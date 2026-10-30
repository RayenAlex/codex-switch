import { useThemeColor } from '../theme/store';
import { getLocale, t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { AccountSummary, RemoteDevice, RemoteProviderSummary } from '../types';
import { remoteModelOptions, type RemoteModelTarget } from '../../../../shared/remote-chat/modelTarget';
import { deviceColors, useStyles } from './styles';

type IconName = keyof typeof Ionicons.glyphMap;

function platformInfo(platform: string): { label: string; icon: IconName } {
  switch (platform.trim().toLowerCase()) {
    case 'windows': return { label: 'Windows', icon: 'logo-windows' };
    case 'darwin':
    case 'macos': return { label: 'macOS', icon: 'logo-apple' };
    case 'linux': return { label: 'Linux', icon: 'logo-tux' };
    default: return { label: platform || t("client.app.unknownPlatform"), icon: 'desktop-outline' };
  }
}

function modelLabel(device: RemoteDevice, accounts: AccountSummary[], providers: RemoteProviderSummary[],
  target: RemoteModelTarget) {
  const selection = remoteModelOptions(device, target);
  const account = accounts.find(item => item.id === selection.accountId);
  const provider = providers.find(item => item.id === selection.providerId);
  if (selection.group) return t("client.app.group", { value1: selection.group });
  if (!selection.providerId) return account ? t("client.app.official", { value1: account.email }) : t("client.app.notSelected");
  if (!provider) return t("client.app.modelInformationUnavailable");
  return `${provider.name}${provider.model ? ` · ${provider.model}` : ''}`;
}

function lastSeenLabel(device: RemoteDevice) {
  if (device.online) return t("client.app.onlineNow");
  const date = new Date(device.lastSeenAt);
  if (Number.isNaN(date.getTime())) return t("client.app.unknownTime");
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

function DeviceDetail({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  return <View style={styles.detail}>
    <Ionicons name={icon} size={17} color={color(deviceColors.muted, 'muted')} />
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>;
}

function DeviceIdentity({ device, busy }: { device: RemoteDevice; busy: boolean }) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const platform = platformInfo(device.platform);
  return <View style={[styles.cardTop, styles.topInset]}>
    <View style={styles.platform}><Ionicons name={platform.icon} size={25} color={color(deviceColors.green, 'accent')} /></View>
    <View style={styles.identity}>
      <Text style={styles.name} numberOfLines={2}>{device.name}</Text>
      <Text style={styles.meta}>{platform.label}{device.appVersion ? ` · v${device.appVersion}` : ''}</Text>
    </View>
    <View style={[styles.badge, !device.online && styles.badgeOffline]}>
      {busy ? <ActivityIndicator size="small" color={color(deviceColors.green, 'accent')} />
        : <View style={[styles.dot, !device.online && styles.dotOffline]} />}
      <Text style={[styles.badgeText, !device.online && styles.muted]}>{device.online ? t("client.chat.online") : t("client.chat.offline")}</Text>
    </View>
  </View>;
}

export function DeviceCard({ device, accounts, providers, busy, onSwitchModel, onOpenMenu }: {
  device: RemoteDevice;
  accounts: AccountSummary[];
  providers: RemoteProviderSummary[];
  busy: boolean;
  onSwitchModel: () => void;
  onOpenMenu: () => void;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const account = accounts.find((item) => item.id === device.activeAccountId);
  const authAccount = accounts.find((item) => item.id === device.openaiAuthAccountId);
  const disabled = !device.online || busy;
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${device.name}，${device.online ? t("client.chat.online") : t("client.chat.offline")}`}
      accessibilityHint={device.online ? t("client.mobile.openModelSelection") : t("client.mobile.connectTheDeviceToSwitchModels")}
      accessibilityState={{ disabled, busy }} disabled={disabled} onPress={onSwitchModel}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <DeviceIdentity device={device} busy={busy} />
      <View style={styles.divider} />
      <DeviceDetail icon="person-outline" label={t("client.app.proxyApi")} value={modelLabel(device, accounts, providers, 'proxy')} />
      {device.capabilities.includes('gui-model-switch') && <DeviceDetail icon="desktop-outline" label="Codex GUI"
        value={modelLabel(device, accounts, providers, 'gui')} />}
      <DeviceDetail icon="server-outline" label={t("client.app.deviceAccount")}
        value={account?.email ?? (device.activeAccountId ? t("client.app.accountInformationUnavailable") : t("client.app.notSelected"))} />
      <DeviceDetail icon="key-outline" label={t("client.app.proxySignIn")}
        value={authAccount?.email ?? (device.openaiAuthAccountId ? t("client.app.accountInformationUnavailable") : t("client.accounts.notSet"))} />
      <DeviceDetail icon="time-outline" label={t("client.app.lastOnline")} value={lastSeenLabel(device)} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t("client.app.moreActionsFor", { value1: device.name })}
      onPress={onOpenMenu} style={({ pressed }) => [styles.menuTrigger, pressed && styles.pressed]}>
      <Ionicons name="ellipsis-vertical" size={20} color={color(deviceColors.muted, 'muted')} />
    </Pressable>
  </View>;
}
