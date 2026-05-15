import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiJson } from "../lib/api";

function rasponTekucegMjeseca(): { od: string; doDat: string } {
  const sada = new Date();
  const g = sada.getFullYear();
  const m = sada.getMonth();
  const zadnji = new Date(g, m + 1, 0);
  const mm = String(m + 1).padStart(2, "0");
  const dd2 = String(zadnji.getDate()).padStart(2, "0");
  return { od: `${g}-${mm}-01`, doDat: `${g}-${mm}-${dd2}` };
}

export default function IzvjestajiPage() {
  const { user } = useAuth();
  const [od, setOd] = useState("");
  const [doDat, setDoDat] = useState("");
  const [prodaja, setProdaja] = useState<{
    broj_zavrsenih_narudzbi: number;
    ukupni_prihod: string;
    broj_stavki: number;
  } | null>(null);
  const [najam, setNajam] = useState<{ broj_najmova: number; ukupna_naplatena_najma: string } | null>(null);
  const [greska, setGreska] = useState<string | null>(null);

  useEffect(() => {
    const { od: o, doDat: d } = rasponTekucegMjeseca();
    setOd(o);
    setDoDat(d);
  }, []);

  async function pokreniProdaja() {
    setGreska(null);
    if (!od || !doDat) {
      setGreska("Odaberite datum početka i kraja razdoblja.");
      return;
    }
    try {
      const r = await apiJson<{
        broj_zavrsenih_narudzbi: number;
        ukupni_prihod: string;
        broj_stavki: number;
      }>(`/api/izvjestaji/prodaja?od=${encodeURIComponent(od)}&do=${encodeURIComponent(doDat)}`);
      setProdaja(r);
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška");
    }
  }

  async function pokreniNajam() {
    setGreska(null);
    if (!od || !doDat) {
      setGreska("Odaberite datum početka i kraja razdoblja.");
      return;
    }
    try {
      const r = await apiJson<{ broj_najmova: number; ukupna_naplatena_najma: string }>(
        `/api/izvjestaji/najam?od=${encodeURIComponent(od)}&do=${encodeURIComponent(doDat)}`,
      );
      setNajam(r);
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška");
    }
  }

  if (user?.role !== "administrator") {
    return (
      <div className="panel">
        <p>Izvještaji su dostupni samo administratoru.</p>
      </div>
    );
  }

  const rasponNijeOdabran = !od || !doDat;

  return (
    <div className="panel">
      <h2>Izvještaji</h2>
      {greska && <p className="greska">{greska}</p>}
      <div className="forma-blok">
        <label>
          Od
          <input type="date" value={od} onChange={(e) => setOd(e.target.value)} />
        </label>
        <label>
          Do
          <input type="date" value={doDat} onChange={(e) => setDoDat(e.target.value)} />
        </label>
        <button type="button" className="btn" disabled={rasponNijeOdabran} onClick={() => void pokreniProdaja()}>
          Izvještaj prodaje
        </button>
        <button
          type="button"
          className="btn btn-sekundarni"
          disabled={rasponNijeOdabran}
          onClick={() => void pokreniNajam()}
        >
          Izvještaj najma
        </button>
      </div>
      <p className="hint" style={{ marginTop: "0.75rem" }}>
        <strong>Prodaja:</strong> broji se narudžba kada djelatnik <strong>prvi put potvrdi</strong> narudžbu (status{" "}
        <strong>Potvrđena</strong>), po datumu knjiženja (<code>datum_zavrsetka</code>, inače datum kreiranja). U
        razdoblje ne ulaze narudžbe u statusu Nova. Naslijeđeno: i dalje se broji <strong>Završena</strong> ako je tako
        zapisano u bazi.
      </p>
      <p className="hint" style={{ marginTop: "0.35rem" }}>
        <strong>Najam:</strong> broje se najmovi čiji je <strong>datum početka</strong> u razdoblju.
      </p>
      {prodaja && (
        <div className="izvj-blok">
          <h3>Rezultat — prodaja</h3>
          <p>Potvrđenih narudžbi (prodaja u razdoblju): {prodaja.broj_zavrsenih_narudzbi}</p>
          <p>Ukupni prihod (stavke): {prodaja.ukupni_prihod} €</p>
          <p>Broj prodanih jedinica (stavke): {prodaja.broj_stavki}</p>
          {prodaja.broj_zavrsenih_narudzbi === 0 && (
            <p className="hint" style={{ marginTop: "0.5rem" }}>
              Nema potvrđenih narudžbi (knjižene prodaje) u ovom rasponu. Narudžbe u statusu Nova vide se u modulu
              Narudžbe; u izvještaj ulaze tek nakon što djelatnik potvrdi narudžbu (Nova → Potvrđena).
            </p>
          )}
        </div>
      )}
      {najam && (
        <div className="izvj-blok">
          <h3>Rezultat — najam</h3>
          <p>Broj najmova (početak u razdoblju): {najam.broj_najmova}</p>
          <p>Ukupno naplaćeno: {najam.ukupna_naplatena_najma} €</p>
          {najam.broj_najmova === 0 && (
            <p className="hint" style={{ marginTop: "0.5rem" }}>
              Nema najmova s datumom početka u odabranom razdoblju.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
