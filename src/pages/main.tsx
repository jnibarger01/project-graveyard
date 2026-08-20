/* eslint-disable react-refresh/only-export-components -- standalone static entry */
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { cloneDemoRepos } from "@/lib/demo-data";
import {
  computeStats,
  graveyardList,
  mostWorthResurrecting,
  productOpportunities,
  queuedRepos,
} from "@/lib/stats";
import { WORK_RANGE, relativeActivity, STATE_COPY } from "@/lib/format";
import type { Repo } from "@/lib/types";
import "../styles.css";

type View = "dashboard" | "projects" | "graveyard" | "queue" | "settings";

const NAV: Array<{ id: View; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "projects", label: "Projects" },
  { id: "graveyard", label: "Graveyard" },
  { id: "queue", label: "Queue" },
  { id: "settings", label: "Settings" },
];

function viewFromHash(): View {
  const value = window.location.hash.replace(/^#\/?/, "").split("/", 1)[0];
  return NAV.some((item) => item.id === value) ? (value as View) : "dashboard";
}

function Score({ score }: { score: number }) {
  return <span className="score-ring">{score}</span>;
}

function Recommendation({ repo }: { repo: Repo }) {
  return <span className={`badge badge-${repo.analysis.recommendation.toLowerCase()}`}>{repo.analysis.recommendation}</span>;
}

function RepoCard({ repo, onQueue }: { repo: Repo; onQueue: (id: string) => void }) {
  const queued = repo.userStatus === "queued";
  return (
    <article className="repo-card">
      <div className="repo-card-top">
        <div className="repo-heading">
          <h3>{repo.name}</h3>
          <Recommendation repo={repo} />
          <span className="eyebrow">{repo.isPrivate ? "Private" : "Public"}</span>
        </div>
        <Score score={repo.analysis.resurrectionScore} />
      </div>
      <p className="muted">{repo.description}</p>
      <div className="progress-label"><span>{STATE_COPY[repo.analysis.currentState]}</span><span>{repo.analysis.completionPct}% complete</span></div>
      <div className="progress"><span style={{ width: `${repo.analysis.completionPct}%` }} /></div>
      <div className="repo-meta"><span>{repo.frameworks.slice(0, 3).join(" · ")}</span><span>Last activity {relativeActivity(repo.lastCommitAt)}</span></div>
      <button className="text-button" type="button" onClick={() => onQueue(repo.id)}>{queued ? "Queued locally" : "Add to local queue"}</button>
    </article>
  );
}

function StatGrid({ repos }: { repos: Repo[] }) {
  const stats = computeStats(repos);
  const items = [
    ["Total projects", stats.total],
    ["Active", stats.active],
    ["Dormant", stats.dormant],
    ["Archive candidates", stats.archived],
    ["Worth resurrecting", stats.recoverable],
    ["Product opportunities", stats.potentialProducts],
  ];
  return <div className="stats-grid">{items.map(([label, value]) => <div className="stat" key={label}><span className="eyebrow">{label}</span><strong>{value}</strong></div>)}<div className="stat stat-wide"><span className="eyebrow">Estimated unfinished workload</span><strong>{WORK_RANGE[stats.unfinishedWorkload].label}</strong><span className="muted">~{stats.unfinishedDaysLow}–{stats.unfinishedDaysHigh} focused days for the non-archive set</span></div></div>;
}

function Dashboard({ repos, onQueue }: { repos: Repo[]; onQueue: (id: string) => void }) {
  const top = mostWorthResurrecting(repos, 4);
  const products = productOpportunities(repos, 3);
  return <div className="stack">
    <header className="hero"><p className="eyebrow">Unfinished work, decided</p><h1>What deserves another weekend?</h1><p className="lead">A local demo of Project Graveyard: finish, merge, productize, or bury dormant projects with intent.</p></header>
    <StatGrid repos={repos} />
    <Section title="Most worth resurrecting" kicker="Highest scores"><div className="card-grid">{top.map((repo) => <RepoCard key={repo.id} repo={repo} onQueue={onQueue} />)}</div></Section>
    <Section title="Product opportunities" kicker="Commercial potential"><div className="card-grid">{products.map((repo) => <RepoCard key={repo.id} repo={repo} onQueue={onQueue} />)}</div></Section>
  </div>;
}

function Projects({ repos, onQueue }: { repos: Repo[]; onQueue: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = repos.filter((repo) => `${repo.name} ${repo.description} ${repo.frameworks.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="stack"><header><p className="eyebrow">Inventory</p><h1>Projects</h1><p className="muted">{filtered.length} of {repos.length} demo projects shown. Search stays in this browser.</p></header><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search demo projects" aria-label="Search demo projects" /><div className="card-grid">{filtered.map((repo) => <RepoCard key={repo.id} repo={repo} onQueue={onQueue} />)}</div></div>;
}

function Queue({ repos, onReset }: { repos: Repo[]; onReset: () => void }) {
  const queue = queuedRepos(repos);
  return <div className="stack"><header><p className="eyebrow">Local-only workflow</p><h1>Queue</h1><p className="muted">This queue is stored only in local browser state. It never writes to a database.</p></header>{queue.length ? <div className="card-grid">{queue.map((repo) => <RepoCard key={repo.id} repo={repo} onQueue={() => onReset()} />)}</div> : <div className="empty">Nothing queued yet. Add a project from Dashboard or Projects.</div>}<button className="secondary-button" type="button" onClick={onReset}>Reset local demo state</button></div>;
}

function Graveyard({ repos }: { repos: Repo[] }) {
  const buried = graveyardList(repos);
  return <div className="stack"><header><p className="eyebrow">Safe to archive</p><h1>The graveyard</h1><p className="muted">Representative records only. GitHub import and deep scanning are unavailable in this static demo.</p></header><div className="card-grid">{buried.map((repo) => <article className="repo-card" key={repo.id}><div className="repo-card-top"><h3>{repo.name}</h3><Score score={repo.analysis.resurrectionScore} /></div><Recommendation repo={repo} /><p className="muted">{repo.analysis.epitaph}</p></article>)}</div></div>;
}

function Settings() {
  return <div className="stack"><header><p className="eyebrow">Static demo boundary</p><h1>Settings</h1><p className="muted">The Pages build intentionally has no auth, database, GitHub credentials, AI keys, or server routes.</p></header><div className="capability-list">{["Authentication — disabled", "Database reads and writes — disabled", "AI re-analysis — disabled", "GitHub import and deep scanning — disabled", "External actions — disabled"].map((item) => <div className="capability" key={item}><span className="status-dot" />{item}</div>)}</div><button className="disabled-button" type="button" disabled>Connect GitHub (unavailable in demo)</button></div>;
}

function Section({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return <section><div className="section-heading"><div><p className="eyebrow">{kicker}</p><h2>{title}</h2></div></div>{children}</section>;
}

function App() {
  const [view, setView] = useState<View>(() => viewFromHash());
  const [repos, setRepos] = useState<Repo[]>(() => cloneDemoRepos());

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const queuedCount = useMemo(() => repos.filter((repo) => repo.userStatus === "queued").length, [repos]);
  const queue = (id: string) => setRepos((current) => current.map((repo) => repo.id === id ? { ...repo, userStatus: repo.userStatus === "queued" ? "none" : "queued", queuePosition: repo.userStatus === "queued" ? null : current.filter((item) => item.userStatus === "queued").length + 1 } : repo));
  const reset = () => setRepos(cloneDemoRepos());

  return <div className="page-shell"><aside className="sidebar"><a className="brand" href="#/"><span className="brand-mark">†</span><span>Project Graveyard</span></a><nav>{NAV.map((item) => <a className={view === item.id ? "nav-link active" : "nav-link"} href={item.id === "dashboard" ? "#/" : `#/${item.id}`} key={item.id}>{item.label}{item.id === "queue" && queuedCount > 0 ? <span className="nav-count">{queuedCount}</span> : null}</a>)}</nav><div className="sidebar-foot"><span className="demo-dot" />Static demo<br /><span className="muted">Local data only</span></div></aside><main className="main"><div className="topbar"><span className="mobile-brand">Project Graveyard</span><span className="demo-pill">GitHub Pages demo</span></div><div className="demo-banner"><strong>Read-only demo mode.</strong> This preview uses bundled sample projects and local browser state. Production auth, database, AI, GitHub, and external actions are not connected.</div><div className="content">{view === "dashboard" && <Dashboard repos={repos} onQueue={queue} />}{view === "projects" && <Projects repos={repos} onQueue={queue} />}{view === "graveyard" && <Graveyard repos={repos} />}{view === "queue" && <Queue repos={repos} onReset={reset} />}{view === "settings" && <Settings />}</div></main></div>;
}

createRoot(document.getElementById("root")!).render(<App />);
