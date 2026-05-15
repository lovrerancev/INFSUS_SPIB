import { Fragment, useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiJson, apiVoid } from "../lib/api";
import { statusBicikla } from "../lib/biciklStatus";

/** Agregat vrste (model) iz kataloga. */
type Vrsta = {
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

type Jedinica = {
  jedinica_id: number;
  bicikl_id: number;
  inventarni_broj: string;
  status: string;
  naziv: string;
  cijena: string;
  cijena_najma_po_danu: string | null;
};

type KatOpt = { kategorijaId: number; naziv: string };

type UrediVrsta = {
  naziv: string;
  cijena: string;
  kategorija_id: number;
  cijena_najma_po_danu: string;
};

const STATUSI = ["DOSTUPAN", "IZNAJMLJEN", "PRODAN", "U_SERVISU", "NEDOSTUPAN"];

function formVrsta(b: Vrsta): UrediVrsta {
  return {
    naziv: b.naziv,
    cijena: b.cijena,
    kategorija_id: b.kategorija_id,
    cijena_najma_po_danu:
      b.cijena_najma_po_danu != null && String(b.cijena_najma_po_danu).trim() !== ""
        ? String(b.cijena_najma_po_danu)
        : "",
  };
}

export default function BicikliAdminPage() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Vrsta[]>([]);
  const [kat, setKat] = useState<KatOpt[]>([]);
  const [greska, setGreska] = useState<string | null>(null);

  const [editVrstaId, setEditVrstaId] = useState<number | null>(null);
  const [urediVrsta, setUrediVrsta] = useState<UrediVrsta | null>(null);

  const [expandedVrsta, setExpandedVrsta] = useState<number | null>(null);
  const [jedinice, setJedinice] = useState<Jedinica[]>([]);
  const [novaJedStatus, setNovaJedStatus] = useState("DOSTUPAN");

  const [editJedId, setEditJedId] = useState<number | null>(null);
  const [editJedInv, setEditJedInv] = useState("");
  const [editJedStatus, setEditJedStatus] = useState("DOSTUPAN");

  const load = useCallback(async () => {
    if (user?.role !== "djelatnik") return;
    const [b, k] = await Promise.all([
      apiJson<Vrsta[]>("/api/katalog/bicikli"),
      apiJson<Array<{ kategorijaId: number; naziv: string }>>("/api/kategorije/za-odabir"),
    ]);
    setLista(b);
    setKat(k.map((x) => ({ kategorijaId: x.kategorijaId, naziv: x.naziv })));
  }, [user]);

  const loadJedinice = useCallback(async (vrstaId: number) => {
    const j = await apiJson<Jedinica[]>(`/api/bicikli/${vrstaId}/jedinice`);
    setJedinice(j);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (expandedVrsta != null) void loadJedinice(expandedVrsta).catch(() => setJedinice([]));
  }, [expandedVrsta, loadJedinice]);

  function pocniUrediVrstu(b: Vrsta) {
    setGreska(null);
    setEditVrstaId(b.bicikl_id);
    setUrediVrsta(formVrsta(b));
    setExpandedVrsta(null);
  }

  function odustaniVrsta() {
    setEditVrstaId(null);
    setUrediVrsta(null);
    setGreska(null);
  }

  async function spremiVrstu() {
    if (editVrstaId == null || !urediVrsta) return;
    setGreska(null);
    try {
      await apiJson(`/api/bicikli/${editVrstaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naziv: urediVrsta.naziv.trim(),
          cijena: urediVrsta.cijena.trim(),
          kategorija_id: urediVrsta.kategorija_id,
          cijena_najma_po_danu: urediVrsta.cijena_najma_po_danu.trim() || null,
        }),
      });
      odustaniVrsta();
      await load();
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Greška");
    }
  }

  async function dodajJedinicu(vrstaId: number) {
    setGreska(null);
    try {
      await apiJson(`/api/bicikli/${vrstaId}/jedinice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventarni_broj: null,
          status: novaJedStatus,
        }),
      });
      setNovaJedStatus("DOSTUPAN");
      await loadJedinice(vrstaId);
      await load();
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Greška");
    }
  }

  async function spremiJedinicu() {
    if (editJedId == null) return;
    setGreska(null);
    try {
      await apiJson(`/api/bicikli/jedinice/${editJedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventarni_broj: editJedInv.trim(),
          status: editJedStatus,
        }),
      });
      setEditJedId(null);
      if (expandedVrsta != null) await loadJedinice(expandedVrsta);
      await load();
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Greška");
    }
  }

  async function obrisiJedinicu(jid: number) {
    if (
      !confirm(
        "Obrisati ovu jedinicu? Ako postoje stavke narudžbe ili najmovi, bit će uklonjeni zajedno s povezanim plaćanjima najma.",
      )
    )
      return;
    setGreska(null);
    try {
      await apiVoid(`/api/bicikli/jedinice/${jid}?force=1`, { method: "DELETE" });
      if (expandedVrsta != null) await loadJedinice(expandedVrsta);
      await load();
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Greška");
    }
  }

  async function obrisiVrstu(id: number) {
    if (
      !confirm(
        "Obrisati cijelu vrstu (model) i sve njene jedinice? Povezane stavke narudžbi, najmovi i plaćanja najma bit će uklonjeni.",
      )
    )
      return;
    setGreska(null);
    if (editVrstaId === id) odustaniVrsta();
    if (expandedVrsta === id) setExpandedVrsta(null);
    try {
      await apiVoid(`/api/bicikli/${id}?force=1`, { method: "DELETE" });
      await load();
    } catch (err) {
      setGreska(err instanceof ApiError ? err.message : "Greška");
    }
  }

  if (user?.role !== "djelatnik") {
    return (
      <div className="panel">
        <p>Upravljanje katalogom bicikala dostupno je samo djelatnicima.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      {greska && <p className="greska">{greska}</p>}
      <h2>Postojeće vrste</h2>
      <div className="table-wrap">
        <table className="tablica">
          <thead>
            <tr>
              <th />
              <th>Vrsta #</th>
              <th>Naziv</th>
              <th>Kat.</th>
              <th>Cijena</th>
              <th>Najam/d</th>
              <th>Dostupno</th>
              <th>Akcija</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((b) => {
              const u = editVrstaId === b.bicikl_id ? urediVrsta : null;
              const otv = expandedVrsta === b.bicikl_id;
              const blokBrisanjeJed = otv && expandedVrsta === b.bicikl_id && editJedId !== null;
              return (
                <Fragment key={b.bicikl_id}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        className="btn btn-mali btn-sekundarni"
                        onClick={() => {
                          setExpandedVrsta(otv ? null : b.bicikl_id);
                          setEditJedId(null);
                        }}
                        disabled={editVrstaId !== null}
                      >
                        {otv ? "Sakrij" : "Jedinice"}
                      </button>
                    </td>
                    <td>{b.bicikl_id}</td>
                    <td>
                      {u ? (
                        <input
                          className="tablica-cel-input tablica-cel-naziv"
                          value={u.naziv}
                          onChange={(e) => setUrediVrsta({ ...u, naziv: e.target.value })}
                        />
                      ) : (
                        b.naziv
                      )}
                    </td>
                    <td>
                      {u ? (
                        <select
                          className="tablica-cel-input"
                          value={u.kategorija_id}
                          onChange={(e) => setUrediVrsta({ ...u, kategorija_id: Number(e.target.value) })}
                        >
                          {kat.map((k) => (
                            <option key={k.kategorijaId} value={k.kategorijaId}>
                              {k.naziv}
                            </option>
                          ))}
                        </select>
                      ) : (
                        b.kategorija_naziv
                      )}
                    </td>
                    <td>
                      {u ? (
                        <input
                          className="tablica-cel-input"
                          value={u.cijena}
                          onChange={(e) => setUrediVrsta({ ...u, cijena: e.target.value })}
                        />
                      ) : (
                        b.cijena
                      )}
                    </td>
                    <td>
                      {u ? (
                        <input
                          className="tablica-cel-input"
                          value={u.cijena_najma_po_danu}
                          onChange={(e) => setUrediVrsta({ ...u, cijena_najma_po_danu: e.target.value })}
                          placeholder="prazno = nema"
                        />
                      ) : b.cijena_najma_po_danu != null && String(b.cijena_najma_po_danu).trim() !== "" ? (
                        b.cijena_najma_po_danu
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <strong>{b.kolicina}</strong> dost. · {statusBicikla(b.status)}
                    </td>
                    <td className="tablica-akcije">
                      {u ? (
                        <>
                          <button type="button" className="btn btn-mali" onClick={() => void spremiVrstu()}>
                            Spremi
                          </button>
                          <button type="button" className="btn btn-mali btn-sekundarni" onClick={odustaniVrsta}>
                            Odustani
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-mali"
                          onClick={() => pocniUrediVrstu(b)}
                          disabled={editVrstaId !== null}
                        >
                          Uredi vrstu
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-mali btn-sekundarni"
                        onClick={() => void obrisiVrstu(b.bicikl_id)}
                        disabled={editVrstaId !== null || blokBrisanjeJed}
                      >
                        Obriši vrstu
                      </button>
                    </td>
                  </tr>
                  {otv && (
                    <tr>
                      <td colSpan={8} style={{ background: "var(--pozadina-naglasak, #f6f8fa)", padding: "0.75rem" }}>
                        <h4 style={{ margin: "0 0 0.5rem" }}>Jedinice vrste „{b.naziv}”</h4>
                        <div className="forma-blok" style={{ marginBottom: "0.5rem" }}>
                          <label>
                            Status
                            <select value={novaJedStatus} onChange={(e) => setNovaJedStatus(e.target.value)}>
                              {STATUSI.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn btn-mali"
                            onClick={() => void dodajJedinicu(b.bicikl_id)}
                            disabled={editJedId !== null}
                          >
                            Dodaj jedinicu
                          </button>
                        </div>
                        <table className="tablica" style={{ width: "100%" }}>
                          <thead>
                            <tr>
                              <th>jed.</th>
                              <th>Inv.</th>
                              <th>Status</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {jedinice.map((j) => (
                              <tr key={j.jedinica_id}>
                                <td>{j.jedinica_id}</td>
                                <td>
                                  {editJedId === j.jedinica_id ? (
                                    <input
                                      className="tablica-cel-input"
                                      value={editJedInv}
                                      onChange={(e) => setEditJedInv(e.target.value)}
                                      maxLength={64}
                                    />
                                  ) : (
                                    j.inventarni_broj
                                  )}
                                </td>
                                <td>
                                  {editJedId === j.jedinica_id ? (
                                    <select
                                      className="tablica-cel-input"
                                      value={editJedStatus}
                                      onChange={(e) => setEditJedStatus(e.target.value)}
                                    >
                                      {STATUSI.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    statusBicikla(j.status)
                                  )}
                                </td>
                                <td className="tablica-akcije">
                                  {editJedId === j.jedinica_id ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-mali"
                                        onClick={() => void spremiJedinicu()}
                                      >
                                        Spremi
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-mali btn-sekundarni"
                                        onClick={() => setEditJedId(null)}
                                      >
                                        Odustani
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-mali"
                                      onClick={() => {
                                        setEditJedId(j.jedinica_id);
                                        setEditJedInv(j.inventarni_broj);
                                        setEditJedStatus(j.status);
                                      }}
                                      disabled={editVrstaId !== null}
                                    >
                                      Uredi
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-mali btn-sekundarni"
                                    onClick={() => void obrisiJedinicu(j.jedinica_id)}
                                    disabled={editVrstaId !== null || editJedId === j.jedinica_id}
                                  >
                                    Obriši
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
