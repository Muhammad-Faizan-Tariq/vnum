import { execSync, spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { Client } from "pg";
import { E2E } from "./env";

const PG_PORT = 54329;

function portOpen(port: number) {
  return new Promise<boolean>((resolve) => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });
}

/** Starts the local Postgres (scripts/local-db.mjs) as a child process and waits until it is ready. */
function startLocalPostgres() {
  return new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/local-db.mjs"], { stdio: ["ignore", "pipe", "inherit"] });
    const timer = setTimeout(() => reject(new Error("Local Postgres did not start within 90s")), 90_000);
    child.stdout!.on("data", (d: Buffer) => {
      if (d.toString().includes("Local Postgres ready")) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.once("exit", (code) => reject(new Error(`Local Postgres exited early (code ${code})`)));
  });
}

/** Recreates an isolated vnum_test database, applies migrations and seeds it before every run. */
export default async function globalSetup() {
  let child: ChildProcess | undefined;
  if (!(await portOpen(PG_PORT))) child = await startLocalPostgres();

  const admin = new Client({ connectionString: E2E.adminDatabaseUrl });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS vnum_test WITH (FORCE)");
  await admin.query("CREATE DATABASE vnum_test");
  await admin.end();

  const env = {
    ...process.env,
    DATABASE_URL: E2E.databaseUrl,
    PAYMENT_WEBHOOK_SECRET: E2E.webhookSecret,
  };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx prisma db seed", { env, stdio: "pipe" });

  return async () => {
    if (child) {
      child.removeAllListeners("exit");
      if (process.platform === "win32") {
        // Kill the whole tree: the Postgres server is a grandchild of this process.
        try {
          execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
        } catch {
          /* already gone */
        }
      } else {
        child.kill("SIGTERM");
      }
    }
  };
}
