import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../src/infrastructure/pool.js";
import { signAccessToken } from "../../src/lib/jwt.js";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const createdKorisnikIds: number[] = [];
const createdNarudzbaIds: number[] = [];
const touchedJedinicaIds = new Set<number>();

type AuthResponse = {
  token: string;
  korisnik_id: number;
  role: "kupac" | "djelatnik" | "administrator";
};

type KatalogBicikl = {
  bicikl_id: number;
  naziv: string;
  kolicina: number;
  cijena: string;
};

type NarudzbaDetalj = {
  narudzba_id: number;
  status: string;
  adresa_dostave: string;
  nacin_placanja: string;
  kupac_korisnik_id: number;
  stavke: Array<{
    stavka_id: number;
    jedinica_id: number;
    narudzba_id: number;
    bicikl_naziv: string | null;
  }>;
};

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await response.text();
  const body = (text ? JSON.parse(text) : null) as T;
  return { status: response.status, body };
}

async function registerKupac(): Promise<AuthResponse> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await requestJson<AuthResponse>("/api/auth/registracija", {
    method: "POST",
    body: JSON.stringify({
      ime: "QA",
      prezime: "Kupac",
      email: `qa-${suffix}@test.local`,
      lozinka: "lozinka123",
    }),
  });
  expect(response.status).toBe(201);
  createdKorisnikIds.push(response.body.korisnik_id);
  return response.body;
}

async function cleanup(): Promise<void> {
  if (createdNarudzbaIds.length > 0) {
    await pool.query("DELETE FROM stavkanarudzbe WHERE narudzba_id = ANY($1::int[])", [
      createdNarudzbaIds,
    ]);
    await pool.query("DELETE FROM narudzba WHERE narudzba_id = ANY($1::int[])", [
      createdNarudzbaIds,
    ]);
  }
  if (touchedJedinicaIds.size > 0) {
    await pool.query("UPDATE bicikl_jedinica SET status = 'DOSTUPAN' WHERE jedinica_id = ANY($1::int[])", [
      [...touchedJedinicaIds],
    ]);
  }
  if (createdKorisnikIds.length > 0) {
    await pool.query("DELETE FROM kupac WHERE korisnik_id = ANY($1::int[])", [createdKorisnikIds]);
    await pool.query("DELETE FROM korisnik WHERE korisnik_id = ANY($1::int[])", [createdKorisnikIds]);
  }
}

afterAll(async () => {
  try {
    await cleanup();
  } finally {
    await pool.end();
  }
});

beforeAll(async () => {
  const requiredTables = ["korisnik", "kupac", "narudzba", "stavkanarudzbe", "bicikl", "bicikl_jedinica"];
  const res = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables],
  );
  const existing = new Set(res.rows.map((r) => r.table_name));
  const missing = requiredTables.filter((table) => !existing.has(table));
  assert.deepEqual(
    missing,
    [],
    `Baza nije migrirana na novu shemu. Nedostaju tablice: ${missing.join(", ")}. Pokreni SQL migracije u database/ prije integracijskih testova.`,
  );
});

