import cors from "@fastify/cors";
import Fastify from "fastify";
import "dotenv/config";
import { registerApiRoutes } from "./presentation/routes.js";

const app = Fastify({ logger: true });

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, "request error");
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
  const msg = error instanceof Error ? error.message : "Greška poslužitelja";
  void reply.status(statusCode).send({ error: msg });
});

await app.register(cors, { origin: true });
await app.register(registerApiRoutes, { prefix: "/api" });

const port = Number(process.env.PORT) || 3000;
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`SPIB API http://localhost:${port}/api/health`);
