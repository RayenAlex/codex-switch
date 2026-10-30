import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guardedPlaywrightVersion = '1.63.0';
const passwordProbeFeature = 'AutofillAiWalletPrivatePasses';
const disabledFeaturesPrefix = '--disable-features=';
// Preserve Playwright 1.63.0's default feature switch when adding the Windows workaround.
// Do not silently replace this list after a Playwright upgrade: revalidate browser startup first.
const playwrightDisabledFeatures = [
  'AvoidUnnecessaryBeforeUnloadCheckSync', 'DestroyProfileOnBrowserClose', 'DialMediaRouteProvider',
  'GlobalMediaControls', 'HttpsUpgrades', 'LensOverlay', 'MediaRouter', 'PaintHolding',
  'ThirdPartyStoragePartitioning', 'BlockOriginHeaderModificationOnRedirect', 'Translate',
  'AutoDeElevate', 'OptimizationHints', 'msForceBrowserSignIn', 'msEdgeUpdateLaunchServicesPreferredVersion',
];

const windowsBrowserError = 'System Edge/Chrome test launches can lock the Windows account. '
  + 'Remove the browser override and run npx playwright install chromium. '
  + 'See docs/browser-tests.md.';

/**
 * Default to Playwright's bundled browser, never the user's system browser.
 * Fresh Edge/Chrome profiles can probe the Windows password and increment the lockout counter.
 * @param {string | undefined} requestedChannel
 * @param {NodeJS.Platform} platform
 * @returns {string | undefined}
 */
export function testBrowserChannel(requestedChannel, platform = process.platform) {
  const channel = requestedChannel?.trim().toLowerCase() || undefined;
  if (platform === 'win32' && channel && /^(msedge|chrome)(-|$)/.test(channel)) {
    throw new Error(windowsBrowserError);
  }
  return channel;
}

/**
 * Extension tests need the full bundled Chromium binary; guard their path override as well.
 * @param {string | undefined} requestedPath
 * @param {string} bundledPath
 * @param {NodeJS.Platform} platform
 * @returns {string}
 */
export function testBrowserExecutable(requestedPath, bundledPath, platform = process.platform) {
  const executable = requestedPath?.trim() || bundledPath;
  if (platform === 'win32'
    && path.win32.resolve(executable).toLowerCase() !== path.win32.resolve(bundledPath).toLowerCase()) {
    throw new Error(windowsBrowserError);
  }
  return executable;
}

/** Merge feature switches so the password-probe workaround cannot overwrite other test flags.
 * @param {string[]} args
 * @param {NodeJS.Platform} platform
 */
export function testBrowserArguments(args = [], platform = process.platform) {
  if (platform !== 'win32') return [...args];
  const features = new Set([passwordProbeFeature]);
  const otherArgs = [];
  for (const arg of args) {
    if (!arg.startsWith(disabledFeaturesPrefix)) { otherArgs.push(arg); continue; }
    for (const feature of arg.slice(disabledFeaturesPrefix.length).split(',')) {
      if (feature.trim()) features.add(feature.trim());
    }
  }
  return [...otherArgs, disabledFeaturesPrefix + [...features].join(',')];
}

/** Add the Windows workaround using public launch options, preserving every other default argument.
 * @param {import('@playwright/test').LaunchOptions} options
 * @param {NodeJS.Platform} platform
 * @returns {import('@playwright/test').LaunchOptions}
 */
export function testBrowserLaunchOptions(options = {}, platform = process.platform) {
  if (platform !== 'win32') return { ...options };
  const version = require('playwright-core/package.json').version;
  if (version !== guardedPlaywrightVersion || options.ignoreDefaultArgs === true) {
    throw new Error('Revalidate the Windows browser startup workaround for this Playwright configuration. '
      + 'See docs/browser-tests.md.');
  }
  const defaultFeatureArg = disabledFeaturesPrefix + playwrightDisabledFeatures.join(',');
  return {
    ...options,
    args: testBrowserArguments([defaultFeatureArg, ...options.args ?? []], platform),
    ignoreDefaultArgs: [...options.ignoreDefaultArgs ?? [], defaultFeatureArg],
  };
}
