/** V3.8 renderer comparison and source-preserving output.
 * No conversion between original art and full-art image: each view renders from its own source.
 */
import { strToU8, zipSync } from "fflate";
import type { Card, CardPreviewMode } from "./model";
import { renderCard, toBlob } from "./render";
import { renderSimpleOverframe, requiredSimpleOverframeAssets, validSimpleOverframe } from "./simpleOverframe";
import { makeEdoCanvas } from "./batchOverframe";
import type { EDOProFitMode } from "./batchOverframe";

export type CompareExportChoice = "normal" | "overframe" | "both";
export type CompareExportSize = "original" | "edopro";
export interface CompareExportSettings {
  choice: CompareExportChoice;
  size: CompareExportSize;
  edoFit: EDOProFitMode;
}
export const DEFAULT_COMPARE_EXPORT: CompareExportSettings = {
  choice: "both", size: "original", edoFit: "crop",
};
export interface CompareAvailability {
  normal: string[];
  overframe: string[];
}
export function compareAvailability(card: Card): CompareAvailability {
  const normal: string[] = [];
  const overframe: string[] = [];
  if (!card.artwork) normal.push("일반 카드 일러스트가 없습니다.");
  if (!card.simpleOverframe?.image) overframe.push("3:4 오버프레임 원화를 먼저 저장하세요.");
  else if (!validSimpleOverframe(card.simpleOverframe))
    overframe.push("오버프레임 설정이 올바르지 않습니다.");
  else {
    const missing = requiredSimpleOverframeAssets(
      card.simpleOverframe,card.attribute,card.frame,card.level);
    if (missing.length) overframe.push("기존 카드 자산팩 누락: " + missing.join(", "));
  }
  return { normal, overframe };
}
export function availableComparisonModes(card: Card) {
  const status=compareAvailability(card);
  return {
    normal:status.normal.length===0,
    overframe:status.overframe.length===0,
  };
}
export function currentPreviewMode(card: Card): CardPreviewMode {
  return card.previewMode==="overframe" && !!card.simpleOverframe?.image
    ? "overframe" : "normal";
}
export async function renderCardVariant(
  card: Card, canvas: HTMLCanvasElement, variant: CardPreviewMode, width?: number,
): Promise<{fontSize:number|null}> {
  if (variant==="normal") {
    return await renderCard(card,canvas,width??842);
  }
  if (!card.simpleOverframe?.image) throw Error("3:4 오버프레임 원화가 없습니다.");
  await renderSimpleOverframe(canvas,card.simpleOverframe,card.name,card.attribute,
    card.effect,width??900,card.frame,card.level,
    {race:card.race,atk:card.atk,def:card.def});
  return {fontSize:null};
}
export function compareFilename(card: Card, variant: CardPreviewMode, size: CompareExportSize) {
  const folder=variant==="normal"?"일반카드":"오버프레임_3대4";
  const prefix=size==="original"?"고화질/":"pics/";
  const base=size==="original"?folder+"/"+card.id+".png":
    card.id+(variant==="normal"?"_일반":"_오버프레임")+".png";
  return prefix+base;
}
export async function renderCompareExport(
  card: Card, variant: CardPreviewMode, size: CompareExportSize,
  fit: EDOProFitMode,
): Promise<Blob> {
  const errors=compareAvailability(card)[variant];
  if(errors.length) throw Error(errors.join(" / "));
  const out=document.createElement("canvas");
  if(size==="original") {
    await renderCardVariant(card,out,variant,variant==="normal"?1263:1500);
  } else if(variant==="normal") {
    await renderCardVariant(card,out,variant,421);
  } else {
    await renderCardVariant(card,out,variant,900);
    return toBlob(makeEdoCanvas(out,fit),"png");
  }
  return toBlob(out,"png");
}
export async function makeCompareZip(
  card: Card, settings: CompareExportSettings,
): Promise<Blob> {
  if (settings.choice!=="both") throw Error("비교 ZIP은 두 형태를 모두 선택해야 합니다.");
  const files:Record<string,Uint8Array>={};
  const manifest:{schema_version:number;card_id:number;card_name:string;
    outputs:{mode:CardPreviewMode;file:string;width:number;height:number}[];
    edo_fit:EDOProFitMode}={
    schema_version:1,card_id:card.id,card_name:card.name,
    outputs:[],edo_fit:settings.edoFit,
  };
  for(const mode of ["normal","overframe"] as const){
    const blob=await renderCompareExport(card,mode,settings.size,settings.edoFit);
    const path=compareFilename(card,mode,settings.size);
    files[path]=new Uint8Array(await blob.arrayBuffer());
    manifest.outputs.push({mode,file:path,width:settings.size==="edopro"?421:
      mode==="normal"?1263:1500,height:settings.size==="edopro"?614:
      mode==="normal"?1842:2000});
  }
  files["비교_출력내역.json"]=strToU8(JSON.stringify(manifest,null,2));
  return new Blob([zipSync(files,{level:0}) as Uint8Array<ArrayBuffer>],
    {type:"application/zip"});
}
