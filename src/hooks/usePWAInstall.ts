import { useEffect, useState, useCallback } from 'react';
import {
  detectIOSDevice,
  detectStandaloneMode,
  resolveInstallMethod,
} from '../utils/pwaInstall.ts';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level store so early beforeinstallprompt events are never missed
let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let sharedIsInstalled = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function checkStandaloneNow(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaMatch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const navStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return detectStandaloneMode(mediaMatch, navStandalone);
}

if (typeof window !== 'undefined') {
  sharedIsInstalled = checkStandaloneNow();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    sharedDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    sharedIsInstalled = true;
    sharedDeferredPrompt = null;
    notifyListeners();
  });

  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(display-mode: standalone)');
    const onChange = () => {
      sharedIsInstalled = checkStandaloneNow();
      notifyListeners();
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
    }
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    sharedDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    typeof window !== 'undefined' ? checkStandaloneNow() || sharedIsInstalled : false
  );
  const [isIOS] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return detectIOSDevice(window.navigator.userAgent, window.navigator.maxTouchPoints);
  });
  const [inIframe] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const sync = () => {
      setDeferredPrompt(sharedDeferredPrompt);
      setIsInstalled(checkStandaloneNow() || sharedIsInstalled);
    };
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!sharedDeferredPrompt) return false;
    await sharedDeferredPrompt.prompt();
    const { outcome } = await sharedDeferredPrompt.userChoice;
    if (outcome === 'accepted') {
      sharedIsInstalled = true;
      sharedDeferredPrompt = null;
      notifyListeners();
      return true;
    }
    return false;
  }, []);

  const installMethod = resolveInstallMethod({
    isInstalled,
    isInstallable: Boolean(deferredPrompt),
    isIOS,
  });

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    inIframe,
    installMethod,
    install,
  };
}
