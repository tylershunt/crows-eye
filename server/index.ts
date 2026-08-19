import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { AppConfig } from "../shared/types.js";
import { DEFAULT_CONFIG, InvalidConfigError, configLocation, readConfig, writeConfig } from "./config.js";
import { GitHubError, fetchDashboard } from "./github.js";
import { MissingTokenError } from "./token.js";

const PORT = Number(process.env.CROWS_EYE_SERVER_PORT ?? 8787);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/config", async (_req, res) => {
  await respond(res, async () => ({ config: await readConfig(), path: configLocation() }));
});

app.put("/api/config", async (req, res) => {
  await respond(res, async () => ({
    config: await writeConfig(req.body as AppConfig),
    path: configLocation(),
  }));
});

app.post("/api/config/reset", async (_req, res) => {
  await respond(res, async () => ({
    config: await writeConfig(DEFAULT_CONFIG),
    path: configLocation(),
  }));
});

app.get("/api/dashboard", async (_req, res) => {
  await respond(res, async () => fetchDashboard(await readConfig()));
});

app.use(express.static(join(projectRoot, "dist")));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`crows-eye server listening on http://127.0.0.1:${PORT}`);
  console.log(`config: ${configLocation()}`);
});

async function respond(res: express.Response, produce: () => Promise<unknown>): Promise<void> {
  try {
    res.json(await produce());
  } catch (error) {
    res.status(statusFor(error)).json({ error: messageFor(error) });
  }
}

function statusFor(error: unknown): number {
  if (error instanceof InvalidConfigError) return 400;
  if (error instanceof MissingTokenError) return 401;
  if (error instanceof GitHubError) return 502;
  return 500;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
