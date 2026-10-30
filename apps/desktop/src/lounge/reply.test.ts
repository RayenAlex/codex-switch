import { expect, it } from 'vitest';
import { parseMessage, type LoungeMessage } from '../../../../shared/lounge/types';
import { MAX_REPLY_TEXT, parseReply, quoteMessage } from '../../../../shared/lounge/reply';
import { historyText } from '../../../../shared/lounge/archive';

const original: LoungeMessage = { type: 'message', id: 'original', text: '😀'.repeat(400),
  sender: { id: 'bob', account: 'bob@example.test' }, images: ['data:image/png;base64,AAAA'],
  sentAt: new Date().toISOString() };
it('quotes a bounded Unicode excerpt with image count and no nested payloads', () => {
  const reply = quoteMessage(original);
  expect(Array.from(reply.text)).toHaveLength(MAX_REPLY_TEXT);
  expect(reply.text.endsWith('…')).toBe(true); expect(reply.imageCount).toBe(1);
  expect(parseReply({ ...reply, images: original.images, reply })).toEqual(reply);
  expect(parseReply({ ...reply, imageCount: -1 })).toBeUndefined();
  expect(parseReply({ ...reply, text: 'x'.repeat(MAX_REPLY_TEXT + 1) })).toBeUndefined();
});
it('preserves a reply for local history and indexes the quoted account and excerpt', () => {
  const reply = quoteMessage({ ...original, text: 'unique quoted text' });
  const parsed = parseMessage({ ...original, text: 'response', reply });
  expect(parsed?.reply).toEqual(reply);
  expect(historyText(parsed!)).toContain('unique quoted text');
  expect(parseMessage({ ...original, reply: { malicious: true } })?.reply).toBeUndefined();
});
