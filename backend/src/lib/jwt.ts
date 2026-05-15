import jwt from "jsonwebtoken";
import type { UserRole } from "../domain/userRole.js";

export type JwtPayload = {
  sub: number;
  role: UserRole;
};

const secret = () => process.env.JWT_SECRET ?? "dev-only-promijeni-u-produkciji";

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, secret());
  if (typeof decoded !== "object" || decoded === null) throw new Error("INVALID_TOKEN");
  const sub = Number((decoded as { sub?: unknown }).sub);
  const role = (decoded as { role?: unknown }).role;
  if (
    !Number.isFinite(sub) ||
    (role !== "kupac" && role !== "djelatnik" && role !== "administrator")
  ) {
    throw new Error("INVALID_TOKEN");
  }
  return { sub, role };
}
