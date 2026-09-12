import {
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return "scrypt$" + salt + "$" + derivedKey.toString("hex");
}

export function verifyPassword(password, encodedHash) {
  if (typeof encodedHash !== "string") {
    return false;
  }

  const parts = encodedHash.split("$");

  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const [, salt, storedHex] = parts;

  try {
    const storedKey = Buffer.from(storedHex, "hex");
    const derivedKey = scryptSync(password, salt, KEY_LENGTH);

    return storedKey.length === derivedKey.length
      && timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}
