import { useMemo, useState } from 'react';
import { Button, Text, View } from 'react-native';
import type { SshApi } from '../../../shared/terminal/ssh';
import type { SshProfile } from '../../../shared/terminal/sshProfiles';
import { SshConnectionSheet } from '../src/chat/terminal/SshConnectionSheet';
import { SshQuickConnectSheet } from '../src/chat/terminal/SshQuickConnectSheet';
import { textMetrics } from '../src/theme/text';

const original: SshProfile = { id: 'test', name: 'Saved server', host: 'fixture.test', port: 22,
  username: 'test', auth: 'password', fingerprint: 'SHA256:oldNakyMCpeFh2x7RehitF9R4Kvmf6C6BJQvGmfgPffS8', revision: 1 };
export function SshHostKeyFixture() {
  const [entry, setEntry] = useState<'edit' | 'quick'>();
  const [result, setResult] = useState('');
  const api = useMemo<SshApi>(() => {
    let profiles = [original];
    return {
      profiles: { list: async () => profiles, credentials: async () => ({ password: 'fixture' }),
        remove: async () => [], save: async value => {
          profiles = [{ ...value, revision: (value.revision ?? 0) + 1 }];
          setResult(`Saved ${value.fingerprint}`); return profiles;
        } },
      probe: async () => 'SHA256:newNakyMCpeFh2x7RehitF9R4Kvmf6C6BJQvGmfgPffS8',
      open: async () => ({ id: 'fixture', shell: 'SSH', cwd: '' }), files: async () => ({ type: 'done' }),
    };
  }, [entry]);
  const props = { api, cwd: '/', connected: () => {}, dispose: async () => {}, close: () => setEntry(undefined) };
  return <View><Button title="Fingerprint quick" onPress={() => setEntry('quick')} />
    <Button title="Fingerprint edit" onPress={() => setEntry('edit')} />
    <Text style={textMetrics(16, 24)}>{result}</Text>
    {entry === 'quick' && <SshQuickConnectSheet {...props} profile={original} />}
    {entry === 'edit' && <SshConnectionSheet {...props} />}
  </View>;
}
