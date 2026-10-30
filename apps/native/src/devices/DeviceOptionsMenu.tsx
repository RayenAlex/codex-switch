import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView, SHEET_READABLE_WIDTH } from '../components/SheetScrollView';
import { supportsScreenControl } from '../../../../shared/remote-desktop/screenControl';
import type { RemoteDevice } from '../types';
import { deviceColors, useStyles } from './styles';

interface DeviceOptionsMenuProps {
  device: RemoteDevice | null;
  deletingDeviceId: string | null;
  switchingAuthDeviceId: string | null;
  onClose: () => void;
  onDelete: (device: RemoteDevice) => void;
  onRevokeService: (device: RemoteDevice) => void;
  onScreenControl: (device: RemoteDevice, enabled: boolean) => void;
  onSelectAuthAccount: (deviceId: string) => void;
}

export function DeviceOptionsMenu(props: DeviceOptionsMenuProps) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [confirmScreen, setConfirmScreen] = useState(false);
  useEffect(() => setConfirmScreen(false), [props.device?.deviceId]);
  const { device, deletingDeviceId, switchingAuthDeviceId, onClose, onDelete, onSelectAuthAccount } = props;
  if (!device) return null;
  const deleteDisabled = device.online || Boolean(deletingDeviceId);
  const authDisabled = !device.online || Boolean(switchingAuthDeviceId);
  return <BottomSheet visible title={confirmScreen ? t('client.deviceScreen.confirmTitle') : device.name}
    subtitle={confirmScreen ? device.name : undefined} onClose={onClose}
    fullWidthContent maxWidth={SHEET_READABLE_WIDTH}
    actions={confirmScreen ? [{ label: t('client.deviceScreen.turnOff'), tone: 'primary', disabled: !device.online,
      onPress: () => { onClose(); props.onScreenControl(device, true); } }] : []}>
    <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.optionsContent}>
      {confirmScreen ? <Text style={styles.screenExplanation}>{t('client.deviceScreen.confirmMessage')}</Text> : <>
        {supportsScreenControl(device) && <>
          <Pressable accessibilityRole="button" disabled={!device.online}
            accessibilityState={{ disabled: !device.online }} onPress={() => setConfirmScreen(true)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed, !device.online && styles.disabled]}>
            <Ionicons name="desktop-outline" size={21} color={color(deviceColors.green, 'accent')} />
            <Text style={styles.optionLabel}>{t('client.deviceScreen.turnOff')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!device.online}
            accessibilityState={{ disabled: !device.online }}
            onPress={() => { onClose(); props.onScreenControl(device, false); }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed, !device.online && styles.disabled]}>
            <Ionicons name="sunny-outline" size={21} color={color(deviceColors.green, 'accent')} />
            <Text style={styles.optionLabel}>{t('client.deviceScreen.restore')}</Text>
          </Pressable>
        </>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: authDisabled }} disabled={authDisabled}
          onPress={() => { onClose(); onSelectAuthAccount(device.deviceId); }}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, authDisabled && styles.disabled]}>
          <Ionicons name="open-outline" size={21} color={color(deviceColors.green, 'accent')} />
          <Text style={styles.optionLabel}>{t("client.app.proxySignInAccount")}</Text>
          {switchingAuthDeviceId === device.deviceId && <ActivityIndicator color={color(deviceColors.green, 'accent')} />}
        </Pressable>
        {device.platform.toLowerCase() === 'windows' && <Pressable accessibilityRole="button"
          onPress={() => { onClose(); props.onRevokeService(device); }} style={styles.option}>
          <Ionicons name="lock-closed-outline" size={21} color={color(deviceColors.danger, 'danger')} />
          <Text style={[styles.optionLabel, styles.danger]}>{t("client.mobile.revokeUnattendedAccess")}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button"
          accessibilityState={{ disabled: deleteDisabled }} disabled={deleteDisabled}
          onPress={() => { onClose(); onDelete(device); }}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, deleteDisabled && styles.disabled]}>
          <Ionicons name="trash-outline" size={21} color={color(deviceColors.danger, 'danger')} />
          <Text style={[styles.optionLabel, styles.danger]}>{device.online ? t("client.app.cannotRemoveWhileOnline") : t("client.app.removeDevice")}</Text>
          {deletingDeviceId === device.deviceId && <ActivityIndicator color={color(deviceColors.danger, 'danger')} />}
        </Pressable>
        {!device.online && <Text style={styles.hintText}>{t("client.mobile.connectTheDeviceToChangeItsProxySignInAccount")}</Text>}
        </>}
    </SheetScrollView>
  </BottomSheet>;
}
