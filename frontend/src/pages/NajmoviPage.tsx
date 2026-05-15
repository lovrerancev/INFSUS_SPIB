import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiJson } from "../lib/api";

type NajamRed = {
  najam_id: number;
  datum_pocetka: string;
  datum_zavrsetka: string;
  status_najma: string;
  ukupna_cijena: string;
  jedinica_id: number;
  bicikl_naziv: string | null;
  kupac_korisnik_id: number;
  kupac_ime: string | null;
  kupac_prezime: string | null;
  prikaz_statusa?: string;
};

export default function NajmoviPage() {
  const { user } = useAuth();
  const [lista, setLista] = useState<NajamRed[]>([]);
  const [kasni, setKasni] = useState<NajamRed[]>([]);
  const [greska, setGreska] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (user?.role !== "djelatnik") return;
    setGreska(null);
    try {
      const [a, b] = await Promise.all([
        apiJson<NajamRed[]>("/api/najmovi"),
        apiJson<NajamRed[]>("/api/najmovi/obavijesti-kasnjenje"),
      ]);
      setLista(a);
      setKasni(b);
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška učitavanja");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function vraceno(id: number) {
    setGreska(null);
    try {
      await apiJson(`/api/najmovi/${id}/vraceno`, { method: "PATCH" });
      await load();
    } catch (e) {
      setGreska(e instanceof ApiError ? e.message : "Greška");
    }
  }

  if (user?.role !== "djelatnik") {
    return (
      <div className="panel">
        <p>Ova stranica je samo za djelatnike (pregled najmova i kašnjenja).</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Najmovi</h2>
      {greska && <p className="greska">{greska}</p>}
      <h3>Obavijest: kašnjenje duže od 24 sata</h3>
      {kasni.length === 0 ? (
        <p className="hint">Nema aktivnih najmova s kašnjenjem.</p>
      ) : (
        <ul>
          {kasni.map((n) => (
            <li key={n.najam_id}>
              #{n.najam_id} · {n.bicikl_naziv} · {n.kupac_prezime} {n.kupac_ime} · do {n.datum_zavrsetka}
            </li>
          ))}
        </ul>
      )}
      <h3>Svi najmovi</h3>
      <div className="table-wrap">
        <table className="tablica">
          <thead>
            <tr>
              <th>#</th>
              <th>Jedinica / model</th>
              <th>Kupac</th>
              <th>Od–do</th>
              <th>Status</th>
              <th>Cijena</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((n) => (
              <tr key={n.najam_id}>
                <td>{n.najam_id}</td>
                <td>
                  #{n.jedinica_id} · {n.bicikl_naziv}
                </td>
                <td>
                  {n.kupac_prezime} {n.kupac_ime}
                </td>
                <td>
                  {n.datum_pocetka} → {n.datum_zavrsetka}
                </td>
                <td>{n.prikaz_statusa ?? n.status_najma}</td>
                <td>{n.ukupna_cijena} €</td>
                <td>
                  {n.status_najma === "AKTIVAN" ? (
                    <button type="button" className="btn btn-mali" onClick={() => void vraceno(n.najam_id)}>
                      Označi vraćeno
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
