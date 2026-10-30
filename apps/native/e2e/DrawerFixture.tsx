import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Feather, Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatDrawer, type ChatDrawerMethods } from '../src/chat/ChatDrawer';
import { ChatDrawerSurface } from '../src/chat/ChatDrawerSurface';
import { ChatMessages } from '../src/chat/ChatMessages';
import { ChatThreadList } from '../src/chat/ChatThreadList';
import { useChatDrawerSwipe } from '../src/chat/useChatDrawerSwipe';
import { initialChatState, type Thread } from '../src/chat/types';
import type { ChatController } from '../src/chat/controller';

const threads = Array.from({ length: 30 }, (_, index): Thread => ({
  id: `drawer-${index}`, name: `聊天列表 ${index + 1}`, preview: '', updatedAt: 30 - index, cwd: '',
}));
const history = Array.from({ length: 30 }, (_, index) => ({
  id: `message-${index}`, type: 'agentMessage', text: `消息 ${index + 1}：连续输出期间拖动聊天列表。`,
}));
const controller = { list: async () => undefined } as unknown as ChatController;
const busy = () => setTimeout(() => {
  // Deliberately occupy JS while native input and drawing continue; this must never run in production.
  const end = performance.now() + 1600;
  while (performance.now() < end) { /* Simulated chat processing. */ }
}, 300);

function Fixture() {
  const [fonts] = useFonts({ ...Feather.font, ...Ionicons.font });
  const drawer = useRef<ChatDrawerMethods>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(threads[0]);
  const [actions, setActions] = useState('');
  const [next, setNext] = useState(0);
  const swipe = useChatDrawerSwipe(!open, () => setNext(value => value + 1));
  useEffect(() => {
    const interval = setInterval(() => setStep(value => value + 1), 80);
    return () => clearInterval(interval);
  }, []);
  if (!fonts) return null;
  const thread: Thread = { ...selected, turns: [{ id: 'turn', status: 'inProgress', items: [...history,
    { id: 'stream', type: 'agentMessage', text: `正在回复 ${step}。${'连续输出内容。'.repeat(step % 80)}` }] }] };
  const state = { ...initialChatState(), threads, selected, ready: true, search: '聊天' };
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={{ flexDirection: 'row', gap: 20, padding: 12 }}>
      <Pressable testID="open-drawer" onPress={() => drawer.current?.openDrawer()}><Text>打开聊天列表</Text></Pressable>
      <Pressable testID="busy-js" onPress={busy}><Text>Busy JS</Text></Pressable>
      <Text testID="drawer-state">{open ? 'open' : 'closed'} / {next} / {actions}</Text>
    </View>
    <ChatDrawer ref={drawer} enabled onOpen={() => setOpen(true)} onClose={() => setOpen(false)}
      onMoving={() => undefined}
      navigation={<ChatThreadList state={state} controller={controller} bottomInset={0}
        newChat={() => undefined} openActions={item => setActions(item.id)}
        openProjectActions={project => setActions(project.cwd)}
        select={item => { setSelected(item); drawer.current?.closeDrawer(); }} />}>
      <ChatDrawerSurface enabled {...swipe}>
        <ChatMessages thread={thread} loadOlder={async () => undefined} />
      </ChatDrawerSurface>
    </ChatDrawer>
  </SafeAreaView></SafeAreaProvider>;
}

registerRootComponent(Fixture);
