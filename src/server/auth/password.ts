import bcrypt from "bcryptjs";

const COST = 11;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Compared against when the email is unknown so response time doesn't reveal account existence.
export const DUMMY_HASH = bcrypt.hashSync("vnum-dummy-password", COST);
