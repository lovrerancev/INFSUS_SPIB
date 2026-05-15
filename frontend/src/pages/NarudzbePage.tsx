import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiJson } from "../lib/api";

type NarudzbaList = {
  narudzba_id: number;
  datum: string;
  status: string;
  adresa_dostave: string;
  nacin_placanja: string;
  kupac_korisnik_id: number;
  kupac_ime: string;
  kupac_prezime: string;
  djelatnik_korisnik_id: number | null;
  djelatnik_ime: string | null;
  djelatnik_prezime: string | null;
};

type Stavka = {
  stavka_id: number;
  kolicina: number;
  cijena: string;
  jedinica_id: number;
  narudzba_id: number;
  bicikl_naziv: string | null;
  bicikl_inventarni_broj: string | null;
};

type NarudzbaDetalj = NarudzbaList & {
  stavke: Stavka[];
};

type NarudzbaStatusOpcija = { kod: string; naziv: string };

const NACINI = [
  { v: "POUZEĆE", l: "Pouzeće" },
  { v: "KARTICA", l: "Kartica" },
  { v: "TRANSAKCIJSKI_RACUN", l: "Transakcijski račun" },
];

function statusPrikaz(kod: string, statusi: NarudzbaStatusOpcija[]) {
  const s = statusi.find((x) => x.kod === kod);
  return s ? s.naziv : kod;
}

