/** V4.1 production audit; a preflight, not a claim that the final PNG was rendered.
 * Reuses exact output availability rules and checks per-card JSON metadata.
 */
import { compareAvailability } from "./cardCompare";
import { validateCards, type Card } from "./model";
export type AuditVariant = "normal" | "overframe";
export type AuditOutputMode = AuditVariant | "both";
export interface AuditVariantResult {
  mode: AuditVariant;
  ready: boolean;
  issues: string[];
  primaryAction: "normal" | "overframe" | "assets";
}
export interface AuditCardResult {
  id: number;
  name: string;
  theme: string;
  ready: boolean; // at least one requested variant can be exported
  complete: boolean; // all requested variants are ready
  variants: AuditVariantResult[];
}
export interface AuditSummary {
  cards: AuditCardResult[];
  readyCards: number[];
  incompleteCards: number[];
  blockedCards: number[];
  outputsReady: number;
  outputsMissing: number;
}
export function auditCardProduction(card: Card, mode: AuditOutputMode): AuditCardResult {
  const meta = validateCards([card], false);
  const availability = compareAvailability(card);
  const modes: AuditVariant[] = mode === "both" ? ["normal", "overframe"] : [mode];
  const variants = modes.map(variant => {
    const issues = [...meta, ...availability[variant]];
    const assetProblem = issues.some(issue =>
      issue.includes("자산팩 누락") || issue.includes("에셋 누락") || issue.includes("폰트 누락"));
    return {
      mode: variant,
      ready: issues.length === 0,
      issues,
      primaryAction: assetProblem ? "assets" as const : variant,
    };
  });
  return {
    id: card.id,
    name: card.name,
    theme: card.theme,
    ready: variants.some(v => v.ready),
    complete: variants.every(v => v.ready),
    variants,
  };
}
export function auditStudioProduction(
  cards: readonly Card[], selectedIds: readonly number[], mode: AuditOutputMode,
): AuditSummary {
  const known = new Map(cards.map(card => [card.id,card]));
  const selected = [...new Set(selectedIds)].map(id => known.get(id)).filter(
    (card): card is Card => !!card,
  );
  const items = selected.map(card => auditCardProduction(card,mode));
  return {
    cards: items,
    readyCards: items.filter(x => x.ready).map(x => x.id),
    incompleteCards: items.filter(x => !x.complete).map(x => x.id),
    blockedCards: items.filter(x => !x.ready).map(x => x.id),
    outputsReady: items.reduce((sum,x)=>sum+x.variants.filter(v => v.ready).length,0),
    outputsMissing: items.reduce((sum,x)=>sum+x.variants.filter(v => !v.ready).length,0),
  };
}
