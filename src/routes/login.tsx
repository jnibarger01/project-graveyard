import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

// The Grok broker only accepts Grok-hosted callbacks, so deploys elsewhere
// (e.g. Vercel) set VITE_GROK_OAUTH=false to hide buttons that cannot work.
const grokOAuthEnabled = import.meta.env.VITE_GROK_OAUTH !== "false";

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
          <div className="space-y-6">
            <EmailPasswordForm />
            {grokOAuthEnabled && (
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
            )}
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

function EmailPasswordForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const { error: authError } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: name || email });
    setPending(false);
    if (authError) {
      setError(authError.message ?? "Sign-in failed.");
      return;
    }
    // Full load so the server renders with the new session cookie.
    window.location.assign("/");
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {mode === "sign-up" && (
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
      <button
        type="button"
        className="block w-full text-center text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(null);
        }}
      >
        {mode === "sign-in" ? "First time here? Create your account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
