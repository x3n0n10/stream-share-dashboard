import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createRouter } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();

if (config.instances.length === 0) {
  // eslint-disable-next-line no-console
  console.warn(
    "[startup] No instances configured. Set INSTANCE_1_NAME / INSTANCE_1_URL / " +
      "INSTANCE_1_API_KEY (and _2_, _3_, ...) in the environment."
  );
}

const app = express();
app.disable("x-powered-by");

if (config.basicAuth) {
  const { user, password } = config.basicAuth;
  app.use((req, res, next) => {
    const header = req.headers.authorization || "";
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      const [u, p] = Buffer.from(encoded, "base64").toString("utf8").split(":");
      if (u === user && p === password) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="Stream Share Dashboard"');
    res.status(401).send("Authentication required");
  });
}

app.use("/api", express.json(), createRouter(config));

const staticDir = path.join(__dirname, "..", "public");
app.use(express.static(staticDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[startup] ${config.title} listening on :${config.port} — ${config.instances.length} instance(s) configured`
  );
});
