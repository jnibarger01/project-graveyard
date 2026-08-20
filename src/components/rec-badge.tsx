import { Badge } from "@/components/ui/badge";
import { RECOMMENDATION_COPY } from "@/lib/format";
import type { Recommendation } from "@/lib/types";

const TONE = {
  FINISH: "finish",
  ARCHIVE: "archive",
  MERGE: "merge",
  OPEN_SOURCE: "oss",
  PRODUCTIZE: "product",
  UNKNOWN: "neutral",
} as const;

export function RecBadge({ rec }: { rec: Recommendation }) {
  return <Badge tone={TONE[rec]}>{RECOMMENDATION_COPY[rec].verb}</Badge>;
}