export default function NarudzbePage() {
  const { user } = useAuth();
  const [lista, setLista] = useState<NarudzbaList[]>([]);
  const [statusi, setStatusi] = useState<NarudzbaStatusOpcija[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalj, setDetalj] = useState<NarudzbaDetalj | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [loadDetalj, setLoadDetalj] = useState(0);

  const [potvrdaUcitavanje, setPotvrdaUcitavanje] = useState(false);

  const loadSifre = useCallback(async () => {
    const st = await apiJson<NarudzbaStatusOpcija[]>("/api/narudzbe/statusi");
    setStatusi(st);
  }, []);

  const loadLista = useCallback(async () => {
    const rows = await apiJson<NarudzbaList[]>("/api/narudzbe?limit=100");
    setLista(rows);
  }, []);

  useEffect(() => {
    let o = false;
    setGreska(null);
    (async () => {
      try {
        await loadSifre();
        await loadLista();
      } catch (e) {
        if (!o) setGreska(e instanceof ApiError ? e.message : "Greška učitavanja");
      }
    })();
    return () => {
      o = true;
    };
  }, [loadLista, loadSifre]);

  useEffect(() => {
    if (selectedId == null) {
      setDetalj(null);
      return;
    }
    let o = false;
    setGreska(null);
    (async () => {
      try {
        const d = await apiJson<NarudzbaDetalj>(`/api/narudzbe/${selectedId}`);
        if (!o) {
          setDetalj(d);
        }
      } catch (e) {
        if (!o) setGreska(e instanceof ApiError ? e.message : "Greška detalja");
      }
    })();
    return () => {
      o = true;
    };
  }, [selectedId, loadDetalj]);

  async function potvrdiNarudzbu() {
    if (selectedId == null || !detalj) return;
    setGreska(null);
    setPotvrdaUcitavanje(true);
    try {
      await apiJson<NarudzbaDetalj>(`/api/narudzbe/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "POTVRDJENA" }),
      });
      setLoadDetalj((x) => x + 1);
      await loadLista();
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška potvrde");
    } finally {
      setPotvrdaUcitavanje(false);
    }
  }

  return (
    <div className="grid-dva">
      <section className="panel">
        <div className="panel-head">
          <h2>Narudžbe</h2>
        </div>
        <p className="hint">
          Novu narudžbu kupnje kreirate na stranici <strong>Kupnja</strong>. Rezervacija najma ide preko{" "}
          <strong>Najam</strong> (nije narudžba kupnje).
        </p>
        {!user && <p className="hint">Za pregled vlastitih narudžbi prijavite se kao kupac.</p>}
        <ul className="lista-nar">
          {lista.map((n) => (
            <li key={n.narudzba_id}>
              <button
                type="button"
                className={selectedId === n.narudzba_id ? "lista-nar__btn lista-nar__btn--akt" : "lista-nar__btn"}
                onClick={() => setSelectedId(n.narudzba_id)}
              >
                <span className="lista-nar__id">#{n.narudzba_id}</span>
                <span className="lista-nar__meta">
                  {statusPrikaz(n.status, statusi)} · {n.kupac_prezime} {n.kupac_ime}
                  {n.djelatnik_prezime != null &&
                    n.djelatnik_ime != null &&
                    n.djelatnik_korisnik_id != null && (
                    <>
                      {" "}
                      · potvrdio/la {n.djelatnik_prezime} {n.djelatnik_ime}
                    </>
                  )}
                </span>
                <span className="lista-nar__dat">{n.datum}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel panel--siroko">
        <h2>Detalj</h2>
        {greska && <p className="greska">{greska}</p>}
        {!selectedId && <p className="hint">Odaberi narudžbu s lijeve strane.</p>}
        {selectedId != null && !detalj && <p>Učitavanje…</p>}
        {detalj && (
          <>
            <div className="forma-blok forma-blok--zag">
              <p>
                <strong>#{detalj.narudzba_id}</strong> · {detalj.datum}
              </p>
              <p>
                Kupac: {detalj.kupac_prezime} {detalj.kupac_ime}
              </p>
              <p>
                <strong>Status:</strong> {statusPrikaz(detalj.status, statusi)}
              </p>
              <p>
                <strong>Djelatnik (potvrda):</strong>{" "}
                {detalj.djelatnik_korisnik_id != null &&
                detalj.djelatnik_ime != null &&
                detalj.djelatnik_prezime != null
                  ? `${detalj.djelatnik_prezime}, ${detalj.djelatnik_ime} (#${detalj.djelatnik_korisnik_id})`
                  : "—"}
              </p>
              <p>
                <strong>Adresa dostave:</strong> {detalj.adresa_dostave}
              </p>
              <p>
                <strong>Način plaćanja:</strong>{" "}
                {NACINI.find((x) => x.v === detalj.nacin_placanja)?.l ?? detalj.nacin_placanja}
              </p>
              {user?.role === "djelatnik" && detalj.status === "NOVA" && (
                <p style={{ marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={potvrdaUcitavanje}
                    onClick={() => void potvrdiNarudzbu()}
                  >
                    {potvrdaUcitavanje ? "Potvrda…" : "Potvrdi narudžbu (Nova → Potvrđena)"}
                  </button>
                </p>
              )}
              <p className="hint" style={{ marginBottom: 0 }}>
                {user?.role === "kupac" && detalj.kupac_korisnik_id === user.korisnik_id
                  ? "Ovo je samo pregled vaše narudžbe i stavki. Izmjene (uključujući zaglavlje) mogu izvršiti samo djelatnici u skladu s poslovnim pravilima."
                  : user?.role === "djelatnik"
                    ? "Kao djelatnik potvrđujete narudžbu u statusu Nova (Nova → Potvrđena); prodaja se tada knjiži i ulazi u izvještaj prodaje."
                    : "Zaglavlje je samo za pregled."}
              </p>
            </div>

            <h3>Stavke</h3>
            <div className="table-wrap">
              <table className="tablica">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jedinica</th>
                    <th>Kol.</th>
                    <th>Cijena</th>
                  </tr>
                </thead>
                <tbody>
                  {detalj.stavke.map((s) => (
                    <tr key={s.stavka_id}>
                      <td>{s.stavka_id}</td>
                      <td>
                        #{s.jedinica_id} · {s.bicikl_inventarni_broj ?? "?"} · {s.bicikl_naziv ?? "?"}
                      </td>
                      <td>{s.kolicina}</td>
                      <td>{s.cijena}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