describe("current backend API integration", () => {
  it("health, javne kategorije i javni katalog rade bez prijave", async () => {
    const health = await requestJson<{ status: string; service: string }>("/api/health");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");

    const kategorije = await requestJson<Array<{ kategorija_id: number; naziv: string }>>("/api/kategorije");
    expect(kategorije.status).toBe(200);
    expect(kategorije.body.length).toBeGreaterThan(0);

    const katalog = await requestJson<KatalogBicikl[]>("/api/katalog/bicikli?samo_dostupni=true");
    expect(katalog.status).toBe(200);
    expect(katalog.body.some((b) => b.kolicina > 0)).toBe(true);
  });

  it("registracija, prijava i /auth/ja rade za privremenog kupca", async () => {
    const registered = await registerKupac();

    const me = await requestJson<{ korisnik_id: number; role: string; email: string }>("/api/auth/ja", {
      headers: { authorization: `Bearer ${registered.token}` },
    });

    expect(me.status).toBe(200);
    expect(me.body.korisnik_id).toBe(registered.korisnik_id);
    expect(me.body.role).toBe("kupac");

    const login = await requestJson<AuthResponse>("/api/auth/prijava", {
      method: "POST",
      body: JSON.stringify({ email: me.body.email, lozinka: "lozinka123" }),
    });

    expect(login.status).toBe(200);
    expect(login.body.role).toBe("kupac");
  });

  it("zaštićene narudžbe traže prijavu, a POST /narudzbe je zabranjen i s tokenom", async () => {
    const noAuth = await requestJson<{ error: string }>("/api/narudzbe");
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error).toMatch(/prijava/i);

    const kupac = await registerKupac();
    const forbidden = await requestJson<{ error: string }>("/api/narudzbe", {
      method: "POST",
      headers: { authorization: `Bearer ${kupac.token}` },
      body: JSON.stringify({
        status: "NOVA",
        kupac_korisnik_id: kupac.korisnik_id,
        adresa_dostave: "Test adresa",
        nacin_placanja: "KARTICA",
      }),
    });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error).toMatch(/kupnja|POST \/api\/kupnja/i);
  });

  it("kupac može napraviti kupnju preko POST /api/kupnja i vidjeti samo svoju narudžbu", async () => {
    const kupac = await registerKupac();
    const katalog = await requestJson<KatalogBicikl[]>("/api/katalog/bicikli?samo_dostupni=true");
    const bicikl = katalog.body.find((b) => b.kolicina > 0);
    assert.ok(bicikl, "seed treba imati barem jednu dostupnu vrstu bicikla");

    const kupnja = await requestJson<NarudzbaDetalj>("/api/kupnja", {
      method: "POST",
      headers: { authorization: `Bearer ${kupac.token}` },
      body: JSON.stringify({
        bicikl_id: bicikl.bicikl_id,
        kolicina: 1,
        adresa_dostave: "Testna 1, Zagreb",
        nacin_placanja: "KARTICA",
      }),
    });

    expect(kupnja.status).toBe(201);
    expect(kupnja.body.status).toBe("NOVA");
    expect(kupnja.body.kupac_korisnik_id).toBe(kupac.korisnik_id);
    expect(kupnja.body.stavke).toHaveLength(1);

    createdNarudzbaIds.push(kupnja.body.narudzba_id);
    touchedJedinicaIds.add(kupnja.body.stavke[0]!.jedinica_id);

    const list = await requestJson<NarudzbaDetalj[]>("/api/narudzbe?limit=10", {
      headers: { authorization: `Bearer ${kupac.token}` },
    });
    expect(list.status).toBe(200);
    expect(list.body.some((n) => n.narudzba_id === kupnja.body.narudzba_id)).toBe(true);

    const detail = await requestJson<NarudzbaDetalj>(`/api/narudzbe/${kupnja.body.narudzba_id}`, {
      headers: { authorization: `Bearer ${kupac.token}` },
    });
    expect(detail.status).toBe(200);
    expect(detail.body.stavke[0]!.bicikl_naziv).toBeTruthy();
  });

  it("administrator ne smije u javni katalog, ali smije u admin korisnike", async () => {
    const adminToken = signAccessToken({ sub: 1, role: "administrator" });

    const katalog = await requestJson<{ error: string }>("/api/katalog/bicikli", {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(katalog.status).toBe(403);

    const korisnici = await requestJson<Array<{ korisnik_id: number; email: string; uloga: string }>>(
      "/api/admin/korisnici",
      { headers: { authorization: `Bearer ${adminToken}` } },
    );
    expect(korisnici.status).toBe(200);
    expect(Array.isArray(korisnici.body)).toBe(true);
  });
});
