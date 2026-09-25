/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default. To enable: set `emailAndPasswordEnabled` to `true` below,
 * then build sign-up / sign-in forms with `authClient.signUp.email` /
 * `authClient.signIn.email` from `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
// On: the Vercel deploy can't use the Grok broker (it only accepts Grok preview
// hosts). Who may sign up is limited by AUTH_SIGNUP_ALLOWLIST (./signup-gate).
export const emailAndPasswordEnabled = true;
