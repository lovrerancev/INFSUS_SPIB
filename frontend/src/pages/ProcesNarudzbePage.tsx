import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  CamundaError,
  type CamundaTask,
  dohvatiTaskove,
  pokreniProces,
  preuzmiTask,
  provjeriCamundu,
  zavrsiTask,
} from "../lib/camunda";
import { CAMUNDA_GRUPA_ZA_ULOGU, camundaUserIdZaUlogu } from "../lib/camundaUserMap";

type FormState = Record<string, string>;

const TASK_FORME: Record<string, { label: string; key: string; type?: "select"; options?: { v: string; l: string }[] }[]> = {
  Task_NovaNarudzbaKupac: [
    { label: "ID narudžbe", key: "narudzbaId" },
    { label: "Adresa dostave", key: "adresaDostave" },
  ],
  Task_PregledDjelatnik: [
    {
      label: "Odluka djelatnika",
      key: "odlukaDjelatnika",
      type: "select",
      options: [
        { v: "POTVRDI", l: "Potvrdi" },
        { v: "ESKALIRAJ", l: "Eskaliraj adminu" },
      ],
    },
  ],
  Task_OdlukaAdmin: [
    {
      label: "Odluka administratora",
      key: "odlukaAdmina",
      type: "select",
      options: [
        { v: "OTKAZI", l: "Otkaži narudžbu" },
        { v: "VRATI_KUPCU", l: "Vrati kupcu na doradu" },
      ],
    },
  ],
  Task_IspravakKupac: [{ label: "Nova adresa dostave", key: "novaAdresa" }],
};

function varijableIzForme(taskKey: string, form: FormState): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(form)) {
    if (k === "narudzbaId") out[k] = Number(v) || 0;
    else out[k] = v;
  }
  if (taskKey === "Task_PregledDjelatnik" && !out.odlukaDjelatnika) {
    throw new Error("Odaberite odluku djelatnika.");
  }
  if (taskKey === "Task_OdlukaAdmin" && !out.odlukaAdmina) {
    throw new Error("Odaberite odluku administratora.");
  }
  return out;
}

