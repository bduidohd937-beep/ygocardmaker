/** V4.3 batch image recovery. Only the latest applied batch can be undone.
 * Originals are preserved in memory for this open workspace session only.
 * If a touched field changed after applying, the conflicting card is skipped.
 */
import type { Card } from "./model";
import type { HubImageAssignments, HubImageType } from "./studioHub";

type NormalUndo = {
  id: number;
  type: "normal";
  before: Pick<Card, "artwork" | "zoom" | "offsetX" | "offsetY"> & {
    artCrop?: Card["artCrop"];
    hadCrop: boolean;
  };
  appliedImage: string;
};
type OverframeUndo = {
  id: number;
  type: "overframe";
  before: Card["simpleOverframe"];
  applied: NonNullable<Card["simpleOverframe"]>;
};
export type HubImageUndo = NormalUndo | OverframeUndo;
export interface HubUndoResult {
  cards: Card[];
  restored: number[];
  skipped: number[];
}

export function selectImageCards(
  cards: readonly Card[],
  type: HubImageType,
  mode: "missing" | "matched",
  matchedImages: Readonly<Record<number,string>> = {},
  limit = 100,
): {ids: number[]; total: number} {
  const matches = cards.filter(card => mode === "missing"
    ? (type === "normal" ? !card.artwork : !card.simpleOverframe?.image)
    : Object.hasOwn(matchedImages,card.id));
  return {ids: matches.slice(0,limit).map(card=>card.id), total:matches.length};
}

/** Capture exactly the fields that applying an image touches. */
export function captureHubImageUndo(
  cards: readonly Card[], plan: HubImageAssignments,
): HubImageUndo[] {
  const byId = new Map(cards.map(card=>[card.id,card]));
  const snapshot: HubImageUndo[] = [];
  for (const patch of plan.patches) {
    const card = byId.get(patch.id);
    if(!card)continue;
    if(patch.artwork!==undefined){
      snapshot.push({
        id:card.id,type:"normal",appliedImage:patch.artwork,
        before:{
          artwork:card.artwork,zoom:card.zoom,offsetX:card.offsetX,offsetY:card.offsetY,
          artCrop:card.artCrop,hadCrop:Object.hasOwn(card,"artCrop"),
        },
      });
    } else if(patch.simpleOverframe){
      snapshot.push({id:card.id,type:"overframe",before:card.simpleOverframe,
        applied:patch.simpleOverframe});
    }
  }
  return snapshot;
}

/** Undo only if nothing in the affected image slot has been edited meanwhile. */
export function restoreHubImages(
  cards: readonly Card[], history: readonly HubImageUndo[],
): HubUndoResult {
  const byId = new Map(history.map(item=>[item.id,item]));
  const restored: number[] = [], skipped: number[] = [];
  const updated = cards.map(card=>{
    const item = byId.get(card.id);
    if(!item)return card;
    if(item.type==="normal"){
      if(card.artwork!==item.appliedImage || card.artCrop!==undefined ||
        card.zoom!==1 || card.offsetX!==0 || card.offsetY!==0){
        skipped.push(card.id);return card;
      }
      const next:Card={...card,artwork:item.before.artwork,
        zoom:item.before.zoom,offsetX:item.before.offsetX,offsetY:item.before.offsetY};
      if(item.before.hadCrop)next.artCrop=item.before.artCrop;
      else delete next.artCrop;
      restored.push(card.id);
      return next;
    }
    if(!card.simpleOverframe ||
      card.simpleOverframe.image!==item.applied.image ||
      JSON.stringify(card.simpleOverframe)!==JSON.stringify(item.applied)){
      skipped.push(card.id);return card;
    }
    const next:Card={...card};
    if(item.before===undefined)delete next.simpleOverframe;
    else next.simpleOverframe=item.before;
    restored.push(card.id);
    return next;
  });
  // Include deleted cards in skipped count, never recreate them.
  const existing=new Set(cards.map(card=>card.id));
  for(const item of history)if(!existing.has(item.id))skipped.push(item.id);
  return {cards:updated,restored,skipped};
}
