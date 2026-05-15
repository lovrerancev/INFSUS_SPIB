import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiJson } from "../lib/api";
import { statusBicikla } from "../lib/biciklStatus";

type BiciklKatalog = {
  bicikl_id: number;
  inventarni_broj: string;
  naziv: string;
  cijena: string;
  kolicina: number;
  status: string;
  kategorija_naziv: string | null;
};

const NACINI = [
  { v: "POUZEĆE", l: "Pouzeće" },
  { v: "KARTICA", l: "Kartica" },
  { v: "TRANSAKCIJSKI_RACUN", l: "Transakcijski račun" },
];

export default function KupnjaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const biciklIzQuery = searchParams.get("bicikl");

  const [lista, setLista] = useState<BiciklKatalog[]>([]);
  const [biciklId, setBiciklId] = useState<number | "">("");
  const [kolicina, setKolicina] = useState(1);
  const [adresa, setAdresa] = useState("");
  const [nacin, setNacin] = useState("POUZEĆE");
  const [greska, setGreska] = useState<string | null>(null);
  const [uspjehId, setUspjehId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const rows = await apiJson<BiciklKatalog[]>("/api/katalog/bicikli?samo_dostupni=1");
    setLista(rows);
  }, []);

  useEffect(() => {
    void load().catch(() => setLista([]));
  }, [load]);

  useEffect(() => {
    if (biciklIzQuery) {
      const id = Number(biciklIzQuery);
      if (Number.isFinite(id) && id > 0) setBiciklId(id);
    }
  }, [biciklIzQuery]);

  const odabrani = lista.find((b) => b.bicikl_id === biciklId);
  const maxKol = odabrani?.kolicina ?? 0;

  async function naruci(e: React.FormEvent) {
    e.preventDefault();
    setGreska(null);
    setUspjehId(null);
    if (user?.role !== "kupac") {
      setGreska("Morate biti prijavljeni kao kupac.");
      return;
    }
    if (biciklId === "") {
      setGreska("Odaberite bicikl.");
      return;
    }
    if (!adresa.trim()) {
      setGreska("Adresa dostave je obavezna.");
      return;
    }
    if (kolicina < 1 || kolicina > maxKol) {
      setGreska("Nevaljana količina.");
      return;
    }
    try {
      const d = await apiJson<{ narudzba_id: number }>("/api/kupnja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bicikl_id: biciklId,
          kolicina,
          adresa_dostave: adresa.trim(),
          nacin_placanja: nacin,
        }),
      });
      setUspjehId(d.narudzba_id);
      await load();
      setBiciklId("");
      setKolicina(1);
      setAdresa("");
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Greška");
    }
  }

  if (!user) {
    return (
      <div className="panel" style={{ maxWidth: 520 }}>
        <h2>Kupnja bicikla</h2>
        <p className="hint">
          Za kupnju se{" "}
          <Link to="/prijava" className="nav-a">
            prijavite kao kupac
          </Link>
          .
        </p>
      </div>
    );
  }

  if (user.role !== "kupac") {
    return (
      <div className="panel">
        <h2>Kupnja bicikla</h2>
        <p>Ova stranica je namijenjena kupcima. Djelatnici koriste narudžbe u radnom tijeku.</p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <h2>Kupnja bicikla</h2>
      <p className="hint">
        Odaberite <strong>vrstu</strong> (model) i <strong>količinu</strong> — sustav dodjeljuje toliko{" "}
        <strong>dostupnih jedinica</strong> te vrste. Svaka jedinica ima vlastiti inventarni broj; pojedinačno
        birate ih u narudžbama kao djelatnik.
      </p>
      {greska && <p className="greska">{greska}</p>}
      {uspjehId != null && (
        <p className="hint">
          Narudžba <strong>#{uspjehId}</strong> je kreirana.{" "}
          <button type="button" className="btn btn-mali btn-sekundarni" onClick={() => navigate("/narudzbe")}>
            Otvori narudžbe
          </button>
        </p>
      )}
      {lista.length === 0 ? (
        <p className="hint">Trenutačno nema modela s dostupnim jedinicama za kupnju.</p>
      ) : (
        <form className="forma-blok" onSubmit={naruci}>
          <label>
            Model (vrsta # · naziv · cijena · broj dostupnih jedinica)
            <select
              value={biciklId === "" ? "" : String(biciklId)}
              onChange={(e) => setBiciklId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">— odaberi —</option>
              {lista.map((b) => (
                <option key={b.bicikl_id} value={b.bicikl_id}>
                  #{b.bicikl_id} · {b.naziv} — {b.cijena} € ({b.kolicina} dost., {statusBicikla(b.status)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Količina
            <input
              type="number"
              min={1}
              max={maxKol || 1}
              value={kolicina}
              onChange={(e) => setKolicina(Number(e.target.value))}
              disabled={biciklId === ""}
            />
          </label>
          <label>
            Adresa dostave
            <textarea
              rows={3}
              value={adresa}
              onChange={(e) => setAdresa(e.target.value)}
              required
              placeholder="Ulica, broj, grad, poštanski broj…"
            />
          </label>
          <label>
            Način plaćanja
            <select value={nacin} onChange={(e) => setNacin(e.target.value)}>
              {NACINI.map((n) => (
                <option key={n.v} value={n.v}>
                  {n.l}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn">
            Naruči
          </button>
        </form>
      )}
    </div>
  );
}
