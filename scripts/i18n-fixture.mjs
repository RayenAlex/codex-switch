import { readdirSync, readFileSync } from 'node:fs';

// Node fixtures read resources directly; production TypeScript is loaded by each application's bundler.
const resources = new Map();

export function clientMessages(language = 'zh') {
  if (!resources.has(language)) {
    const directory = new URL(`../packages/i18n/src/catalogs/client/${language}/`, import.meta.url);
    resources.set(language, Object.assign({}, ...readdirSync(directory).filter(file => file.endsWith('.json'))
      .map(file => JSON.parse(readFileSync(new URL(file, directory), 'utf8')))));
  }
  return resources.get(language);
}

export function testText(key, values = {}, language = 'zh') {
  const messages = clientMessages(language);
  return (Object.hasOwn(messages, key) ? messages[key] : key).replace(/\{(\w+)\}/g,
    (placeholder, name) => Object.hasOwn(values, name) ? String(values[name]) : placeholder);
}
