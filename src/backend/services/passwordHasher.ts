// Unified password hasher wrapper so we can swap implementations easily.
import { hash as aHash, verify as aVerify } from "@node-rs/argon2";

/**
 * Hash a password using Argon2id with sensible defaults.
 * You can tweak memoryCost/timeCost/parallelism if you want stronger settings.
 */
export async function hashPassword(plain: string): Promise<string> {
  // @node-rs/argon2 defaults to Argon2id with safe params
  return aHash(plain);
}

/** Verify a password against a stored hash. */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return aVerify(hash, plain);
}
