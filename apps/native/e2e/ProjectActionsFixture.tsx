import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatController } from '../../../shared/remote-chat/client/controller';
import { ChatThreads } from '../src/chat/ChatThreads';
import type { ChatController as NativeController } from '../src/chat/controller';
import { setInterfaceLanguage } from '../../../shared/localization/interfaceLanguage';

setInterfaceLanguage('zh');

function createController() {
  const threads = [{ id: 'one', name: '项目里的对话', cwd: '/project', preview: '', updatedAt: 2 },
    { id: 'two', name: '其他项目的对话', cwd: '/other', preview: '', updatedAt: 1 }];
  let pinnedProjects: string[] = [];
  let revision = 0;
  const sidebar = () => ({ revision: ++revision, pinnedProjects, pins: [], readState: {},
    threads: Object.fromEntries(threads.map(thread => [thread.id, { cwd: thread.cwd,
      projectName: thread.cwd === '/project' ? '项目文件夹中文显示测试' : '其他项目', title: thread.name, running: false }])) });
  return new ChatController(events => ({
    start() { events.mode('relay'); events.ready(); }, stop() {},
    async request<T>(method: string, body?: unknown): Promise<T> {
      if (method === 'connect') return [] as T;
      const input = body as { operation: string; cwd?: string; pinned?: boolean };
      if (input.operation === 'list') return { data: threads, nextCursor: null, sidebar: sidebar() } as T;
      if (input.operation === 'guiProjectPin') pinnedProjects = input.pinned ? [input.cwd!] : [];
      if (input.operation === 'guiProjectRemove') {
        pinnedProjects = [];
        threads.forEach(thread => { if (thread.cwd === input.cwd) thread.cwd = ''; });
      }
      return (input.operation.startsWith('guiProject') ? sidebar() : { data: [], nextCursor: null }) as T;
    },
  }));
}

function ProjectActionsFixture() {
  const [controller] = useState(createController);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [fontsReady] = useFonts(Feather.font);
  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    {fontsReady && <ChatThreads state={state} controller={controller as NativeController}
      newChat={() => {}} select={() => {}} openSearch={() => {}} profileMenu={null} />}
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(ProjectActionsFixture);
