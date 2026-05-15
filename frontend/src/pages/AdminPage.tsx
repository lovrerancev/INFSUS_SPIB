import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiJson, apiVoid } from "../lib/api";

type KorisnikRow = {
  korisnik_id: number;
  ime: string;
  prezime: string;
  email: string;
  uloga: string;
};

export default function AdminPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<KorisnikRow[]>([]);
  const [greska, setGreska] = useState<string | null>(null);
  const [pozicija, setPozicija] = useState("Djelatnik");
  const [noviDjelKorisnik, setNoviDjelKorisnik] = useState<number | "">("");

  const load = useCallback(async () => {
    const r = await apiJson<KorisnikRow[]>("/api/admin/korisnici");
    setRows(r);
  }, []);

  useEffect(() => {
    if (user?.role !== "administrator") return;
    let o = false;
    setGreska(null);
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!o) setGreska(e instanceof ApiError ? e.message : "Greška učitavanja");
      }
    })();
    return () => {
      o = true;
    };
  }, [user, load]);

  async function brisiKorisnika(id: number) {
    if (!confirm("Trajno obrisati korisnika iz sustava?")) return;
    setGreska(null);
    try {
      await apiVoid(`/api/admin/korisnici/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška brisanja");
    }
  }

  async function dodajDjelatnika() {
    if (noviDjelKorisnik === "") return;
    setGreska(null);
    try {
      await apiJson<{ ok: boolean }>("/api/admin/djelatnici", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ korisnik_id: Number(noviDjelKorisnik), pozicija: pozicija.trim() || "Djelatnik" }),
      });
      setNoviDjelKorisnik("");
      await load();
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška");
    }
  }

  async function ukloniDjelatnika(id: number) {
    if (!confirm("Ukloniti ulogu djelatnika? Korisnik ostaje u sustavu.")) return;
    setGreska(null);
    try {
      await apiVoid(`/api/admin/djelatnici/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška");
    }
  }

  if (user?.role !== "administrator") {
    return (
      <div className="panel">
        <p>Ova stranica je dostupna samo administratoru.</p>
      </div>
    );
  }

  const kandidatiZaDjelatnika = rows.filter(
    (r) => r.uloga !== "administrator" && r.uloga !== "djelatnik",
  );

  return (
    <div className="panel">
      <h2>Administracija</h2>
      <p className="hint">Brisanje korisnika i upravljanje djelatnicima. Izvještaji su na zasebnoj stranici.</p>
      {greska && <p className="greska">{greska}</p>}

      <h3>Korisnici</h3>
      <div className="table-wrap">
        <table className="tablica">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ime</th>
              <th>Email</th>
              <th>Uloga</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.korisnik_id}>
                <td>{r.korisnik_id}</td>
                <td>
                  {r.ime} {r.prezime}
                </td>
                <td>{r.email}</td>
                <td>{r.uloga}</td>
                <td className="tablica-akcije">
                  {r.uloga === "djelatnik" && (
                    <button type="button" className="btn btn-mali btn-sekundarni" onClick={() => void ukloniDjelatnika(r.korisnik_id)}>
                      Ukloni djelatnika
                    </button>
                  )}
                  {r.uloga !== "administrator" && r.korisnik_id !== user.korisnik_id && (
                    <button type="button" className="btn btn-mali" onClick={() => void brisiKorisnika(r.korisnik_id)}>
                      Obriši korisnika
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="forma-blok" style={{ marginTop: "1.5rem" }}>
        <h3>Novi djelatnik</h3>
        <p className="hint" style={{ margin: "0 0 0.5rem" }}>
          Odaberite postojećeg korisnika koji još nije djelatnik ni administrator.
        </p>
        <label>
          Korisnik
          <select
            value={noviDjelKorisnik === "" ? "" : String(noviDjelKorisnik)}
            onChange={(e) => setNoviDjelKorisnik(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">— odaberi —</option>
            {kandidatiZaDjelatnika.map((r) => (
              <option key={r.korisnik_id} value={r.korisnik_id}>
                #{r.korisnik_id} · {r.prezime} {r.ime} · {r.email} ({r.uloga})
              </option>
            ))}
          </select>
        </label>
        <label>
          Pozicija
          <input value={pozicija} onChange={(e) => setPozicija(e.target.value)} placeholder="npr. Prodavač" />
        </label>
        <button type="button" className="btn" onClick={() => void dodajDjelatnika()} disabled={noviDjelKorisnik === ""}>
          Dodaj djelatnika
        </button>
      </div>
    </div>
  );
}
