/**
 * Hash system — password & user identity hashing
 *
 * ── Password hashing (scrypt KDF) ────────────────────────────────────────────
 *   • encrypts the password client-side before it leaves the machine
 *   • salt + parameters are embedded in the output string so verification
 *     is self-contained (no separate salt storage needed)
 *
 * ── User ID hashing (SHA-256) ────────────────────────────────────────────────
 *   • deterministic one-way hash for anonymous user identifiers
 *   • the server never learns the raw username/email
 *
 * ── API token hashing (scrypt, light) ─────────────────────────────────────────
 *   • one-way token storage so even if the config file leaks the
 *     stored token can't be reversed
 */

import * as crypto from 'node:crypto';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default scrypt params for password hashing (≈100ms on modern hardware) */
const SCRYPT_PASSWORD_PARAMS = {
  N: 131072,  // 2^17 — CPU/memory cost
  r: 8,       // block size
  p: 1,       // parallelisation
  keylen: 64, // output length (bytes)
} as const;

/** Lighter scrypt params for API token hashing (≤5ms) */
const SCRYPT_TOKEN_PARAMS = {
  N: 16384,   // 2^14
  r: 8,
  p: 1,
  keylen: 32,
} as const;

const SALT_BYTES = 16;

const HASH_VERSION = 1;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Hash a password using scrypt.
 *
 * Output format:  `$scrypt$v=1$ln=17,r=8,p=1$<base64-salt>$<base64-key>`
 *
 * The output is a printable ASCII string safe to store in config files,
 * databases, or pass as a JSON body to the server.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key  = crypto.scryptSync(
    password,
    salt,
    SCRYPT_PASSWORD_PARAMS.keylen,
    {
      N: SCRYPT_PASSWORD_PARAMS.N,
      r: SCRYPT_PASSWORD_PARAMS.r,
      p: SCRYPT_PASSWORD_PARAMS.p,
      maxmem: 256 * 1024 * 1024, // 256 MB — N=2^17,r=8 needs ~128 MB
    },
  );
  return encodeHash(HASH_VERSION, SCRYPT_PASSWORD_PARAMS, salt, key);
}

/**
 * Verify a password against a hash previously produced by `hashPassword`.
 *
 * Timing-safe (uses `crypto.timingSafeEqual`) so an attacker can't
 * leak the hash character by character.
 */
export function verifyPassword(password: string, encoded: string): boolean {
  const { version, params, salt, key } = decodeHash(encoded);

  if (version !== HASH_VERSION) return false;

  const derived = crypto.scryptSync(
    password,
    salt,
    params.keylen,
    {
      N: params.N,
      r: params.r,
      p: params.p,
      maxmem: 256 * 1024 * 1024, // match hashPassword cap
    },
  );

  // Timing-safe comparison
  if (derived.length !== key.length) return false;
  return crypto.timingSafeEqual(derived, key);
}

/**
 * Deterministic one-way hash for producing anonymous user identifiers.
 *
 * Use this when you need a stable identifier that doesn't reveal the
 * original username / email / internal ID to the server or logs.
 */
export function hashUserId(identifier: string): string {
  return crypto.createHash('sha256').update(`aegis-uid-v1:${identifier}`).digest('hex');
}

/**
 * Hash an API token for one-way storage (e.g. when saving to config).
 *
 * Uses lighter scrypt parameters (2^14 vs 2^17) because the operation
 * happens more frequently and the token already has high entropy.
 */
export function hashApiToken(token: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key  = crypto.scryptSync(
    token,
    salt,
    SCRYPT_TOKEN_PARAMS.keylen,
    {
      N: SCRYPT_TOKEN_PARAMS.N,
      r: SCRYPT_TOKEN_PARAMS.r,
      p: SCRYPT_TOKEN_PARAMS.p,
      maxmem: 64 * 1024 * 1024,
    },
  );
  return encodeHash(HASH_VERSION, SCRYPT_TOKEN_PARAMS, salt, key);
}

// ── Encoding / decoding ───────────────────────────────────────────────────────

interface ScryptParams {
  N: number;
  r: number;
  p: number;
  keylen: number;
}

/**
 * Encode to the format:
 *   $scrypt$v=<version>$ln=<log2(N)>,r=<r>,p=<p>$<base64-salt>$<base64-key>
 */
function encodeHash(
  version: number,
  params: ScryptParams,
  salt: Buffer,
  key: Buffer,
): string {
  const ln = Math.round(Math.log2(params.N));
  return [
    '$scrypt',
    `v=${version}`,
    `ln=${ln},r=${params.r},p=${params.p}`,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

function decodeHash(encoded: string): {
  version: number;
  params: ScryptParams;
  salt: Buffer;
  key: Buffer;
} {
  const parts = encoded.split('$');
  // parts[0] is empty (string starts with $)
  // parts[1] = "scrypt"
  // parts[2] = "v=1"
  // parts[3] = "ln=17,r=8,p=1"
  // parts[4] = salt (base64url)
  // parts[5] = key  (base64url)

  if (parts[1] !== 'scrypt' || parts.length < 6) {
    throw new Error('Invalid hash format — expected $scrypt$v=…$ln=…$…$…');
  }

  const version = parseInt(parts[2].replace('v=', ''), 10);
  if (Number.isNaN(version)) throw new Error('Invalid hash version');

  const paramMap: Record<string, number> = {};
  for (const kv of parts[3].split(',')) {
    const [k, v] = kv.split('=');
    paramMap[k] = parseInt(v, 10);
  }

  const params: ScryptParams = {
    N: 1 << (paramMap.ln ?? 17),
    r: paramMap.r ?? 8,
    p: paramMap.p ?? 1,
    keylen: parts[5] ? Buffer.from(parts[5], 'base64url').length : 64,
  };

  return {
    version,
    params,
    salt: Buffer.from(parts[4], 'base64url'),
    key: Buffer.from(parts[5], 'base64url'),
  };
}
