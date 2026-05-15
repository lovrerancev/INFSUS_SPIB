import type { FastifyInstance, FastifyReply } from "fastify";
import { NarudzbaService } from "../application/narudzbaService.js";
import { listaNarudzbaStatusaZaApi } from "../domain/narudzbaStatus.js";
import { requireAuth, requireKupac } from "./requestAuth.js";

export type NarudzbeRoutesDeps = {
  service?: NarudzbaService;
};

function validationReply(reply: FastifyReply, e: unknown): unknown | null {
  if (e instanceof Error && e.message.startsWith("VALIDATION:")) {
    return reply
      .code(400)
      .send({ error: e.message.replace("VALIDATION:", "").trim() });
  }
  return null;
}

function authErr(reply: FastifyReply, e: unknown) {
  const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
  return reply.code(sc).send({ error: e instanceof Error ? e.message : "Neautorizirano" });
}

export async function registerNarudzbeRoutes(
  app: FastifyInstance,
  deps: NarudzbeRoutesDeps = {},
): Promise<void> {
  const service = deps.service ?? new NarudzbaService();
  app.get("/narudzbe", async (request, reply) => {
    let auth;
    try {
      auth = requireAuth(request);
    } catch (e) {
      return authErr(reply, e);
    }
    const lim = typeof request.query === "object" && request.query && "limit" in request.query
      ? Number((request.query as { limit?: string }).limit)
      : 50;
    return service.list(auth, Number.isFinite(lim) ? lim : 50);
  });

  app.get("/narudzbe/statusi", async () => listaNarudzbaStatusaZaApi());

  app.post<{ Body: Record<string, unknown> }>("/kupnja", async (request, reply) => {
    let auth;
    try {
      auth = requireKupac(request);
    } catch (e) {
      return authErr(reply, e);
    }
    const b = request.body as Record<string, unknown>;
    try {
      const created = await service.kreirajKupnju(auth, {
        bicikl_id: b.bicikl_id,
        kolicina: b.kolicina,
        adresa_dostave: b.adresa_dostave,
        nacin_placanja: b.nacin_placanja,
      });
      return reply.code(201).send(created);
    } catch (e) {
      const v = validationReply(reply, e);
      if (v !== null) return v;
      throw e;
    }
  });

  
  app.post("/narudzbe", async (request, reply) => {
    try {
      requireAuth(request);
    } catch (e) {
      return authErr(reply, e);
    }
    return reply.code(403).send({
      error:
        "Narudžbu kupnje ne možete kreirati ovim pozivom. Koristite stranicu Kupnja (POST /api/kupnja).",
    });
  });

  app.get<{ Params: { id: string } }>("/narudzbe/:id", async (request, reply) => {
    let auth;
    try {
      auth = requireAuth(request);
    } catch (e) {
      return authErr(reply, e);
    }
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "Nevaljan id" });
    }
    const row = await service.getById(id, auth);
    if (!row) return reply.code(404).send({ error: "Narudžba nije pronađena" });
    return row;
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/narudzbe/:id",
    async (request, reply) => {
      let auth;
      try {
        auth = requireAuth(request);
      } catch (e) {
        return authErr(reply, e);
      }
      const id = Number(request.params.id);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: "Nevaljan id" });
      }
      try {
        const b = request.body as {
          status?: string;
          djelatnik_korisnik_id?: number | null;
          adresa_dostave?: string;
          nacin_placanja?: string;
        };
        const updated = await service.update(id, {
          status: b.status,
          djelatnik_korisnik_id: b.djelatnik_korisnik_id,
          adresa_dostave: b.adresa_dostave,
          nacin_placanja: b.nacin_placanja,
        }, auth);
        if (!updated) return reply.code(404).send({ error: "Narudžba nije pronađena" });
        return updated;
      } catch (e) {
        const v = validationReply(reply, e);
        if (v !== null) return v;
        const sc = (e as Error & { statusCode?: number }).statusCode;
        if (sc === 403) {
          return reply.code(403).send({ error: e instanceof Error ? e.message : "Zabranjeno" });
        }
        throw e;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/narudzbe/:id/stavke",
    async (request, reply) => {
      let auth;
      try {
        auth = requireAuth(request);
      } catch (e) {
        return authErr(reply, e);
      }
      const id = Number(request.params.id);
      if (!Number.isFinite(id)) {
        return reply.code(400).send({ error: "Nevaljan id" });
      }
      try {
        const b = request.body as { jedinica_id?: number; bicikl_id?: number; kolicina?: number };
        const det = await service.addStavka(id, {
          jedinica_id: Number(b.jedinica_id ?? b.bicikl_id),
          kolicina: Number(b.kolicina),
        }, auth);
        if (!det) return reply.code(404).send({ error: "Narudžba nije pronađena" });
        return reply.code(201).send(det);
      } catch (e) {
        const v = validationReply(reply, e);
        if (v !== null) return v;
        const sc = (e as Error & { statusCode?: number }).statusCode;
        if (sc === 403) {
          return reply.code(403).send({ error: e instanceof Error ? e.message : "Zabranjeno" });
        }
        throw e;
      }
    },
  );

  app.patch<{ Params: { id: string; stavkaId: string }; Body: Record<string, unknown> }>(
    "/narudzbe/:id/stavke/:stavkaId",
    async (request, reply) => {
      let auth;
      try {
        auth = requireAuth(request);
      } catch (e) {
        return authErr(reply, e);
      }
      const narId = Number(request.params.id);
      const stId = Number(request.params.stavkaId);
      if (!Number.isFinite(narId) || !Number.isFinite(stId)) {
        return reply.code(400).send({ error: "Nevaljan id" });
      }
      try {
        const b = request.body as { jedinica_id?: number; bicikl_id?: number; kolicina?: number };
        const det = await service.updateStavka(narId, stId, {
          jedinica_id: b.jedinica_id !== undefined ? Number(b.jedinica_id) : b.bicikl_id !== undefined ? Number(b.bicikl_id) : undefined,
          kolicina: b.kolicina,
        }, auth);
        if (!det) return reply.code(404).send({ error: "Narudžba ili stavka nije pronađena" });
        return det;
      } catch (e) {
        const v = validationReply(reply, e);
        if (v !== null) return v;
        const sc = (e as Error & { statusCode?: number }).statusCode;
        if (sc === 403) {
          return reply.code(403).send({ error: e instanceof Error ? e.message : "Zabranjeno" });
        }
        throw e;
      }
    },
  );

  app.delete<{ Params: { id: string; stavkaId: string } }>(
    "/narudzbe/:id/stavke/:stavkaId",
    async (request, reply) => {
      let auth;
      try {
        auth = requireAuth(request);
      } catch (e) {
        return authErr(reply, e);
      }
      const narId = Number(request.params.id);
      const stId = Number(request.params.stavkaId);
      if (!Number.isFinite(narId) || !Number.isFinite(stId)) {
        return reply.code(400).send({ error: "Nevaljan id" });
      }
      try {
        const det = await service.removeStavka(narId, stId, auth);
        if (!det) return reply.code(404).send({ error: "Narudžba ili stavka nije pronađena" });
        return det;
      } catch (e) {
        const v = validationReply(reply, e);
        if (v !== null) return v;
        const sc = (e as Error & { statusCode?: number }).statusCode;
        if (sc === 403) {
          return reply.code(403).send({ error: e instanceof Error ? e.message : "Zabranjeno" });
        }
        throw e;
      }
    },
  );
}
