import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
const password = randomBytes(24).toString("hex"),
  port = 55439;
const databaseDir = path.resolve(".test-db", `run-${Date.now()}`);
const windowsBinaries =
  process.platform === "win32"
    ? await import("@embedded-postgres/windows-x64")
    : null;
async function control(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(windowsBinaries.pg_ctl, args, {
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Test PostgreSQL control failed (${code})`)),
    );
  });
}
let started = false;
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password,
  port,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
try {
  await postgres.initialise();
  // pg_ctl gives Windows a graceful shutdown instead of the package's taskkill fallback.
  if (windowsBinaries)
    await control([
      "start",
      "-D",
      databaseDir,
      "-w",
      "-t",
      "15",
      "-l",
      path.join(databaseDir, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port}`,
    ]);
  else await postgres.start();
  started = true;
  const setup = postgres.getPgClient("postgres", "127.0.0.1");
  await setup.connect();
  try {
    await setup.query("CREATE DATABASE baraka_test");
  } finally {
    await setup.end();
  }
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/baraka_test`;
  const code = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--test", "tests/booking.integration.test.ts"],
      {
        stdio: "inherit",
        windowsHide: true,
        env: {
          ...process.env,
          NODE_ENV: "test",
          TEST_DATABASE_URL: url,
          ALLOW_TEST_DB_RESET: "true",
        },
      },
    );
    child.on("error", reject);
    child.on("exit", resolve);
  });
  process.exitCode = typeof code === "number" ? code : 1;
} finally {
  if (windowsBinaries && started)
    await control(["stop", "-D", databaseDir, "-m", "fast", "-w", "-t", "15"]);
  else await postgres.stop();
}
