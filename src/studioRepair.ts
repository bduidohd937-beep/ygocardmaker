/** V4.2 safe, opt-in metadata repairs. Never changes artwork, CDB, Lua or effect text. */
import { MONSTER_TRAITS, type Card, type MonsterTrait, type CardPreviewMode } from "./model";

export interface SafeRepairPatch {
  id: number;
  change: Partial<Pick<Card, "traits" | "arrows" | "previewMode">>;
  reasons: string[];
}

export function planStudioSafeRepairs(
  cards: readonly Card[], selectedIds: readonly number[],
): SafeRepairPatch[] {
  const selected = new Set(selectedIds);
  const result: SafeRepairPatch[] = [];
  for (const card of cards) {
    if (!selected.has(card.id)) continue;
    const change: SafeRepairPatch["change"] = {};
    const reasons: string[] = [];
    if (Array.isArray(card.traits) &&
      card.traits.every(x => MONSTER_TRAITS.includes(x as MonsterTrait))) {
      const unique = [...new Set(card.traits)];
      if (unique.length !== card.traits.length) {
        change.traits = unique;
        reasons.push("중복 몬스터 특성 정리");
      }
    }
    if (Array.isArray(card.arrows) && card.arrows.every(Number.isInteger)) {
      const unique = [...new Set(card.arrows)];
      // On a LINK monster, avoid silently changing the declared LINK rating.
      if (unique.length !== card.arrows.length &&
        (card.frame !== "link" || unique.length === card.level)) {
        change.arrows = unique;
        reasons.push("중복 링크 마커 정리");
      }
    }
    const ordinary = !!card.artwork;
    const fullArt = !!card.simpleOverframe?.image;
    let preferred: CardPreviewMode | undefined;
    if (card.previewMode !== undefined &&
      card.previewMode !== "normal" && card.previewMode !== "overframe") {
      preferred = !ordinary && fullArt ? "overframe" : "normal";
    } else if (card.previewMode === "overframe" && !fullArt && ordinary) {
      preferred = "normal";
    } else if (card.previewMode === "normal" && !ordinary && fullArt) {
      preferred = "overframe";
    }
    if (preferred !== undefined && preferred !== card.previewMode) {
      change.previewMode = preferred;
      reasons.push("사용 가능한 원화로 기본 미리보기 전환");
    }
    if (reasons.length) result.push({ id: card.id, change, reasons });
  }
  return result;
}

/** Apply only approved safe fields; unrelated data and object identities are preserved. */
export function applyStudioSafeRepairs(
  cards: readonly Card[], patches: readonly SafeRepairPatch[],
): Card[] {
  const byId = new Map(patches.map(p => [p.id,p.change]));
  return cards.map(card => {
    const patch = byId.get(card.id);
    return patch ? { ...card, ...patch } : card;
  });
}
