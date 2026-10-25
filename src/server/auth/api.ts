import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/server/errors";
import { resolveUserFromToken, SESSION_COOKIE, type SessionUser } from "@/server/auth/session";

/** Auth + CSRF gate for cookie-authenticated JSON route handlers. */
export async function authorizeApi(
  req: Request,
  opts: { admin?: boolean } = {},
): Promise<SessionUser> {
  const origin = req.headers.get("origin");
  if (origin && req.method !== "GET") {
    const host = req.headers.get("host");
    if (new URL(origin).host !== host) throw new AppError("BAD_ORIGIN", "Cross-origin request blocked", 403);
  }
  const jar = await cookies();
  const user = await resolveUserFromToken(jar.get(SESSION_COOKIE)?.value);
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in required", 401);
  if (opts.admin && user.role !== "ADMIN") throw new AppError("FORBIDDEN", "Administrator access required", 403);
  return user;
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("INVALID_JSON", "Request body must be valid JSON", 400);
  }
  return schema.parse(raw);
}

/** Wraps a handler so AppError/ZodError become consistent JSON error responses. */
export function apiHandler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) {
        return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Some fields are invalid",
              fields: Object.fromEntries(e.issues.map((i) => [i.path.join(".") || "_", i.message])),
            },
          },
          { status: 422 },
        );
      }
      console.error("[api]", e);
      return NextResponse.json({ error: { code: "INTERNAL", message: "Unexpected server error" } }, { status: 500 });
    }
  };
}
