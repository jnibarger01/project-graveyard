import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BookMarked,
  LayoutDashboard,
  ListTodo,
  Menu,
  Milestone,
  Moon,
  Search,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SignedOut } from "@/lib/auth/gates";
import { GROK_PROVIDERS, authEnabled, signIn, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useGraveyardBootstrap } from "@/lib/persist";
import { useGraveyard } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: BookMarked },
  { to: "/graveyard", label: "Graveyard", icon: Milestone },
  { to: "/queue", label: "Queue", icon: ListTodo },
  { to: "/tonight", label: "Tonight", icon: Moon },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
              active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Account() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="h-10 w-full animate-pulse rounded-lg bg-elevated" />;
  if (!user) {
    return (
      <div className="space-y-2">
        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <Button
              key={p.providerId}
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => signIn(p.providerId, { callbackURL: "/" })}
            >
              Sign in with {p.label}
            </Button>
          ))
        ) : (
          <p className="text-xs text-muted">Sign-in disabled.</p>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="size-8 rounded-full object-cover" />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-elevated text-xs">
          {(user.displayName ?? "U").slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{user.displayName ?? user.primaryEmail}</p>
        <button type="button" onClick={() => void signOut()} className="text-xs text-muted hover:text-fg">
          Sign out
        </button>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1" aria-label="Project Graveyard">
      <span className="grid size-8 place-items-center rounded-md bg-elevated">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            d="M8 20V10.5c0-2.6 1.8-4.5 4-4.5s4 1.9 4 4.5V20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <path d="M9.2 15.5h5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="hidden font-serif text-lg leading-none tracking-tight sm:inline">Project Graveyard</span>
    </Link>
  );
}

export function AppShell() {
  useGraveyardBootstrap();
  const [open, setOpen] = useState(false);
  const filters = useGraveyard((s) => s.filters);
  const setFilters = useGraveyard((s) => s.setFilters);
  const { user, isPending } = useCurrentUserState();

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-bg p-4 lg:flex">
        <Brand />
        <div className="mt-8 flex-1">
          <NavLinks />
        </div>
        <Account />
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-md lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="relative ml-auto min-w-0 max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
              placeholder="Search projects, stacks, notes"
              className="pl-9"
              aria-label="Search projects"
            />
          </div>
        </header>

        {!isPending && !user && (
          <div className="border-b border-border bg-elevated/40 px-4 py-2 text-center text-sm text-muted">
            Sample graveyard — decisions stay on this device.
            <SignedOut>
              {authEnabled && (
                <Link to="/login" className="ml-2 text-fg underline-offset-4 hover:underline">
                  Sign in to save
                </Link>
              )}
            </SignedOut>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex flex-col">
          <Brand />
          <div className="mt-8 flex-1">
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
          <Account />
        </SheetContent>
      </Sheet>
    </div>
  );
}
