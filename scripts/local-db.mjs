// Local PostgreSQL for development and tests (real Postgres binaries via `embedded-postgres`).
// Production/staging use Neon through DATABASE_URL; this is only a zero-install stand-in.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const LOCAL_DB = {
  port: 54329,
  user: "vnum",
  password: "vnum_local_only",
  dir: path.join(root, ".local-db", "data"),
  url: (db) => `postgresql://vnum:vnum_local_only@localhost:54329/${db}`,
};

/** Starts the cluster (initialising it on first run) and ensures the given databases exist. */
export async function startLocalDb(databases = ["vnum_dev", "vnum_test"]) {
  const pg = new EmbeddedPostgres({
    databaseDir: LOCAL_DB.dir,
    user: LOCAL_DB.user,
    password: LOCAL_DB.password,
    port: LOCAL_DB.port,
    persistent: true,
    onLog: () => {},
    onError: (e) => console.error("[local-db]", e),
  });
  if (!existsSync(path.join(LOCAL_DB.dir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  for (const db of databases) {
    try {
      await pg.createDatabase(db);
    } catch (e) {
      if (!/already exists/i.test(String(e?.message ?? e))) throw e;
    }
  }
  return pg;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pg = await startLocalDb();
  console.log(`Local Postgres ready on port ${LOCAL_DB.port}`);
  console.log(`  dev:  ${LOCAL_DB.url("vnum_dev")}`);
  console.log(`  test: ${LOCAL_DB.url("vnum_test")}`);
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
