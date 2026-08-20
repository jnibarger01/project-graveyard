import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RECOMMENDATION_COPY } from "@/lib/format";
import { uniqueLanguages } from "@/lib/stats";
import { EMPTY_FILTERS, useGraveyard } from "@/lib/store";
import { RECOMMENDATIONS, WORK_REMAINING, type Repo } from "@/lib/types";

export function FilterBar({ repos }: { repos: Repo[] }) {
  const filters = useGraveyard((s) => s.filters);
  const setFilters = useGraveyard((s) => s.setFilters);
  const reset = useGraveyard((s) => s.resetFilters);
  const langs = uniqueLanguages(repos);
  const dirty = JSON.stringify(filters) !== JSON.stringify({ ...EMPTY_FILTERS, q: filters.q });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        <Select
          value={filters.recommendation}
          onValueChange={(v) => setFilters({ recommendation: v as typeof filters.recommendation })}
        >
          <SelectTrigger aria-label="Recommendation">
            <SelectValue placeholder="Recommendation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fates</SelectItem>
            {RECOMMENDATIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {RECOMMENDATION_COPY[r].verb}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.language} onValueChange={(v) => setFilters({ language: v })}>
          <SelectTrigger aria-label="Language">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {langs.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.activity}
          onValueChange={(v) => setFilters({ activity: v as typeof filters.activity })}
        >
          <SelectTrigger aria-label="Activity">
            <SelectValue placeholder="Activity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any activity</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="dormant">Dormant</SelectItem>
            <SelectItem value="archived">Archived / bury</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.work} onValueChange={(v) => setFilters({ work: v as typeof filters.work })}>
          <SelectTrigger aria-label="Work remaining">
            <SelectValue placeholder="Work remaining" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any remaining work</SelectItem>
            {WORK_REMAINING.map((w) => (
              <SelectItem key={w} value={w}>
                {w}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.visibility}
          onValueChange={(v) => setFilters({ visibility: v as typeof filters.visibility })}
        >
          <SelectTrigger aria-label="Visibility">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Public + private</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={String(filters.minScore)}
          onValueChange={(v) => setFilters({ minScore: Number(v) })}
        >
          <SelectTrigger aria-label="Min resurrection score">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any score</SelectItem>
            <SelectItem value="40">Score ≥ 40</SelectItem>
            <SelectItem value="65">Score ≥ 65</SelectItem>
            <SelectItem value="80">Score ≥ 80</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={String(filters.minProduct)}
          onValueChange={(v) => setFilters({ minProduct: Number(v) })}
        >
          <SelectTrigger aria-label="Min product potential">
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any product potential</SelectItem>
            <SelectItem value="50">Product ≥ 50</SelectItem>
            <SelectItem value="70">Product ≥ 70</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {dirty && (
        <div>
          <Button variant="ghost" size="sm" onClick={reset}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
