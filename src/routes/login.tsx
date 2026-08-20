import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Project Graveyard</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-muted">
            Save decisions across devices. The sample graveyard is available without an account.
          </p>
        </div>
        {authEnabled ? (
          <div className="space-y-2">
            {GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                variant="secondary"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <Link to="/" className="block text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          Enter the sample graveyard
        </Link>
      </div>
    </main>
  );
}
