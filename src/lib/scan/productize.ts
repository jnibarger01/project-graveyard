import { estimateWork } from "./estimate.ts";
import { scoreReadiness } from "./readiness.ts";
import type { ProductizationAssessment, RepoScanEvidence } from "./types.ts";

export interface ProductizeInputs {
  name: string;
  description: string;
  readme?: string;
  evidence: RepoScanEvidence;
}

const TARGET_HINTS: Array<{ re: RegExp; user: string }> = [
  { re: /developer|cli|devtool|scaffold|sdk|api|library/i, user: "Developers / engineering teams" },
  { re: /advisor|service department|dealership|dealer|workshop|service/i, user: "Service operations managers" },
  { re: /parcel|real estate|county|property|gis|land/i, user: "Real-estate / property professionals" },
  { re: /listing|realtor|agent|broker|buy/i, user: "Real-estate agents / buyers" },
  { re: /financ|budget|ledger|invoice|billing|payment/i, user: "Finance / operations staff" },
  { re: /homelab|home lab|self-host|server/i, user: "Self-hosting hobbyists / SREs" },
  { re: /agent|llm|prompt|model|ai/i, user: "AI / ML practitioners" },
];

const MONETIZATION_HINTS: Array<{ re: RegExp; mode: string }> = [
  { re: /stripe|billing|checkout|subscription|plan|seat/i, mode: "Subscription / usage-based billing" },
  { re: /payment|paywall|purchase|license key/i, mode: "One-time purchase / license" },
  { re: /api key|rate limit|quota/i, mode: "API / usage metering" },
];

const ALTERNATIVE_HINTS: Record<string, string[]> = {
  "real-estate": ["Zillow, County GIS portals, CAMA systems"],
  "service department": ["dealership DMS dashboards (CDK, Reynolds)"],
  agent: ["LangChain, CrewAI, open-source agent frameworks"],
  devtool: ["Turborepo, Create React App, existing CLI generators"],
  homelab: ["Uptime Kuma, Grafana, Homepage dashboards"],
  finance: ["QuickBooks, existing accounting exports"],
};

export function assessProductization(input: ProductizeInputs): ProductizationAssessment {
  const readiness = scoreReadiness(input.evidence);
  const text = `${input.name} ${input.description} ${input.readme ?? ""}`;

  // Problem clarity: how specifically the purpose is stated.
  let problemClarity = 20;
  if (input.description && input.description.length > 60) problemClarity += 25;
  if (input.readme && input.readme.length > 600) problemClarity += 20;
  if (/solve|build|track|manage|automate|monitor|search|schedule|review|report|dispatch/i.test(text)) problemClarity += 15;
  const namedEntity = TARGET_HINTS.some((h) => h.re.test(text));
  if (namedEntity) problemClarity += 20;
  problemClarity = Math.min(100, problemClarity);

  const targetUser = TARGET_HINTS.find((h) => h.re.test(text))?.user ?? null;

  // Differentiation: what the repo has that is uncommon.
  const differentiation: string[] = [];
  if (input.evidence.runtime.backend.length > 0) differentiation.push(`${input.evidence.runtime.backend.join("/")} backend`);

  // Alternatives are unverified unless we actually researched them; map domain guesses.
  const domain = Object.keys(ALTERNATIVE_HINTS).find((k) => ALTERNATIVE_HINTS[k] && text.toLowerCase().includes(k));
  const alternatives = domain ? ALTERNATIVE_HINTS[domain] : [];

  // Monetization: only claim what the code actually shows.
  const monetization = MONETIZATION_HINTS.filter((h) => h.re.test(text)).map((h) => h.mode);

  // Technical readiness for productization: heavier weight on real wiring.
  const techScore = Math.min(
    100,
    Math.round(
      readiness.readiness * 0.5 +
        (input.evidence.maturity.deployment ? 12 : 0) +
        (input.evidence.runtime.auth.length > 0 ? 10 : 0) +
        (input.evidence.runtime.database.length > 0 ? 8 : 0) +
        (input.evidence.maturity.testPresence ? 6 : 0),
    ),
  );

  const distributionDifficulty: ProductizationAssessment["distributionDifficulty"] =
    !input.evidence.maturity.deployment
      ? "high"
      : input.evidence.runtime.database.length > 0 || input.evidence.runtime.auth.length > 0
        ? "medium"
        : "low";

  const unverified = [
    "Market demand has not been researched — do not assume revenue potential.",
    "Competitors and pricing have not been researched.",
    "No target customer has been interviewed.",
  ];
  if (alternatives.length === 0) unverified.push("No known alternatives identified — treat as unverified rather than 'no competition'.");

  const verdict =
    techScore >= 55 && problemClarity >= 55
      ? "Technically plausible to productize; validate demand before investing further."
      : techScore < 55
        ? "Technical readiness is too low for a product push right now — finish the foundation first."
        : "Problem is not clearly defined enough to justify product investment yet.";

  return {
    problemClarity,
    targetUser,
    differentiation: differentiation.slice(0, 4),
    alternatives,
    monetization,
    technicalReadiness: techScore,
    distributionDifficulty,
    implementationEffort: estimateWork(input.evidence, readiness),
    marketResearched: false,
    unverified,
    verdict,
  };
}