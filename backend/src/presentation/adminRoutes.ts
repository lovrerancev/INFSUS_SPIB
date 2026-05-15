import type { FastifyInstance, FastifyReply } from "fastify";
import { AdminService } from "../application/adminService.js";
import { requireAdministrator } from "./requestAuth.js";

const service = new AdminService();

function validationReply(reply: FastifyReply, e: unknown): unknown | null {
  if (e instanceof Error && e.message.startsWith("VALIDATION:")) {
    return reply.code(400).send({ error: e.message.replace("VALIDATION:", "").trim() });
  }
  return null;
}

function authErr(reply: FastifyReply, e: unknown) {
  const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
  return reply.code(sc).send({ error: e instanceof Error ? e.message : "Neautorizirano" });
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin/korisnici", async (request, reply) => {
    try {
      requireAdministrator(request);
    } catch (e) {
      return authErr(reply, e);
    }
    return service.listKorisnika();
  });

  app.delete<{ Params: { id: string } }>("/admin/korisnici/:id", async (request, reply) => {
    let auth;
    try {
      auth = requireAdministrator(request);
    } catch (e) {
      return authErr(reply, e);
    }
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: "Nevaljan id" });
    try {
      await service.ukloniKorisnika(auth, id);
      return reply.code(204).send();
    } catch (e) {
      const v = validationReply(reply, e);
      if (v !== null) return v;
      throw e;
    }
  });

  app.post<{ Body: Record<string, unknown> }>("/admin/djelatnici", async (request, reply) => {
    let auth;
    try {
      auth = requireAdministrator(request);
    } catch (e) {
      return authErr(reply, e);
    }
    const b = request.body as { korisnik_id?: unknown; pozicija?: unknown };
    try {
      await service.dodajDjelatnika(
        auth,
        Number(b.korisnik_id),
        String(b.pozicija ?? ""),
      );
      return reply.code(201).send({ ok: true });
    } catch (e) {
      const v = validationReply(reply, e);
      if (v !== null) return v;
      throw e;
    }
  });

  app.delete<{ Params: { id: string } }>("/admin/djelatnici/:id", async (request, reply) => {
    let auth;
    try {
      auth = requireAdministrator(request);
    } catch (e) {
      return authErr(reply, e);
    }
    const id = Number(request.params.id);
    if (!Number.isFinite(id)) return reply.code(400).send({ error: "Nevaljan id" });
    try {
      await service.ukloniDjelatnika(auth, id);
      return reply.code(204).send();
    } catch (e) {
      const v = validationReply(reply, e);
      if (v !== null) return v;
      throw e;
    }
  });
}
