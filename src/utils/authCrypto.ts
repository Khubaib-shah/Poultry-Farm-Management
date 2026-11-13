import crypto from 'node:crypto';

export interface SessionUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: string;
}

export interface SessionPayload extends SessionUser {
  exp: number;
}

const SCRYPT_KEYLEN = 64;
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!password || !storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) {
    return false;
  }
  try {
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedBuffer = crypto.scryptSync(password, salt, keyBuffer.length);
    if (keyBuffer.length !== derivedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

export function getSessionSecret(envSecret?: string, databaseUrl?: string): string {
  if (envSecret && envSecret.trim().length > 0) {
    return envSecret.trim();
  }
  const basis = databaseUrl && databaseUrl.trim().length > 0
    ? databaseUrl.trim()
    : 'al-madina-poultry-checkin-fallback-secret';
  return crypto.createHash('sha256').update(`checkin-session:${basis}`).digest('hex');
}

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signSessionToken(
  user: SessionUser,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: SessionPayload = {
    id: user.id,
    uid: user.uid,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: nowSeconds + ttlSeconds,
  };
  const body = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(
  token: string | null | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): SessionPayload | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [header, body, signature] = parts;
  if (!header || !body || !signature) {
    return null;
  }

  try {
    const expectedSig = toBase64Url(
      crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
    );
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const decoded = JSON.parse(fromBase64Url(body).toString('utf8')) as Partial<SessionPayload>;
    if (
      typeof decoded.id !== 'number' ||
      typeof decoded.uid !== 'string' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.role !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }

    if (decoded.exp <= nowSeconds) {
      return null;
    }

    return {
      id: decoded.id,
      uid: decoded.uid,
      email: decoded.email,
      name: typeof decoded.name === 'string' ? decoded.name : 'Owner',
      role: decoded.role,
      exp: decoded.exp,
    };
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) {
    return result;
  }
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function extractTokenFromHeaders(
  headers: { authorization?: string; cookie?: string },
  cookieName: string = 'checkin_session'
): string | null {
  const auth = headers.authorization;
  if (auth && typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    const bearer = auth.slice(7).trim();
    if (bearer.length > 0) {
      return bearer;
    }
  }
  const cookies = parseCookies(headers.cookie);
  const cookieToken = cookies[cookieName];
  return cookieToken && cookieToken.length > 0 ? cookieToken : null;
}
