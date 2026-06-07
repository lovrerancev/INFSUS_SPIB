import type { UserRole } from "../context/userRole";

export function camundaUserIdZaUlogu(role: UserRole): string {
  switch (role) {
    case "kupac":
      return "kupac1";
    case "djelatnik":
      return "djelatnik1";
    case "administrator":
      return "admin1";
  }
}

export const CAMUNDA_GRUPA_ZA_ULOGU: Partial<Record<UserRole, string>> = {
  djelatnik: "djelatnik",
  administrator: "administrator",
};
