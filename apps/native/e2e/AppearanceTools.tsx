import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { updateThemeMode, useThemeMode } from '../src/theme/store';
import { textMetrics } from '../src/theme/text';
import { ProjectBrowser } from '../src/chat/ProjectBrowser';
import { createProjectBrowserClient } from '../../../shared/project-browser/protocol';
import { browserRequest, browserRoot } from '../../desktop/e2e/project-browser-fixture';

const client = createProjectBrowserClient(browserRequest);

export function AppearanceTools() {
  const mode = useThemeMode();
  const [files, setFiles] = useState(false);
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Toggle theme" style={{ padding: 16 }}
      onPress={() => updateThemeMode(mode === 'dark' ? 'light' : 'dark')}>
      <Text style={textMetrics(14, 22)}>Theme: {mode}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Browse files" style={{ padding: 16 }}
      onPress={() => setFiles(true)}><Text style={textMetrics(14, 22)}>Browse files</Text></Pressable>
    {files && <ProjectBrowser client={client} cwd={browserRoot} connected active onClose={() => setFiles(false)} />}
  </View>;
}
