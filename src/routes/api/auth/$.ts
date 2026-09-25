import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { gateSignup } from "@/lib/auth/signup-gate";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) =>
        (await gateSignup(request, process.env.AUTH_SIGNUP_ALLOWLIST)) ?? auth.handler(request),
    },
  },
});
