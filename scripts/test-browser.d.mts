/** Select a test channel while preventing system-browser account lockouts on Windows. */
export function testBrowserChannel(requestedChannel?: string, platform?: NodeJS.Platform): string | undefined;

/** Permit only the bundled executable in Windows extension tests. */
export function testBrowserExecutable(
  requestedPath: string | undefined,
  bundledPath: string,
  platform?: NodeJS.Platform,
): string;

/** Merge Chromium feature switches without losing the Windows password-probe workaround. */
export function testBrowserArguments(args?: string[], platform?: NodeJS.Platform): string[];

/** Preserve Playwright's defaults while disabling the Windows password-probe feature. */
export function testBrowserLaunchOptions(
  options?: import('@playwright/test').LaunchOptions,
  platform?: NodeJS.Platform,
): import('@playwright/test').LaunchOptions;