export default function ProcesNarudzbePage() {
  const { user } = useAuth();
  const camundaUser = user ? camundaUserIdZaUlogu(user.role) : "";
  const grupa = user ? CAMUNDA_GRUPA_ZA_ULOGU[user.role] : undefined;

  const [camundaOk, setCamundaOk] = useState<boolean | null>(null);
  const [kupacZaStart, setKupacZaStart] = useState("kupac1");
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [taskovi, setTaskovi] = useState<CamundaTask[]>([]);
  const [odabraniTask, setOdabraniTask] = useState<CamundaTask | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [greska, setGreska] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ucitavanje, setUcitavanje] = useState(false);

  const osvjeziTaskove = useCallback(async () => {
    if (!user) return;
    setGreska(null);
    const assigneeTasks = await dohvatiTaskove(camundaUser);
    let groupTasks: CamundaTask[] = [];
    if (grupa) {
      groupTasks = await dohvatiTaskove(camundaUser, grupa);
    }
    const map = new Map<string, CamundaTask>();
    for (const t of [...assigneeTasks, ...groupTasks]) map.set(t.id, t);
    setTaskovi([...map.values()].sort((a, b) => a.created.localeCompare(b.created)));
  }, [user, camundaUser, grupa]);

  useEffect(() => {
    let o = false;
    (async () => {
      const ok = await provjeriCamundu();
      if (!o) setCamundaOk(ok);
    })();
    return () => {
      o = true;
    };
  }, []);

  useEffect(() => {
    if (!user || camundaOk !== true) return;
    osvjeziTaskove().catch((e) =>
      setGreska(e instanceof CamundaError ? e.message : "Greška učitavanja taskova"),
    );
  }, [user, camundaOk, osvjeziTaskove]);

  useEffect(() => {
    if (!odabraniTask) {
      setForm({});
      return;
    }
    const polja = TASK_FORME[odabraniTask.taskDefinitionKey] ?? [];
    const init: FormState = {};
    for (const p of polja) {
      if (p.type === "select" && p.options?.[0]) init[p.key] = p.options[0].v;
      else init[p.key] = "";
    }
    setForm(init);
  }, [odabraniTask]);

  async function startProcesa() {
    setUcitavanje(true);
    setGreska(null);
    setInfo(null);
    try {
      const id = await pokreniProces(kupacZaStart.trim() || "kupac1");
      setInstanceId(id);
      setInfo(`Proces pokrenut. Instance ID: ${id}`);
      await osvjeziTaskove();
    } catch (e) {
      setGreska(e instanceof CamundaError ? e.message : "Ne mogu pokrenuti proces");
    } finally {
      setUcitavanje(false);
    }
  }

  async function zavrsiOdabrani() {
    if (!odabraniTask || !user) return;
    setUcitavanje(true);
    setGreska(null);
    setInfo(null);
    try {
      if (grupa && !odabraniTask.assignee) {
        await preuzmiTask(odabraniTask.id, camundaUser);
      }
      const vars = varijableIzForme(odabraniTask.taskDefinitionKey, form);
      await zavrsiTask(odabraniTask.id, vars);
      setInfo(`Task „${odabraniTask.name}” završen.`);
      setOdabraniTask(null);
      await osvjeziTaskove();
    } catch (e) {
      setGreska(e instanceof Error ? e.message : "Greška završetka taska");
    } finally {
      setUcitavanje(false);
    }
  }

  if (!user) return null;

  const isKupac = user.role === "kupac";

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Camunda — obrada narudžbe (DZ4)</h2>
      </div>
      <p className="hint">
        Demo procesa <strong>SPIB Obrada narudzbe</strong>. SPIB prijava: {user.email}. Camunda korisnik:{" "}
        <strong>{camundaUser}</strong> (lozinka u Tasklistu: <code>demo</code>).
      </p>

      {camundaOk === false && (
        <p className="greska">
          Camunda ne radi. U terminalu: <code>docker start camunda</code>, zatim{" "}
          <code>.\camunda\setup.ps1</code>
        </p>
      )}

      {greska && <p className="greska">{greska}</p>}
      {info && <p className="poruka">{info}</p>}

      {isKupac ? (
        <section style={{ marginTop: "1rem" }}>
          <h3>1. Pokreni novi proces</h3>
          <p className="hint">Samo kupac pokreće proces (Camunda user: {camundaUser}).</p>
          <div className="form-red">
            <label>
              kupacUsername
              <input value={kupacZaStart} onChange={(e) => setKupacZaStart(e.target.value)} />
            </label>
            <button type="button" className="btn btn-primarni" disabled={ucitavanje || camundaOk !== true} onClick={() => void startProcesa()}>
              Start procesa
            </button>
          </div>
          {instanceId && <p className="hint">Zadnja instanca: {instanceId}</p>}
        </section>
      ) : (
        <p className="hint" style={{ marginTop: "1rem" }}>
          Novi proces može pokrenuti samo <strong>kupac</strong>. Prijavite se kao kupac ili nastavite s taskovima za{" "}
          {user.role}.
        </p>
      )}

      <section style={{ marginTop: "1.25rem" }}>
        <h3>{isKupac ? "2. " : ""}Taskovi za {camundaUser}{grupa ? ` / grupa ${grupa}` : ""}</h3>
        <button type="button" className="btn btn-sekundarni btn-mali" disabled={camundaOk !== true} onClick={() => void osvjeziTaskove()}>
          Osvježi
        </button>
        {taskovi.length === 0 ? (
          <p className="hint">Nema otvorenih taskova za ovu ulogu.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {taskovi.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={odabraniTask?.id === t.id ? "btn btn-primarni btn-mali" : "btn btn-sekundarni btn-mali"}
                  onClick={() => setOdabraniTask(t)}
                >
                  {t.name}
                </button>
                <span className="hint"> ({t.taskDefinitionKey})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {odabraniTask && (
        <section style={{ marginTop: "1.25rem" }}>
          <h3>{isKupac ? "3. " : ""}Završi: {odabraniTask.name}</h3>
          {(TASK_FORME[odabraniTask.taskDefinitionKey] ?? []).map((p) => (
            <label key={p.key} className="form-red">
              {p.label}
              {p.type === "select" ? (
                <select value={form[p.key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [p.key]: e.target.value }))}>
                  {(p.options ?? []).map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              ) : (
                <input value={form[p.key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [p.key]: e.target.value }))} />
              )}
            </label>
          ))}
          <button type="button" className="btn btn-primarni" disabled={ucitavanje} onClick={() => void zavrsiOdabrani()}>
            Complete task
          </button>
        </section>
      )}

      <section style={{ marginTop: "1.25rem" }}>
        <h3>Demo scenarij (korak po korak)</h3>
        <ol className="hint">
          <li>
            <strong>Kupac</strong> → Start procesa (kupacUsername = kupac1) → Nova narudzba
          </li>
          <li>Prijavi se kao djelatnik → task Pregled → Eskaliraj</li>
          <li>Prijavi se kao admin → Odluka → Vrati kupcu</li>
          <li>Kupac → Ispravak adrese → petlja na pregled</li>
        </ol>
        <p className="hint">
          Za cijeli tok koristi istu SPIB stranicu i mijenjaj SPIB prijavu (kupac / djelatnik / admin), ili Tasklist s kupac1 / djelatnik1 / admin1.
        </p>
      </section>
    </div>
  );
}
