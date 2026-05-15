import type { UserRole } from "./userRole.js";

export type AuthUser = {
  korisnik_id: number;
  role: UserRole;
};
