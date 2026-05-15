import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiJson } from "../lib/api";
import { statusBicikla } from "../lib/biciklStatus";

type KatOpt = { kategorijaId: number; naziv: string };

type BiciklKatalog = {
  bicikl_id: number;
  inventarni_broj: string;
  naziv: string;
  cijena: string;
  kolicina: number;
  status: string;
  kategorija_id: number;
  kategorija_naziv: string | null;
  cijena_najma_po_danu: string | null;
};

export default function KatalogPage() {
  const { user, loading: authUcitavanje } = useAuth();
  const isDjelatnik = user?.role === "djelatnik";
  const isAdministrator = user?.role === "administrator";
  const [kategorije, setKategorije] = useState<KatOpt[]>([]);
  const [katId, setKatId] = useState("");
  const [q, setQ] = useState("");
  const [cijenaOd, setCijenaOd] = useState("");
  const [cijenaDo, setCijenaDo] = useState("");
  /** Samo za djelatnika: kupci i gosti uvijek vide samo jedinice koje se stvarno mogu naručiti. */
  const [djelatnikSamoDostupni, setDjelatnikSamoDostupni] = useState(false);
  const [rows, setRows] = useState<BiciklKatalog[]>([]);
  const [greska, setGreska] = useState<string | null>(null);

  const loadKat = useCallback(async () => {
    const k = await apiJson<Array<{ kategorijaId: number; naziv: string }>>("/api/kategorije/za-odabir");
    setKategorije(k.map((x) => ({ kategorijaId: x.kategorijaId, naziv: x.naziv })));
  }, []);

  const pretrazi = useCallback(async () => {
    setGreska(null);
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (katId) p.set("kategorija_id", katId);
    if (cijenaOd) p.set("cijena_od", cijenaOd);
    if (cijenaDo) p.set("cijena_do", cijenaDo);
    const kupackiPrikaz = !isDjelatnik;
    if (kupackiPrikaz || djelatnikSamoDostupni) p.set("samo_dostupni", "1");
    try {
      const list = await apiJson<BiciklKatalog[]>(`/api/katalog/bicikli?${p.toString()}`);
      setRows(list);
    } catch (e) {
      setGreska(e instanceof Error ? e.message : "Greška");
    }
  }, [q, katId, cijenaOd, cijenaDo, djelatnikSamoDostupni, isDjelatnik]);

  useEffect(() => {
    if (user?.role === "administrator") return;
    void loadKat();
  }, [loadKat, user?.role]);

  useEffect(() => {
    if (user?.role === "administrator") return;
    void pretrazi();
  }, [pretrazi, user?.role]);

  if (authUcitavanje) {
    return (
      <div className="panel">
        <p>Učitavanje…</p>
      </div>
    );
  }

  if (isAdministrator) {
    return (
      <div className="panel">
        <h2>Katalog</h2>
        <p>Katalog nije dostupan administratoru.</p>
        <p>
          <Link to="/">Natrag na početnu</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Katalog bicikala</h2>
      {!isDjelatnik && (
        <p className="hint">
          Prikazane su <strong>vrste</strong> (modeli) s barem jednom jedinicom <strong>dostupnom za kupnju</strong>.
          Kupnja dodjeljuje konkretne jedinice u pozadini. Djelatnik u punom pregledu vidi i ostale statuse.
        </p>
      )}
      {greska && <p className="greska">{greska}</p>}
      <div className="forma-blok forma-blok--zag">
        <label>
          Naziv ili inventarni broj
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="pretraga…" />
        </label>
        <label>
          Kategorija
          <select value={katId} onChange={(e) => setKatId(e.target.value)}>
            <option value="">— sve —</option>
            {kategorije.map((k) => (
              <option key={k.kategorijaId} value={String(k.kategorijaId)}>
                {k.naziv}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cijena od
          <input type="number" min={0} value={cijenaOd} onChange={(e) => setCijenaOd(e.target.value)} />
        </label>
        <label>
          Cijena do
          <input type="number" min={0} value={cijenaDo} onChange={(e) => setCijenaDo(e.target.value)} />
        </label>
        {isDjelatnik && (
          <label className="chk-inline">
            <input
              type="checkbox"
              checked={djelatnikSamoDostupni}
              onChange={(e) => setDjelatnikSamoDostupni(e.target.checked)}
            />
            Samo dostupni za kupnju (kupci vide samo ovaj skup)
          </label>
        )}
      </div>
      <div className="kartice-katalog">
        {rows.map((b) => (
          <article key={b.bicikl_id} className="kartica-bicikl">
            {isDjelatnik ? (
              <>
                <p className="kartica-bicikl__id">
                  Vrsta <strong>#{b.bicikl_id}</strong>
                </p>
                <h3>{b.naziv}</h3>
                <p className="kartica-bicikl__meta">
                  {b.kategorija_naziv} · <span className="status-znacka">{statusBicikla(b.status)}</span>
                </p>
              </>
            ) : (
              <>
                <h3>{b.naziv}</h3>
                <p className="kartica-bicikl__id" style={{ marginTop: 0 }}>
                  <span className="hint" style={{ fontSize: "0.92em", fontWeight: 500 }}>
                    Model #{b.bicikl_id}
                  </span>
                </p>
                <p className="kartica-bicikl__meta">{b.kategorija_naziv}</p>
              </>
            )}
            <p>
              Prodaja: <strong>{b.cijena} €</strong>
            </p>
            <p>
              Najam/dan:{" "}
              <strong>
                {b.cijena_najma_po_danu != null && String(b.cijena_najma_po_danu).trim() !== ""
                  ? `${b.cijena_najma_po_danu} €`
                  : "nije postavljeno"}
              </strong>
            </p>
            <p>Dostupnih jedinica: {b.kolicina}</p>
            {user?.role === "kupac" && b.status === "DOSTUPAN" && b.kolicina > 0 && (
              <p style={{ marginTop: "0.65rem" }}>
                <Link to={`/kupnja?bicikl=${b.bicikl_id}`} className="btn btn-mali">
                  Kupi
                </Link>
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
