import assert from "node:assert/strict";
import { test } from "node:test";
import { decideSignup, gateSignup, isSignupPath, parseSignupAllowlist } from "../src/lib/auth/signup-gate.ts";

const OWNER = "owner@example.com";

function signupRequest(path: string, body: unknown): Request {
  return new Request(`https://app.example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("signup-gate: allowlist parsing trims, lowercases, and drops blanks", () => {
  assert.deepEqual([...parseSignupAllowlist(" Owner@Example.com, ,b@x.io ")], [OWNER, "b@x.io"]);
  assert.equal(parseSignupAllowlist(undefined).size, 0);
  assert.equal(parseSignupAllowlist("  ").size, 0);
});

test("signup-gate: sign-up path detection resists slash and case tricks", () => {
  for (const p of ["/api/auth/sign-up/email", "/api/auth//sign-up/email/", "/api/auth/Sign-Up/Email", "/api/auth/sign-up"]) {
    assert.equal(isSignupPath(p), true, p);
  }
  for (const p of ["/api/auth/sign-in/email", "/api/auth/get-session", "/api/auth/sign-upx"]) {
    assert.equal(isSignupPath(p), false, p);
  }
});

test("signup-gate: empty allowlist fails closed", () => {
  assert.deepEqual(decideSignup({ email: OWNER }, new Set()), { allowed: false, status: 403, message: "Sign-up is disabled." });
});

test("signup-gate: only allowlisted emails may sign up, case-insensitively", () => {
  const list = parseSignupAllowlist(OWNER);
  assert.equal(decideSignup({ email: "OWNER@example.com " }, list).allowed, true);
  assert.equal(decideSignup({ email: "intruder@example.com" }, list).allowed, false);
  assert.equal(decideSignup({}, list).allowed, false);
  assert.equal(decideSignup(null, list).allowed, false);
  assert.equal(decideSignup({ email: 42 }, list).allowed, false);
});

test("signup-gate: request gate rejects non-allowlisted and malformed sign-ups, passes everything else", async () => {
  const blocked = await gateSignup(signupRequest("/api/auth/sign-up/email", { email: "x@y.z", password: "p" }), OWNER);
  assert.equal(blocked?.status, 403);

  const malformed = await gateSignup(signupRequest("/api/auth/sign-up/email", "not json"), OWNER);
  assert.equal(malformed?.status, 400);

  const tricky = await gateSignup(signupRequest("/api/auth//Sign-Up/email/", { email: "x@y.z" }), OWNER);
  assert.equal(tricky?.status, 403);

  const allowedReq = signupRequest("/api/auth/sign-up/email", { email: OWNER, password: "p" });
  assert.equal(await gateSignup(allowedReq, OWNER), null);
  // The gate reads a clone, so the original body is still intact for Better Auth.
  assert.equal((await allowedReq.json()).email, OWNER);

  assert.equal(await gateSignup(signupRequest("/api/auth/sign-in/email", { email: "x@y.z" }), undefined), null);
});
