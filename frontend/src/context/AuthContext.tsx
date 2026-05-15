import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiJson, getToken, setToken } from "../lib/api";

import type { UserRole } from "./userRole";

export type AuthUser = {
  korisnik_id: number;
  role: UserRole;
  ime: string;
  prezime: string;
  email: string;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, lozinka: string) => Promise<void>;
  register: (ime: string, prezime: string, email: string, lozinka: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiJson<AuthUser>("/api/auth/ja");
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, lozinka: string) => {
    const r = await apiJson<{ token: string }>("/api/auth/prijava", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, lozinka }),
    });
    setToken(r.token);
    await refresh();
  }, [refresh]);

  const register = useCallback(async (ime: string, prezime: string, email: string, lozinka: string) => {
    const r = await apiJson<{ token: string }>("/api/auth/registracija", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ime, prezime, email, lozinka }),
    });
    setToken(r.token);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const v = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth izvan AuthProvider");
  return c;
}
