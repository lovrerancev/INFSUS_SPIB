import type { FastifyInstance, FastifyReply } from "fastify";
import { NajamService } from "../application/najamService.js";
import { requireAuth, requireDjelatnik } from "./requestAuth.js";

const service = new NajamService();

function err(reply: FastifyReply, code: number, msg: string) {
  return reply.code(code).send({ error: msg });
}

export async function registerNajamRoutes(app: FastifyInstance): Promise<void> {
  app.get("/najmovi", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    return service.listZaDjelatnika();
  });

  app.get("/najmovi/obavijesti-kasnjenje", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    return service.listObavijestiKasnjenje();
  });

  app.post<{ Body: Record<string, unknown> }>("/najmovi", async (request, reply) => {
    let kupacId: number;
    try {
      const u = requireAuth(request);
      if (u.role !== "kupac") return err(reply, 403, "Rezervaciju najma može kreirati samo kupac");
      kupacId = u.korisnik_id;
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const b = request.body as Record<string, unknown>;
    try {
      const row = await service.kreiraj(kupacId, {
        jedinica_id: Number(b.jedinica_id ?? b.bicikl_id),
        datum_pocetka: String(b.datum_pocetka ?? ""),
        datum_zavrsetka: String(b.datum_zavrsetka ?? ""),
      });
      return reply.code(201).send(row);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška";
      if (msg.startsWith("VALIDATION:")) return err(reply, 400, msg.replace("VALIDATION:", "").trim());
      throw e;
    }
  });

  app.patch<{ Params: { id: string } }>("/najmovi/:id/vraceno", async (request, reply) => {
    try {
      requireDjelatnik(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return err(reply, 400, "Nevaljan id");
    const row = await service.oznaciVraceno(id);
    if (!row) return err(reply, 404, "Najam nije pronađen ili nije aktivan");
    return row;
  });
}
