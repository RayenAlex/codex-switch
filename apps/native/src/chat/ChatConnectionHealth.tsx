import { displayText } from '../i18n/index';
import { useThemeColor } from '../theme/store';
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { t, useLanguage } from '../i18n';
import { connectionHealth, healthStatusLabels, HEALTH_INLINE_STATUS_MAX_CHARACTERS,
  type HealthStatus, type HealthStep } from '../../../../shared/remote-chat/connectionHealth';
import type { ChatState } from './types';
import { ChatConnectionAddresses } from './ChatConnectionAddresses';
import { useHealthStyles as useCss, healthTones, stepTones } from './connectionHealthStyles';

type IconName = ComponentProps<typeof Feather>['name'];
const stepIcons: Record<HealthStep['id'], IconName> = {
  login: 'user', computer: 'monitor', path: 'share-2', chat: 'message-square',
};
const statusIcons: Record<HealthStatus, IconName> = { ok: 'check', waiting: 'clock', blocked: 'alert-circle' };

export function ChatConnectionHealth({ state, device, reconnect, close }: {
  state: ChatState; device?: { online: boolean }; reconnect: () => void; close: () => void;
}) {
  const css = useCss();
  const color = useThemeColor();
  useLanguage();
  const health = connectionHealth(state, device);
  const tone = healthTones(color)[health.status];
  return <BottomSheet visible title={t("client.chatReliability.connectionCheck")} subtitle={t("client.chatReliability.checkTheConnectionBetweenThisDeviceAndYourComputer")}
    onClose={close} maxWidth={400} fullWidthContent>
    <SheetScrollView contentContainerStyle={css.content}>
      <View style={[css.summary, { backgroundColor: tone.background }]} accessibilityLiveRegion="polite">
        <View style={[css.summaryIcon, { backgroundColor: tone.color }]}>
          <Feather name={statusIcons[health.status]} size={22} color="#fff" accessible={false} />
        </View>
        <View style={css.copy}>
          <Text style={[css.summaryTitle, { color: tone.color }]}>{displayText(health.title)}</Text>
          <Text style={css.detail}>{displayText(health.description)}</Text>
        </View>
      </View>
      <View style={css.steps}>{health.steps.map(step => <HealthRow key={step.id} step={step} />)}</View>
      <ChatConnectionAddresses state={state} />
      <View style={css.note}>
        <Feather name="info" size={22} color={color("#6782df", 'info')} accessible={false} />
        <View style={css.copy}>
          <Text style={css.label}>{displayText(health.nextTitle)}</Text>
          <Text style={css.detail}>{displayText(health.next)}</Text>
        </View>
      </View>
      {health.reconnect && <Pressable accessibilityRole="button" onPress={reconnect}
        style={({ pressed }) => [css.button, pressed && css.pressed]}>
        <Feather name="refresh-cw" size={16} color="#fff" accessible={false} />
        <Text style={css.buttonLabel}>{t("client.mobile.reconnect")}</Text>
      </Pressable>}
    </SheetScrollView>
  </BottomSheet>;
}

function HealthRow({ step }: { step: HealthStep }) {
  const css = useCss();
  const color = useThemeColor();
  const tone = healthTones(color)[step.status];
  const iconTone = stepTones(color)[step.id];
  const statusLabel = displayText(healthStatusLabels[step.status]);
  const inlineStatus = statusLabel.length <= HEALTH_INLINE_STATUS_MAX_CHARACTERS;
  const badge = <View style={[css.badge, !inlineStatus && css.wideBadge, { backgroundColor: tone.background }]}>
    <View style={[css.badgeIcon, { backgroundColor: tone.color }]}>
      <Feather name={statusIcons[step.status]} size={10} color="#fff" accessible={false} />
    </View>
    <Text style={[css.badgeLabel, { color: tone.color }]}>{statusLabel}</Text>
  </View>;
  return <View style={css.step}>
    <View style={[css.stepIcon, { backgroundColor: iconTone.background }]}>
      <Feather name={stepIcons[step.id]} size={22} color={iconTone.color} accessible={false} />
    </View>
    <View style={css.copy}>
      <Text style={css.label}>{displayText(step.label)}</Text>
      <Text style={css.detail}>{displayText(step.detail)}</Text>
      {!inlineStatus && badge}
    </View>
    {inlineStatus && badge}
  </View>;
}
