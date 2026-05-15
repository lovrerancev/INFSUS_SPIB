import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KorisnikRepository } from "../../src/infrastructure/korisnikRepository.js";
import { AuthService } from "../../src/application/authService.js";
import { verifyAccessToken } from "../../src/lib/jwt.js";

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

function repoMock(overrides: Partial<KorisnikRepository> = {}): KorisnikRepository {
  return {
    emailExists: vi.fn(),
    insertKorisnik: vi.fn(),
    insertKupac: vi.fn(),
    findByEmailForAuth: vi.fn(),
    findProfil: vi.fn(),
    ...overrides,
  } as unknown as KorisnikRepository;
}

describe("AuthService", () => {
  beforeEach(() => {
    vi.mocked(bcrypt.hash).mockReset();
    vi.mocked(bcrypt.compare).mockReset();
  });

  it("register validira lozinku i ne dira repozitorij kad je prekratka", async () => {
    const repo = repoMock({ emailExists: vi.fn() });
    const service = new AuthService(repo);

    await expect(
      service.register({ ime: "Ana", prezime: "Anić", email: "ana@test.local", lozinka: "kratko" }),
    ).rejects.toThrow(/lozinka/);

    expect(repo.emailExists).not.toHaveBeenCalled();
  });

  it("register kreira kupca i token", async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue("hash");
    const repo = repoMock({
      emailExists: vi.fn().mockResolvedValue(false),
      insertKorisnik: vi.fn().mockResolvedValue(123),
      insertKupac: vi.fn().mockResolvedValue(undefined),
    });
    const service = new AuthService(repo);

    const out = await service.register({
      ime: " Ana ",
      prezime: " Anić ",
      email: "Ana@Test.Local ",
      lozinka: "lozinka123",
    });

    expect(repo.insertKorisnik).toHaveBeenCalledWith("Ana", "Anić", "Ana@Test.Local", "hash");
    expect(repo.insertKupac).toHaveBeenCalledWith(123);
    expect(out.role).toBe("kupac");
    expect(verifyAccessToken(out.token)).toEqual({ sub: 123, role: "kupac" });
  });

  it("login odbija pogrešnu lozinku", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false);
    const repo = repoMock({
      findByEmailForAuth: vi.fn().mockResolvedValue({
        korisnik_id: 5,
        lozinka: "hash",
        uloga: "djelatnik",
      }),
    });
    const service = new AuthService(repo);

    await expect(service.login({ email: "x@test.local", lozinka: "kriva" })).rejects.toThrow(/neispravan/i);
  });

  it("login vraća token s ulogom iz repozitorija", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    const repo = repoMock({
      findByEmailForAuth: vi.fn().mockResolvedValue({
        korisnik_id: 9,
        lozinka: "hash",
        uloga: "administrator",
      }),
    });
    const service = new AuthService(repo);

    const out = await service.login({ email: "admin@test.local", lozinka: "lozinka123" });

    expect(out.role).toBe("administrator");
    expect(verifyAccessToken(out.token)).toEqual({ sub: 9, role: "administrator" });
  });
});
