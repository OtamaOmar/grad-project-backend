import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";

// Builds the API without starting it, so tests can run it on any free port.
// The browser talks only to this API. It never calls the AI service directly.
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  // Quick "is the API up?" check.
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
