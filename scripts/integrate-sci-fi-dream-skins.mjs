import { scienceFictionThemes } from '@remoteai/i18n/tooling/dream-skin';
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktop = path.join(root, "apps", "desktop");
const presetsRoot = path.join(desktop, "src-tauri", "resources", "dream-skin", "presets");

const themes = scienceFictionThemes();

if (themes.length !== 100) {
  throw new Error(`Expected 100 themes, got ${themes.length}`);
}

for (const theme of themes) {
  const dir = path.join(presetsRoot, theme.id);
  for (const filename of ["background.jpg", "theme.json"]) {
    if (!fs.existsSync(path.join(dir, filename))) {
      throw new Error(`Missing ${theme.id}/${filename}`);
    }
  }
}

const builtInsPath = path.join(desktop, "src", "dreamSkinBuiltIns.ts");
let builtIns = fs.readFileSync(builtInsPath, "utf8");
const builtInInsertAt = builtIns.indexOf("] as const satisfies readonly BuiltInDreamSkinTheme[];");
if (builtInInsertAt < 0) throw new Error("Cannot find built-in theme insertion point");
const builtInEntries = themes
  .filter((theme) => !builtIns.includes(`id: "${theme.id}"`))
  .map(
    (theme) => `  {
    id: "${theme.id}",
    englishName: ${JSON.stringify(theme.englishName)},
    nameKey: "dreamSkin.theme.${theme.key}.name",
    descriptionKey: "dreamSkin.theme.${theme.key}.description",
    tone: "${theme.tone}",
    appearance: "${theme.appearance}",
  },
`,
  )
  .join("");
builtIns = `${builtIns.slice(0, builtInInsertAt)}${builtInEntries}${builtIns.slice(builtInInsertAt)}`;
fs.writeFileSync(builtInsPath, builtIns, "utf8");

const rustPath = path.join(desktop, "src-tauri", "src", "dream_skin_native", "types.rs");
let rust = fs.readFileSync(rustPath, "utf8");
const arrayPattern = /(?:pub\(crate\) )?const BUILT_IN_THEME_IDS: \[&str; \d+\] = \[(?<body>[\s\S]*?)\n\];/;
const arrayMatch = rust.match(arrayPattern);
if (!arrayMatch?.groups) throw new Error("Cannot find Rust built-in theme array");
const ids = [...arrayMatch.groups.body.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
for (const theme of themes) if (!ids.includes(theme.id)) ids.push(theme.id);
const rustArray = `const BUILT_IN_THEME_IDS: [&str; ${ids.length}] = [\n${ids.map((id) => `    "${id}",`).join("\n")}\n];`;
rust = rust.replace(arrayPattern, rustArray);
fs.writeFileSync(rustPath, rust, "utf8");

const sourcesPath = path.join(presetsRoot, "SOURCES.json");
const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
for (const theme of themes) {
  if (sources.themes.some((entry) => entry.id === theme.id)) continue;
  sources.themes.push({
    id: theme.id,
    category: `science-fiction-${theme.tone}`,
    rightsStatus: "projectOriginal",
    nameEn: theme.englishName,
    nameZh: theme.nameZh,
    promptSummary: theme.summary,
  });
}
fs.writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");

const integratedBuiltIns = fs.readFileSync(builtInsPath, "utf8");
const integratedRust = fs.readFileSync(rustPath, "utf8");
const integratedSources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
const countOccurrences = (text, needle) => text.split(needle).length - 1;

for (const theme of themes) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(presetsRoot, theme.id, "theme.json"), "utf8"));
  if (packageJson.id !== theme.id || packageJson.appearance !== theme.appearance) {
    throw new Error(`Package metadata mismatch for ${theme.id}`);
  }
  if (countOccurrences(integratedRust, `"${theme.id}"`) !== 1) {
    throw new Error(`Rust registry mismatch for ${theme.id}`);
  }
  if (!integratedBuiltIns.includes(`id: "${theme.id}"`)) {
    throw new Error(`TypeScript registry missing ${theme.id}`);
  }
  if (integratedSources.themes.filter((entry) => entry.id === theme.id).length !== 1) {
    throw new Error(`Provenance mismatch for ${theme.id}`);
  }
}

const rustIds = [...integratedRust.matchAll(/^\s+"(preset-[^"]+)",$/gm)].map((match) => match[1]);
const typescriptIds = [...integratedBuiltIns.matchAll(/^\s+id: "(preset-[^"]+)",$/gm)].map((match) => match[1]);
if (rustIds.length !== ids.length || typescriptIds.length !== ids.length) {
  throw new Error(`Registry count mismatch: Rust ${rustIds.length}, TypeScript ${typescriptIds.length}, expected ${ids.length}`);
}

console.log(
  `Integrated and verified ${themes.length} science-fiction themes; both registries now have ${ids.length} IDs.`,
);
