import assert from 'node:assert/strict';

export async function verifyNativeEmoji({ adb, tap, find, nodes, screenshot, scale, sent }) {
  const keyboardVisible = async () => (await adb('shell', 'dumpsys', 'input_method')).includes('mInputShown=true');
  const top = node => Number(node.bounds.match(/\[\d+,(\d+)\]/)[1]);
  await tap('消息'); await adb('shell', 'input', 'text', 'ab');
  await adb('shell', 'input', 'keyevent', '21');
  assert.ok(await keyboardVisible(), 'Tapping the input opens the keyboard');
  const keyboardInput = await find('消息');
  await screenshot(`emoji-keyboard-${scale}`);
  await tap('表情'); await find('😀');
  assert.equal(await keyboardVisible(), false, 'Emoji panel replaces the keyboard');
  const panelInput = await find('消息');
  assert.ok(Math.abs(top(panelInput) - top(keyboardInput)) < 60,
    `Composer stays above the keyboard-sized panel: ${top(panelInput)} vs ${top(keyboardInput)}`);
  await tap('😀'); await tap('😂'); await tap('😊');
  assert.equal((await find('消息')).text, 'a😀😂😊b', 'Emojis advance the cursor between existing text');
  assert.equal(await keyboardVisible(), false, 'Repeated insertion must not reopen the keyboard');
  await find('😀'); await screenshot(`emoji-panel-${scale}`);
  await tap('发送');
  assert.equal(sent.at(-1).text, 'a😀😂😊b');
  await find('😀'); await tap('😀');
  assert.equal((await find('消息')).text, '😀', 'Cursor is clamped after sending');
  await tap('消息');
  assert.ok(await keyboardVisible(), 'Input tap returns to text entry');
  assert.ok(!(await nodes()).some(node => node['content-desc'] === '😂'), 'Panel closes for the keyboard');
  await tap('表情'); await find('😂');
  await tap('表情');
  assert.ok(await keyboardVisible(), 'The active toggle also returns to the keyboard');
  await tap('表情'); await find('😂');
  await adb('shell', 'input', 'keyevent', '4'); await find('聊天');
  assert.ok(!(await nodes()).some(node => node['content-desc'] === '😂'), 'Back closes the panel before leaving chat');
  await tap('表情'); await tap('添加内容'); await find('添加图片');
  await adb('shell', 'input', 'keyevent', '4'); await tap('返回聊天列表');
  await tap('返回发现'); await find('在线交流');
  console.log(`PASS native emoji docking, cursor, send, keyboard toggle and back at font scale ${scale}`);
}
