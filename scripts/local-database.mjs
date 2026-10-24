// Local development only. Creates real PostgreSQL storage, never sample bookings/capacity.
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
if (process.env.NODE_ENV === "production")
  throw new Error("This helper is for local development only.");
const directory = path.resolve(".local-db");
const envPath = path.resolve(".env.local");
let contents = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const setting = (name) =>
  contents.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim();
const existing = setting("DATABASE_URL");
if (
  existing &&
  (!existing.startsWith("postgresql://postgres:") ||
    new URL(existing).host !== "127.0.0.1:55432" ||
    new URL(existing).pathname !== "/baraka_local")
)
  throw new Error(
    "An external DATABASE_URL is already configured. This helper will not replace it.",
  );
const password = existing
  ? decodeURIComponent(new URL(existing).password)
  : randomBytes(32).toString("hex");
const url =
  existing || `postgresql://postgres:${password}@127.0.0.1:55432/baraka_local`;
const binaries =
  process.platform === "win32"
    ? await import("@embedded-postgres/windows-x64")
    : null;
const cluster = new EmbeddedPostgres({
  databaseDir: directory,
  user: "postgres",
  password,
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
async function command(executable, args, env = process.env, stdio = "ignore") {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env, stdio, windowsHide: true });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
if (process.argv[2] === "stop") {
  if (binaries) {
    const code = await command(binaries.pg_ctl, [
      "stop",
      "-D",
      directory,
      "-m",
      "fast",
      "-w",
    ]);
    if (code) throw new Error("Local PostgreSQL could not stop.");
  } else await cluster.stop();
  console.log("Local PostgreSQL stopped. Data retained.");
} else {
  if (!existsSync(path.join(directory, "PG_VERSION"))) {
    if (existsSync(directory))
      throw new Error(
        "Existing local database directory is incomplete. Inspect it before proceeding.",
      );
    await cluster.initialise();
  }
  if (binaries) {
    const running = await command(binaries.pg_ctl, ["status", "-D", directory]);
    if (running !== 0) {
      const code = await command(binaries.pg_ctl, [
        "start",
        "-D",
        directory,
        "-w",
        "-t",
        "20",
        "-l",
        path.join(directory, "postgres.log"),
        "-o",
        "-h 127.0.0.1 -p 55432",
      ]);
      if (code)
        throw new Error(
          "Local PostgreSQL could not start. Inspect .local-db/postgres.log.",
        );
    }
  } else await cluster.start();
  const admin = new Client({
    connectionString: url.replace("/baraka_local", "/postgres"),
  });
  await admin.connect();
  try {
    if (
      !(
        await admin.query(
          "SELECT 1 FROM pg_database WHERE datname='baraka_local'",
        )
      ).rowCount
    )
      await admin.query("CREATE DATABASE baraka_local");
  } finally {
    await admin.end();
  }
  if (!existing) {
    contents = /^DATABASE_URL=.*$/m.test(contents)
      ? contents.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`)
      : `${contents}\nDATABASE_URL=${url}\n`;
    writeFileSync(envPath, contents, { mode: 0o600 });
  }
  const code = await command(
    process.execPath,
    ["scripts/migrate.mjs"],
    { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url },
    "inherit",
  );
  if (code) throw new Error("Local migrations failed.");
  console.log(
    "Local PostgreSQL ready on 127.0.0.1:55432. Credentials saved in ignored .env.local. Restart Next.js if needed. No sample tables, hours, or reservations were created.",
  );
}
