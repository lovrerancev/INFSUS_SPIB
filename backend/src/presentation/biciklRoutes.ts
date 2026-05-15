import type { FastifyInstance, FastifyReply } from "fastify";
import { BiciklService } from "../application/biciklService.js";
import { forbidAdministratorKatalog, requireDjelatnik } from "./requestAuth.js";

const service = new BiciklService();

function err(reply: FastifyReply, code: number, msg: string) {
  return reply.code(code).send({ error: msg });
}

function queryForce(request: { query?: unknown }): boolean {
  const q =
    typeof request.query === "object" && request.query ? (request.query as Record<string, unknown>) : {};
  const f = q.force;
  return f === "1" || f === "true" || f === true;
}

export async function registerBiciklRoutes(app: FastifyInstance): Promise<void> {
  app.get("/katalog/bicikli", async (request, reply) => {
    try {
      forbidAdministratorKatalog(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const q = typeof request.query === "object" && request.query ? (request.query as Record<string, string>) : {};
    const f = {
      q: q.q,
      kategorija_id: q.kategorija_id ? Number(q.kategorija_id) : undefined,
      cijena_od: q.cijena_od ? Number(q.cijena_od) : undefined,
      cijena_do: q.cijena_do ? Number(q.cijena_do) : undefined,
      samo_dostupni: q.samo_dostupni === "1" || q.samo_dostupni === "true",
    };
    return service.katalog(f);
  });

  
  app.get("/katalog/bicikli/jedinice", async (request, reply) => {
    try {
      forbidAdministratorKatalog(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const q = typeof request.query === "object" && request.query ? (request.query as Record<string, string>) : {};
    return service.jediniceKatalog({
      bicikl_id: q.bicikl_id ? Number(q.bicikl_id) : undefined,
      samo_dostupni: q.samo_dostupni === "1" || q.samo_dostupni === "true",
    });
  });

  app.post<{ Body: Record<string, unknown> }>("/bicikli/postavi-servis", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const b = request.body as { ids?: unknown };
    try {
      const r = await service.postaviOdabraneNaServis(b.ids);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška";
      if (msg.startsWith("VALIDATION:")) return err(reply, 400, msg.replace("VALIDATION:", "").trim());
      throw e;
    }
  });

  app.get<{ Params: { id: string } }>("/bicikli/:id/jedinice", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return err(reply, 400, "Nevaljan id vrste");
    const v = await service.getById(id);
    if (!v) return err(reply, 404, "Vrsta nije pronađena");
    return service.jediniceKatalog({ bicikl_id: id });
  });

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>("/bicikli/:id/jedinice", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return err(reply, 400, "Nevaljan id vrste");
    const b = request.body as Record<string, unknown>;
    try {
      const jid = await service.createJedinica(id, {
        inventarni_broj: b.inventarni_broj != null ? String(b.inventarni_broj) : null,
        status: b.status != null ? String(b.status) : undefined,
      });
      const list = await service.jediniceKatalog({ bicikl_id: id });
      const row = list.find((x) => x.jedinica_id === jid);
      return reply.code(201).send(row ?? { jedinica_id: jid });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška";
      if (msg.startsWith("VALIDATION:")) return err(reply, 400, msg.replace("VALIDATION:", "").trim());
      throw e;
    }
  });

  app.patch<{ Params: { jid: string }; Body: Record<string, unknown> }>(
    "/bicikli/jedinice/:jid",
    async (request, reply) => {
      try {
        requireDjelatnik(request);
      } catch (e) {
        const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
        return err(reply, sc, e instanceof Error ? e.message : "Greška");
      }
      const jid = Number(request.params.jid);
      if (!Number.isFinite(jid)) return err(reply, 400, "Nevaljan jedinica_id");
      const b = request.body as Record<string, unknown>;
      try {
        const ok = await service.updateJedinica(jid, {
          inventarni_broj: String(b.inventarni_broj ?? ""),
          status: String(b.status ?? "DOSTUPAN"),
        });
        if (!ok) return err(reply, 404, "Jedinica nije pronađena");
        const row = await service.getJedinica(jid);
        return row ?? { jedinica_id: jid };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Greška";
        if (msg.startsWith("VALIDATION:")) return err(reply, 400, msg.replace("VALIDATION:", "").trim());
        throw e;
      }
    },
  );

  app.delete<{ Params: { jid: string } }>("/bicikli/jedinice/:jid", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const jid = Number(request.params.jid);
    if (!Number.isFinite(jid)) return err(reply, 400, "Nevaljan jedinica_id");
    const force = queryForce(request);
    const r = await service.removeJedinica(jid, { force });
    if (!r.ok) {
      if (r.reason === "NOT_FOUND") return err(reply, 404, "Jedinica nije pronađena");
      return err(reply, 409, "Jedinica se ne može obrisati jer postoje stavke ili najmovi");
    }
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>("/bicikli/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return err(reply, 400, "Nevaljan id");
    const row = await service.getById(id);
    if (!row) return err(reply, 404, "Bicikl nije pronađen");
    return row;
  });

  app.post<{ Body: Record<string, unknown> }>("/bicikli", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const b = request.body as Record<string, unknown>;
    try {
      const id = await service.createVrsta({
        naziv: String(b.naziv ?? ""),
        cijena: String(b.cijena ?? ""),
        kategorija_id: Number(b.kategorija_id),
        cijena_najma_po_danu: b.cijena_najma_po_danu != null ? String(b.cijena_najma_po_danu) : null,
      });
      const row = await service.getById(id);
      return reply.code(201).send(row);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška";
      if (msg.startsWith("VALIDATION:")) return err(reply, 400, msg.replace("VALIDATION:", "").trim());
      throw e;
    }
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/bicikli/:id", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return err(reply, 400, "Nevaljan id");
    const b = request.body as Record<string, unknown>;
    try {
      const ok = await service.updateVrsta(id, {
        naziv: String(b.naziv ?? ""),
        cijena: String(b.cijena ?? ""),
        kategorija_id: Number(b.kategorija_id),
        cijena_najma_po_danu: b.cijena_najma_po_danu != null ? String(b.cijena_najma_po_danu) : null,
      });
      if (!ok) return err(reply, 404, "Bicikl nije pronađen");
      return service.getById(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška";
      if (msg.startsWith("VALIDATION:")) return err(reply, 400, msg.replace("VALIDATION:", "").trim());
      throw e;
    }
  });

  app.delete<{ Params: { id: string } }>("/bicikli/:id", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return err(reply, 400, "Nevaljan id");
    const force = queryForce(request);
    const r = await service.removeVrsta(id, { force });
    if (!r.ok) {
      if (r.reason === "NOT_FOUND") return err(reply, 404, "Bicikl nije pronađen");
      return err(reply, 409, "Vrstu se ne može obrisati jer postoje povezane jedinice u narudžbama ili najmovima");
    }
    return reply.code(204).send();
  });
}
