import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { KategorijaService } from "../application/kategorijaService.js";

export type KategorijeRoutesDeps = {
  service?: KategorijaService;
};

type KategorijaUpdateBody = { naziv?: string; opis?: string | null };

export async function registerKategorijeRoutes(
  app: FastifyInstance,
  deps: KategorijeRoutesDeps = {},
): Promise<void> {
  const service = deps.service ?? new KategorijaService();

  async function handleKategorijaUpdate(
    request: FastifyRequest<{ Params: { id: string }; Body: KategorijaUpdateBody }>,
    reply: FastifyReply,
  ): Promise<unknown> {
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "Nevaljan id" });
    }
    try {
      const updated = await service.update(id, {
        naziv: request.body?.naziv ?? "",
        opis: request.body?.opis,
      });
      if (!updated) return reply.code(404).send({ error: "Kategorija nije pronađena" });
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška";
      if (msg.startsWith("VALIDATION:")) {
        return reply.code(400).send({ error: msg.replace("VALIDATION:", "").trim() });
      }
      throw e;
    }
  }

  app.get("/kategorije", async (request) => {
    const q = typeof request.query === "object" && request.query && "q" in request.query
      ? String((request.query as { q?: string }).q ?? "")
      : "";
    const rows = await service.list(q || undefined);
    return rows;
  });

  app.get("/kategorije/za-odabir", async () => {
    const rows = await service.list();
    return rows.map((r) => ({ kategorijaId: r.kategorija_id, naziv: r.naziv }));
  });

  app.get<{ Params: { id: string } }>("/kategorije/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "Nevaljan id" });
    }
    const row = await service.getById(id);
    if (!row) return reply.code(404).send({ error: "Kategorija nije pronađena" });
    return row;
  });

  app.post<{ Body: { naziv?: string; opis?: string | null } }>("/kategorije", async (request, reply) => {
    try {
      const created = await service.create({
        naziv: request.body?.naziv ?? "",
        opis: request.body?.opis,
      });
      return reply.code(201).send(created);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Greška";
      if (msg.startsWith("VALIDATION:")) {
        return reply.code(400).send({ error: msg.replace("VALIDATION:", "").trim() });
      }
      throw e;
    }
  });

  app.put<{ Params: { id: string }; Body: KategorijaUpdateBody }>(
    "/kategorije/:id",
    handleKategorijaUpdate,
  );
  app.patch<{ Params: { id: string }; Body: KategorijaUpdateBody }>(
    "/kategorije/:id",
    handleKategorijaUpdate,
  );

  app.delete<{ Params: { id: string } }>("/kategorije/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) {
      return reply.code(400).send({ error: "Nevaljan id" });
    }
    const q =
      typeof request.query === "object" && request.query ? (request.query as Record<string, unknown>) : {};
    const force = q.force === "1" || q.force === "true" || q.force === true;
    const result = await service.delete(id, { force });
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        return reply.code(404).send({ error: "Kategorija nije pronađena" });
      }
      return reply.code(409).send({
        error: "Kategorija se ne može obrisati jer postoje bicikli koji je koriste",
      });
    }
    return reply.code(204).send();
  });
}
