export const E2E = {
  port: 3200,
  baseURL: "http://localhost:3200",
  databaseUrl: "postgresql://vnum:vnum_local_only@localhost:54329/vnum_test",
  adminDatabaseUrl: "postgresql://vnum:vnum_local_only@localhost:54329/postgres",
  smppKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  webhookSecret: "e2e-only-webhook-secret-123456",
  admin: { email: "admin@vnum.test", password: "Admin#Demo2025" },
  customer: { email: "demo@vnum.test", password: "Demo#Pass2025", name: "Dana Demo" },
};
