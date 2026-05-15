import { useCallback, useEffect, useState } from "react";
import { ApiError, apiJson, apiVoid } from "../lib/api";

type Kategorija = {
  kategorija_id: number;
  naziv: string;
  opis: string | null;
};

export default function KategorijePage() {
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Kategorija[]>([]);
  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);

  const [urediId, setUrediId] = useState<number | null>(null);
  const [naziv, setNaziv] = useState("");
  const [opis, setOpis] = useState("");

  const load = useCallback(async () => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const rows = await apiJson<Kategorija[]>(`/api/kategorije${qs}`);
    setLista(rows);
  }, [q]);

  useEffect(() => {
    let o = false;
    setGreska(null);
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!o) setGreska(e instanceof ApiError ? e.message : "Greška");
      }
    })();
    return () => {
      o = true;
    };
  }, [load]);

  function nova() {
    setUrediId(null);
    setNaziv("");
    setOpis("");
    setPoruka("Novi unos — popuni i spremi.");
  }

  function odaberi(k: Kategorija) {
    setUrediId(k.kategorija_id);
    setNaziv(k.naziv);
    setOpis(k.opis ?? "");
    setPoruka(null);
  }

  async function spremi() {
    setGreska(null);
    setPoruka(null);
    const body = { naziv: naziv.trim(), opis: opis.trim() || null };
    if (!body.naziv) {
      setGreska("Naziv je obavezan.");
      return;
    }
    try {
      if (urediId == null) {
        await apiJson<Kategorija>("/api/kategorije", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        setPoruka("Kategorija je kreirana.");
      } else {
        await apiJson<Kategorija>(`/api/kategorije/${urediId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        setPoruka("Kategorija je ažurirana.");
      }
      await load();
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška spremanja");
    }
  }

  async function obrisi() {
    if (urediId == null) return;
    if (
      !confirm(
        `Obrisati kategoriju #${urediId} i sve vrste bicikala u njoj? Uklonit će se i jedinice, stavke narudžbi, najmovi i plaćanja najma povezana s tim biciklima.`,
      )
    )
      return;
    setGreska(null);
    setPoruka(null);
    try {
      await apiVoid(`/api/kategorije/${urediId}?force=1`, { method: "DELETE" });
      setUrediId(null);
      setNaziv("");
      setOpis("");
      setPoruka("Obrisano.");
      await load();
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška brisanja");
    }
  }

  return (
    <div className="kategorije-page">
      <h2>Šifrarnik — kategorije bicikla</h2>
      {greska && <p className="greska">{greska}</p>}
      {poruka && <p className="poruka">{poruka}</p>}

      <div className="forma-blok forma-blok--filter">
        <label>
          Pretraga po nazivu
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="" />
        </label>
        <button type="button" className="btn btn-sekundarni" onClick={() => void load()}>
          Osvježi
        </button>
        <button type="button" className="btn" onClick={nova}>
          Nova kategorija
        </button>
      </div>

      <div className="forma-blok">
        <h3>{urediId == null ? "Novi zapis" : `Uredi #${urediId}`}</h3>
        <label>
          Naziv *
          <input value={naziv} onChange={(e) => setNaziv(e.target.value)} />
        </label>
        <label>
          Opis
          <textarea value={opis} onChange={(e) => setOpis(e.target.value)} rows={3} />
        </label>
        <div className="btn-row">
          <button type="button" className="btn" onClick={spremi}>
            Spremi
          </button>
          {urediId != null && (
            <button type="button" className="btn" onClick={obrisi}>
              Obriši
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table className="tablica">
          <thead>
            <tr>
              <th>ID</th>
              <th>Naziv</th>
              <th>Opis</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((k) => (
              <tr key={k.kategorija_id}>
                <td>{k.kategorija_id}</td>
                <td>{k.naziv}</td>
                <td className="tablica-opis">{k.opis ?? "—"}</td>
                <td>
                  <button type="button" className="btn btn-mali btn-sekundarni" onClick={() => odaberi(k)}>
                    Uredi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
