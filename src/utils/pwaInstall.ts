export interface PWAEnvironmentInput {
  userAgent: string;
  maxTouchPoints?: number;
  displayModeStandalone?: boolean;
  navigatorStandalone?: boolean;
  inIframe?: boolean;
}

export function detectIOSDevice(userAgent: string, maxTouchPoints = 0): boolean {
  const ua = (userAgent || '').toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return true;
  }
  // iPadOS 13+ reports Macintosh in UA with touch points > 1
  if (/macintosh/.test(ua) && maxTouchPoints > 1) {
    return true;
  }
  return false;
}

export function detectStandaloneMode(
  displayModeStandalone: boolean,
  navigatorStandalone?: boolean
): boolean {
  return Boolean(displayModeStandalone) || navigatorStandalone === true;
}

export type InstallMethod = 'native' | 'ios-safari' | 'browser-menu' | 'installed';

export function resolveInstallMethod(options: {
  isInstalled: boolean;
  isInstallable: boolean;
  isIOS: boolean;
}): InstallMethod {
  if (options.isInstalled) return 'installed';
  if (options.isInstallable) return 'native';
  if (options.isIOS) return 'ios-safari';
  return 'browser-menu';
}
