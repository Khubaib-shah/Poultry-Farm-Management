import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  parseCookies,
  extractTokenFromHeaders,
  getSessionSecret,
} from './authCrypto';

test('hashPassword and verifyPassword validate matching and non-matching passwords', () => {
  const hash = hashPassword('Owner1122@@');
  assert.ok(hash.includes(':'));
  assert.equal(verifyPassword('Owner1122@@', hash), true);
  assert.equal(verifyPassword('WrongPass123', hash), false);
  assert.equal(verifyPassword('', hash), false);
  assert.equal(verifyPassword('Owner1122@@', null), false);
  assert.equal(verifyPassword('Owner1122@@', 'malformed'), false);
});

test('hashPassword produces unique salted hashes for identical passwords', () => {
  const hashA = hashPassword('Owner1122@@');
  const hashB = hashPassword('Owner1122@@');
  assert.notEqual(hashA, hashB);
  assert.equal(verifyPassword('Owner1122@@', hashA), true);
  assert.equal(verifyPassword('Owner1122@@', hashB), true);
});

test('signSessionToken and verifySessionToken enforce signature and expiry', () => {
  const secret = getSessionSecret('unit-test-secret');
  const now = 1700000000;
  const token = signSessionToken(
    {
      id: 1,
      uid: 'owner-checkin-me',
      email: 'owner@checkin.me',
      name: 'Owner',
      role: 'owner',
    },
    secret,
    3600,
    now
  );

  const validPayload = verifySessionToken(token, secret, now + 100);
  assert.ok(validPayload);
  assert.equal(validPayload.email, 'owner@checkin.me');
  assert.equal(validPayload.role, 'owner');

  // Expired
  assert.equal(verifySessionToken(token, secret, now + 3600), null);

  // Tampered payload or wrong secret
  const tampered = `${token.slice(0, -4)}AAAA`;
  assert.equal(verifySessionToken(tampered, secret, now + 100), null);
  assert.equal(verifySessionToken(token, 'wrong-secret', now + 100), null);
});

test('parseCookies and extractTokenFromHeaders prefer Bearer over cookie', () => {
  const cookies = parseCookies('foo=bar; checkin_session=cookie-tok-123; theme=dark');
  assert.equal(cookies.checkin_session, 'cookie-tok-123');
  assert.equal(cookies.theme, 'dark');

  assert.equal(
    extractTokenFromHeaders({
      authorization: 'Bearer bearer-tok-999',
      cookie: 'checkin_session=cookie-tok-123',
    }),
    'bearer-tok-999'
  );

  assert.equal(
    extractTokenFromHeaders({
      cookie: 'checkin_session=cookie-tok-123',
    }),
    'cookie-tok-123'
  );

  assert.equal(extractTokenFromHeaders({}), null);
});
