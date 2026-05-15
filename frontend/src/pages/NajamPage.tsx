import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiJson } from "../lib/api";

/** Jedna fizička jedinica za najam (iz kataloga jedinica). */
type JedinicaNajam = {
  jedinica_id: number;
  bicikl_id: number;
  inventarni_broj: string;
  naziv: string;
  cijena_najma_po_danu: string | null;
  status: string;
};

function cijenaNajmaBroj(v: string | null | undefined): number {
  if (v == null || String(v).trim() === "") return NaN;
  return parseFloat(String(v).replace(",", "."));
}

export default function NajamPage() {
  const { user } = useAuth();
  const [jedinice, setJedinice] = useState<JedinicaNajam[]>([]);
  const [jedinicaId, setJedinicaId] = useState("");
  const [od, setOd] = useState("");
  const [doDat, setDoDat] = useState("");
  const [greska, setGreska] = useState<string | null>(null);
  const [uspjeh, setUspjeh] = useState<string | null>(null);
  const [listaGreska, setListaGreska] = useState<string | null>(null);

  const load = useCallback(async () => {
    setListaGreska(null);
    try {
      const list = await apiJson<JedinicaNajam[]>("/api/katalog/bicikli/jedinice?samo_dostupni=1");
      setJedinice(
        list.filter((j) => {
          const n = cijenaNajmaBroj(j.cijena_najma_po_danu);
          return !Number.isNaN(n) && n > 0;
        }),
      );
    } catch (e) {
      setListaGreska(e instanceof Error ? e.message : "Greška pri učitavanju ponude");
      setJedinice([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function dana(): number {
    if (!od || !doDat) return 0;
    const a = new Date(`${od}T12:00:00Z`);
    const b = new Date(`${doDat}T12:00:00Z`);
    if (b < a) return 0;
    return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
  }

  const odabrani = jedinice.find((x) => String(x.jedinica_id) === jedinicaId);
  const cijenaDan = odabrani ? cijenaNajmaBroj(odabrani.cijena_najma_po_danu) : 0;
  const cijenaDanOk = !Number.isNaN(cijenaDan) && cijenaDan > 0;
  const ukupno = dana() > 0 && cijenaDanOk ? (dana() * cijenaDan).toFixed(2) : "0.00";

  async function rezerviraj(e: React.FormEvent) {
    e.preventDefault();
    setGreska(null);
    setUspjeh(null);
    if (user?.role !== "kupac") {
      setGreska("Rezervaciju može napraviti samo prijavljeni kupac.");
      return;
    }
    if (!jedinicaId || !od || !doDat) {
      setGreska("Popuni sva polja.");
      return;
    }
    try {
      await apiJson("/api/najmovi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jedinica_id: Number(jedinicaId),
          datum_pocetka: od,
          datum_zavrsetka: doDat,
        }),
      });
      setUspjeh("Najam je kreiran. Ukupna cijena (procjena): " + ukupno + " €");
      void load();
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Greška");
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <h2>Rezervacija najma</h2>
      {!user && <p className="hint">Prijavite se kao kupac.</p>}
      {listaGreska && <p className="greska">{listaGreska}</p>}
      {!listaGreska && jedinice.length === 0 && (
        <p className="hint">
          Nema jedinica za najam: trebaju biti u statusu <strong>Dostupan</strong>, s postavljenom{" "}
          <strong>cijenom najma po danu</strong> na vrsti modela (djelatnik: Bicikli → uredi vrstu).
        </p>
      )}
      {greska && <p className="greska">{greska}</p>}
      {uspjeh && <p className="hint">{uspjeh}</p>}
      <form className="forma-blok" onSubmit={rezerviraj}>
        <label>
          Bicikl (jedinica)
          <select value={jedinicaId} onChange={(e) => setJedinicaId(e.target.value)} required>
            <option value="">— odaberi —</option>
            {jedinice.map((j) => (
              <option key={j.jedinica_id} value={j.jedinica_id}>
                #{j.jedinica_id} · {j.inventarni_broj} · {j.naziv} ({j.cijena_najma_po_danu} €/dan)
              </option>
            ))}
          </select>
        </label>
        <label>
          Datum početka
          <input type="date" value={od} onChange={(e) => setOd(e.target.value)} required />
        </label>
        <label>
          Datum završetka
          <input type="date" value={doDat} onChange={(e) => setDoDat(e.target.value)} required />
        </label>
        <p>
          Broj dana: <strong>{dana()}</strong> · Ukupno: <strong>{ukupno} €</strong>
        </p>
        <button type="submit" className="btn" disabled={user?.role !== "kupac"}>
          Potvrdi rezervaciju
        </button>
      </form>
    </div>
  );
}
