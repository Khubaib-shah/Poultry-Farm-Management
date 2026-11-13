import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIOSDevice,
  detectStandaloneMode,
  resolveInstallMethod,
} from './pwaInstall.ts';

test('detectIOSDevice identifies iPhone, iPad, iPod, and iPadOS touch Safari', () => {
  assert.equal(
    detectIOSDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)'),
    true
  );
  assert.equal(
    detectIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5),
    true
  );
  assert.equal(
    detectIOSDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0),
    false
  );
  assert.equal(
    detectIOSDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)'),
    false
  );
});

test('detectStandaloneMode checks display-mode and navigator.standalone', () => {
  assert.equal(detectStandaloneMode(true, false), true);
  assert.equal(detectStandaloneMode(false, true), true);
  assert.equal(detectStandaloneMode(false, false), false);
  assert.equal(detectStandaloneMode(false, undefined), false);
});

test('resolveInstallMethod prioritizes installed, then native prompt, then iOS, then browser menu', () => {
  assert.equal(
    resolveInstallMethod({ isInstalled: true, isInstallable: true, isIOS: true }),
    'installed'
  );
  assert.equal(
    resolveInstallMethod({ isInstalled: false, isInstallable: true, isIOS: false }),
    'native'
  );
  assert.equal(
    resolveInstallMethod({ isInstalled: false, isInstallable: false, isIOS: true }),
    'ios-safari'
  );
  assert.equal(
    resolveInstallMethod({ isInstalled: false, isInstallable: false, isIOS: false }),
    'browser-menu'
  );
});
