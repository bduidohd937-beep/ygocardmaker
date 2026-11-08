import type { Card, Project } from "./model";

export type DeleteScope = "selected" | "theme";

/** Selection for export and deletion is shared, but "select all" is scoped
 * to the currently visible rows so hidden themes are never altered.
 */
export function toggleVisibleSelection(selected: number[], visibleIds: number[]): number[] {
  if (!visibleIds.length) return selected;
  const selectedSet = new Set(selected);
  const allVisibleSelected = visibleIds.every((id) => selectedSet.has(id));
  if (allVisibleSelected) {
    const visibleSet = new Set(visibleIds);
    return selected.filter((id) => !visibleSet.has(id));
  }
  for (const id of visibleIds) selectedSet.add(id);
  return [...selectedSet];
}

export function getDeletionTargets(
  cards: Card[],
  scope: DeleteScope,
  selectedIds: number[],
  visibleIds: number[],
  theme: string,
): Card[] {
  if (scope === "theme") {
    if (!theme || theme === "전체 테마") return [];
    return cards.filter((card) => card.theme === theme);
  }
  const selected = new Set(selectedIds);
  const visible = new Set(visibleIds);
  return cards.filter((card) => selected.has(card.id) && visible.has(card.id));
}

/** Only change the in-browser project. External CDB/PNG sources are untouched. */
export function deleteProjectCards(project: Project, ids: number[]): Project {
  const targets = new Set(ids);
  return { ...project, cards: project.cards.filter((card) => !targets.has(card.id)) };
}
