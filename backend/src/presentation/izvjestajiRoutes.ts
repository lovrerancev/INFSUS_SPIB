import type { FastifyInstance, FastifyReply } from "fastify";
import { IzvjestajiRepository } from "../infrastructure/izvjestajiRepository.js";
import { requireAdministrator } from "./requestAuth.js";

const repo = new IzvjestajiRepository();

function err(reply: FastifyReply, code: number, msg: string) {
  return reply.code(code).send({ error: msg });
}

export async function registerIzvjestajiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/izvjestaji/prodaja", async (request, reply) => {
    try {
      requireAdministrator(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const q = typeof request.query === "object" && request.query ? (request.query as Record<string, string>) : {};
    const od = q.od?.trim();
    const doDat = q.do?.trim();
    if (!od || !doDat) return err(reply, 400, "Parametri od i do (YYYY-MM-DD) su obavezni");
    return repo.prodaja(od, doDat);
  });

  app.get("/izvjestaji/najam", async (request, reply) => {
    try {
      requireAdministrator(request);
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401;
      return err(reply, sc, e instanceof Error ? e.message : "Greška");
    }
    const q = typeof request.query === "object" && request.query ? (request.query as Record<string, string>) : {};
    const od = q.od?.trim();
    const doDat = q.do?.trim();
    if (!od || !doDat) return err(reply, 400, "Parametri od i do (YYYY-MM-DD) su obavezni");
    return repo.najam(od, doDat);
  });
}
