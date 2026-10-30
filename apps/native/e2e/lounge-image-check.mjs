import assert from 'node:assert/strict';
import { prepareHierarchy } from '../../desktop/e2e/android-hierarchy.mjs';

/** Exercise actual multitouch and compare rendered pixels, including previews above history. */
export async function verifyNativeImage(options) {
  const { adb, tap, find, screenshot, output, scale } = options;
  await prepareHierarchy({ adb, output });
  const gesture = async direction => {
    const result = await adb('shell', 'uiautomator', 'runtest', '/system/framework/android.test.base.jar',
      '/data/local/tmp/chat-hierarchy.jar', '-c', 'dev.codexswitch.testing.ImageGestureTest',
      '-e', 'label', '聊天图片', '-e', 'keepOpen', '返回聊天', '-e', 'direction', direction);
    assert.ok(result.includes('OK (1 test)'), result);
    await screenshot(`image-${direction}-${scale}`);
  };
  await tap('查看图片'); await find('返回聊天'); await screenshot(`image-fit-${scale}`);
  await gesture('out'); await gesture('in'); await gesture('pan');
  await tap('返回聊天'); await find('添加内容');
  await tap('添加内容'); await tap('历史记录'); await tap('查看图片');
  await gesture('out');
  await adb('shell', 'input', 'keyevent', '4');
  await find('搜索消息或账户'); await tap('返回聊天'); await find('添加内容');
  console.log(`PASS native lounge image pinch, pan and history at font scale ${scale}`);
}
