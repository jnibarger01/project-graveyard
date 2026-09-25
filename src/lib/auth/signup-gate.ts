/**
 * Email/password sign-up allowlist (server-only).
 *
 * Better Auth's `/sign-up/email` would otherwise let anyone who reaches the app
 * create an account. This gate runs in front of the auth handler and only lets
 * addresses listed in `AUTH_SIGNUP_ALLOWLIST` (comma-separated) sign up.
 * Unset or empty means nobody can sign up (fail closed). Sign-in is unaffected.
 */

/** Parse the comma-separated allowlist into normalized addresses. */
export function parseSignupAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * True for any auth path that could create an account. Deliberately broad
 * (any "sign-up" segment, after normalizing slashes and case) so path tricks
 * like `//sign-up/email/` or `/Sign-Up/Email` can't slip past the gate.
 */
export function isSignupPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase().replace(/\/+/g, "/");
  return /(^|\/)sign-up(\/|$)/.test(normalized);
}

export type SignupDecision = { allowed: true } | { allowed: false; status: number; message: string };

/** Decide whether a sign-up request body may proceed. */
export function decideSignup(body: unknown, allowlist: Set<string>): SignupDecision {
  if (allowlist.size === 0) {
    return { allowed: false, status: 403, message: "Sign-up is disabled." };
  }
  const email =
    body && typeof body === "object" && "email" in body && typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  if (!email) {
    return { allowed: false, status: 400, message: "An email address is required." };
  }
  if (!allowlist.has(email)) {
    return { allowed: false, status: 403, message: "Sign-up is not open for this address." };
  }
  return { allowed: true };
}

/**
 * Returns a rejection Response when `request` is a sign-up that the allowlist
 * does not permit, or null when the request should reach Better Auth.
 */
export async function gateSignup(request: Request, rawAllowlist: string | undefined): Promise<Response | null> {
  if (!isSignupPath(new URL(request.url).pathname)) return null;

  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    body = null;
  }
  const decision = decideSignup(body, parseSignupAllowlist(rawAllowlist));
  if (decision.allowed) return null;
  return Response.json({ message: decision.message }, { status: decision.status });
}
