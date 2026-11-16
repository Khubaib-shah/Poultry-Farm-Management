import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPLE_BUBBLE_SPRING,
  APPLE_TAP_SPRING,
  APPLE_EASE_OUT,
  getAppleBubbleGestures,
} from './appleBubbleMotion.js';

test('APPLE_BUBBLE_SPRING and APPLE_TAP_SPRING define underdamped responsive spring physics', () => {
  assert.equal(APPLE_BUBBLE_SPRING.type, 'spring');
  assert.ok(APPLE_BUBBLE_SPRING.stiffness > 400);
  assert.ok(APPLE_BUBBLE_SPRING.damping < 30);

  assert.equal(APPLE_TAP_SPRING.type, 'spring');
  assert.ok(APPLE_TAP_SPRING.stiffness >= APPLE_BUBBLE_SPRING.stiffness);
  assert.equal(APPLE_EASE_OUT.length, 4);
});

test('getAppleBubbleGestures returns undefined gestures when disabled', () => {
  const disabledGestures = getAppleBubbleGestures({ disabled: true });
  assert.equal(disabledGestures.whileHover, undefined);
  assert.equal(disabledGestures.whileTap, undefined);
});

test('getAppleBubbleGestures returns hover and tap scale targets when enabled', () => {
  const activeGestures = getAppleBubbleGestures({ hoverScale: 1.04, tapScale: 0.88 });
  assert.deepEqual(activeGestures.whileHover, { scale: 1.04 });
  assert.deepEqual(activeGestures.whileTap, { scale: 0.88 });
});
