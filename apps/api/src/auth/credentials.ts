import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const passwordOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function deriveKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, passwordOptions, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function randomToken() {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await deriveKey(password, salt);
  return `${salt}:${hash.toString("hex")}`;
}

export async function matchesPassword(password: string, storedHash?: string) {
  const [salt, hash] = storedHash?.split(":") ?? ["0".repeat(32), "0".repeat(128)];
  const candidate = await deriveKey(password, salt);
  const expected = Buffer.from(hash, "hex");
  return timingSafeEqual(candidate, expected) && Boolean(storedHash);
}
