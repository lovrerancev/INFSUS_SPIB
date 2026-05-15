import type { FastifyInstance, FastifyReply } from "fastify";
import { AuthService } from "../application/authService.js";
import { verifyAccessToken } from "../lib/jwt.js";
import type { JwtPayload } from "../lib/jwt.js";

const service = new AuthService();

function validationReply(reply: FastifyReply, e: unknown): unknown | null {
  if (e instanceof Error && e.message.startsWith("VALIDATION:")) {
    return reply.code(400).send({ error: e.message.replace("VALIDATION:", "").trim() });
  }
  return null;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/ja", async (request, reply) => {
    const h = request.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Nedostaje token" });
    }
    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(h.slice(7).trim());
    } catch {
      return reply.code(401).send({ error: "Nevaljan token" });
    }
    const me = await service.me(payload.sub, payload.role);
    if (!me) return reply.code(401).send({ error: "Korisnik ne postoji" });
    return me;
  });

  app.post<{ Body: Record<string, unknown> }>("/auth/registracija", async (request, reply) => {
    const b = request.body as { ime?: string; prezime?: string; email?: string; lozinka?: string };
    try {
      const out = await service.register({
        ime: String(b.ime ?? ""),
        prezime: String(b.prezime ?? ""),
        email: String(b.email ?? ""),
        lozinka: String(b.lozinka ?? ""),
      });
      return reply.code(201).send(out);
    } catch (e) {
      const v = validationReply(reply, e);
      if (v !== null) return v;
      throw e;
    }
  });

  app.post<{ Body: Record<string, unknown> }>("/auth/prijava", async (request, reply) => {
    const b = request.body as { email?: string; lozinka?: string };
    try {
      const out = await service.login({
        email: String(b.email ?? ""),
        lozinka: String(b.lozinka ?? ""),
      });
      return out;
    } catch (e) {
      const v = validationReply(reply, e);
      if (v !== null) return v;
      throw e;
    }
  });
}
