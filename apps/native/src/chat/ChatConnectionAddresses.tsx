import { displayText } from '../i18n/index';
import { Text, View } from 'react-native';
import { connectionEndpointRows } from '../../../../shared/remote-chat/connectionEndpoints';
import { publicEndpointRows } from '../../../../shared/remote-chat/publicEndpoints';
import { t } from '../i18n';
import { useHealthStyles as useCss } from './connectionHealthStyles';
import type { ChatState } from './types';

export function ChatConnectionAddresses({ state }: { state: ChatState }) {
  const css = useCss();
  const current = connectionEndpointRows(state.mode, state.directEndpoints);
  return <>
    {current.length > 0 && <View style={css.addresses}>
      <Text style={css.label}>{t("client.chatReliability.currentP2pConnection")}</Text>
      {current.map(row => <View key={row.id} style={css.addressRow}>
        <Text style={css.label}>{displayText(row.label)}</Text>
        {row.address ? <Text selectable style={css.address}>{row.address}</Text>
          : <Text style={css.detail}>{t("client.chatReliability.currentlyUnavailable")}</Text>}
      </View>)}
      <Text style={css.detail}>{t("client.chatReliability.showsPublicAddressesForTheCurrentConnectionWhenConfirmedOtherwise")}</Text>
    </View>}
    <View style={css.addresses}>
      {publicEndpointRows(state.publicEndpoints).map(row => <View key={row.id} style={css.addressRow}>
        <Text style={css.label}>{displayText(row.label)}</Text>
        {row.addresses.length ? row.addresses.map(address =>
          <Text key={address} selectable style={css.address}>{address}</Text>)
          : <Text style={css.detail}>{t("client.chatReliability.notDetectedYet")}</Text>}
      </View>)}
      <Text style={css.detail}>{t("client.chatReliability.publicAddressesDetectedDuringThisConnection")}</Text>
    </View>
  </>;
}
