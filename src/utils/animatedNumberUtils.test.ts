import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTargetNumber,
  roundAnimatedValue,
  getAnimatedNumberDuration,
} from './animatedNumberUtils';

test('normalizeTargetNumber handles numbers, strings, invalid values, and -0', () => {
  assert.equal(normalizeTargetNumber(12500), 12500);
  assert.equal(normalizeTargetNumber('4500.5'), 4500.5);
  assert.equal(normalizeTargetNumber(null), 0);
  assert.equal(normalizeTargetNumber(undefined), 0);
  assert.equal(normalizeTargetNumber('not-a-number'), 0);
  assert.equal(Object.is(normalizeTargetNumber(-0), -0), false);
});

test('roundAnimatedValue rounds integers and decimals cleanly without -0', () => {
  assert.equal(roundAnimatedValue(1234.67, 0), 1235);
  assert.equal(roundAnimatedValue(12.345, 1), 12.3);
  assert.equal(roundAnimatedValue(12.355, 2), 12.36);
  assert.equal(Object.is(roundAnimatedValue(-0.0001, 0), -0), false);
  assert.equal(roundAnimatedValue(NaN, 0), 0);
});

test('getAnimatedNumberDuration uses 3.2s from zero, shorter duration on updates, and 0 when reducedMotion', () => {
  assert.equal(
    getAnimatedNumberDuration({ fromValue: 0, toValue: 250000 }),
    3.2
  );
  assert.equal(
    getAnimatedNumberDuration({ fromValue: 100000, toValue: 250000 }),
    1.2
  );
  assert.equal(
    getAnimatedNumberDuration({ fromValue: 500, toValue: 500 }),
    0
  );
  assert.equal(
    getAnimatedNumberDuration({ fromValue: 0, toValue: 250000, reducedMotion: true }),
    0
  );
});
