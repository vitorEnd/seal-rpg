import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt:v1";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${HASH_PREFIX}:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, version, saltValue, hashValue, ...extra] =
    encodedHash.split(":");

  if (
    algorithm !== "scrypt" ||
    version !== "v1" ||
    !saltValue ||
    !hashValue ||
    extra.length > 0
  ) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const expectedHash = Buffer.from(hashValue, "base64url");
  const candidateHash = (await scryptAsync(
    password,
    salt,
    expectedHash.length,
  )) as Buffer;

  return (
    candidateHash.length === expectedHash.length &&
    timingSafeEqual(candidateHash, expectedHash)
  );
}

