import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** 32-byte key from SMPP_ENCRYPTION_KEY (64 hex chars or base64). Only needed when vendors exist. */
function key(): Buffer {
  const raw = process.env.SMPP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SMPP_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("SMPP_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return buf;
}

/** AES-256-GCM. Output format: iv.tag.ciphertext (base64 parts). */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string) {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
