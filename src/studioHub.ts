/** V4.0 Integrated card-production pipeline.
 * Reuses the existing validated CDB, card, 3:4, asset-pack and EDOPro engines.
 * Every bulk mutation is an explicit preview/apply action.
 */
import { strToU8, zipSync } from "fflate";
import type { Card } from "./model";
import { DEFAULT_SIMPLE_OVERFRAME } from "./simpleOverframe";
import { compareAvailability, renderCompareExport } from "./cardCompare";
import type { EDOProFitMode } from "./batchOverframe";

export type HubImageType = "normal" | "overframe";
export type HubOutputType = "normal" | "overframe" | "both";
export type HubOutputResolution = "original" | "edopro";
export interface HubOutputOptions {
  mode: HubOutputType;
  resolution: HubOutputResolution;
  fit: EDOProFitMode;
}
export const DEFAULT_HUB_OUTPUT: HubOutputOptions = {
  mode: "both", resolution: "original", fit: "crop",
};
export const HUB_MAX_SELECTED = 100;
export const HUB_MAX_ARCHIVE_BYTES = 240 * 1024 * 1024;
export type HubImageAssignments = {
  patches: {id:number;artwork?:string;simpleOverframe?:NonNullable<Card["simpleOverframe"]>}[];
  skippedExisting: number[];
  skippedNotSelected: number[];
  unknownIds: number[];
};
export type HubExportReport = {
  selected: number[];
  produced: {id:number;name:string;mode:"normal"|"overframe";path:string;size:[number,number]}[];
  omitted: {id:number;name:string;mode:"normal"|"overframe";reason:string}[];
  files: number;
};
export function hubCardStates(card:Card) {
  return {
    normal: !!card.artwork,
    overframe: !!card.simpleOverframe?.image,
    dual: !!card.artwork && !!card.simpleOverframe?.image,
  };
}
/** Plan image updates without modifying existing card objects or source images. */
export function planHubImageAssignments(
  cards:readonly Card[],
  images:Readonly<Record<number,string>>,
  selectedIds:readonly number[],
  type:HubImageType,
  overwrite=false,
):HubImageAssignments {
  const selected=new Set(selectedIds);
  const known=new Map(cards.map(c=>[c.id,c]));
  const result:HubImageAssignments={
    patches:[],skippedExisting:[],skippedNotSelected:[],unknownIds:[],
  };
  for(const [rawId,image] of Object.entries(images)) {
    const id=Number(rawId);
    const card=known.get(id);
    if(!card){result.unknownIds.push(id);continue;}
    if(!selected.has(id)){result.skippedNotSelected.push(id);continue;}
    if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image) ||
      image.length>=16_000_000)throw Error(id+"번 카드의 이미지 형식이 올바르지 않습니다.");
    const old=type==="normal"?card.artwork:card.simpleOverframe?.image;
    if(old && !overwrite){result.skippedExisting.push(id);continue;}
    if(type==="normal")result.patches.push({id,artwork:image});
    else result.patches.push({
      id,simpleOverframe:{...DEFAULT_SIMPLE_OVERFRAME,...card.simpleOverframe,image},
    });
  }
  return result;
}
/** Apply planned updates to a cloned project, leaving unrelated art and settings intact. */
export function applyHubImageAssignments(cards:readonly Card[],plan:HubImageAssignments):Card[] {
  const patches=new Map(plan.patches.map(p=>[p.id,p]));
  return cards.map(card=>{
    const patch=patches.get(card.id);
    return patch ? {
      ...card,...patch,
      // When changing the ordinary artwork, reset only the old normal-art crop.
      ...(patch.artwork!==undefined?{artCrop:undefined,zoom:1,offsetX:0,offsetY:0}:{}),
    }:card;
  });
}
export function hubSelected(ids:readonly number[],cards:readonly Card[]):number[] {
  const known=new Set(cards.map(c=>c.id));
  const unique=[...new Set(ids.filter(id=>known.has(id)))];
  if(unique.length>HUB_MAX_SELECTED)throw Error("한 번에 최대 100장까지 선택할 수 있습니다.");
  return unique;
}
export function hubOutputPath(
  id:number,mode:"normal"|"overframe",resolution:HubOutputResolution,choice:HubOutputType,
):string {
  if(resolution==="original")
    return (mode==="normal"?"고화질_일반/":"고화질_오버프레임/")+id+".png";
  // Both variants must never have colliding EDOPro filenames.
  if(choice==="both")
    return (mode==="normal"?"EDOPro_일반/pics/":"EDOPro_오버프레임/pics/")+id+".png";
  return "pics/"+id+".png";
}
export async function exportStudioHubZip(
  cards:readonly Card[],
  ids:readonly number[],
  options:HubOutputOptions,
  progress:(message:string)=>void,
  signal?:AbortSignal,
):Promise<{blob:Blob;report:HubExportReport}>{
  const selected=hubSelected(ids,cards);
  if(!selected.length)throw Error("먼저 출력할 카드를 선택하세요.");
  if(!["normal","overframe","both"].includes(options.mode)||
    !["original","edopro"].includes(options.resolution)||
    !["crop","pad"].includes(options.fit))
    throw Error("출력 옵션이 잘못되었습니다.");
  const byId=new Map(cards.map(c=>[c.id,c]));
  const files:Record<string,Uint8Array>={};
  const report:HubExportReport={selected,produced:[],omitted:[],files:0};
  let total=0;
  const modes=options.mode==="both"?(["normal","overframe"] as const):
    ([options.mode] as ("normal"|"overframe")[]);
  for(let i=0;i<selected.length;i++){
    if(signal?.aborted)throw Error("ZIP 출력을 취소했습니다.");
    const card=byId.get(selected[i])!;
    for(const mode of modes){
      if(signal?.aborted)throw Error("ZIP 출력을 취소했습니다.");
      progress((i+1)+" / "+selected.length+" · "+card.id+" · "+(mode==="normal"?"일반":"오버프레임"));
      const warnings=compareAvailability(card)[mode];
      if(warnings.length){
        report.omitted.push({id:card.id,name:card.name,mode,reason:warnings.join(" / ")});
        continue;
      }
      try {
        const blob=await renderCompareExport(card,mode,options.resolution,options.fit);
        total+=blob.size;
        if(total>HUB_MAX_ARCHIVE_BYTES)
          throw Error("출력 ZIP이 240MB를 넘습니다. 카드 수를 줄여 나누어 다운로드하세요.");
        const path=hubOutputPath(card.id,mode,options.resolution,options.mode);
        files[path]=new Uint8Array(await blob.arrayBuffer());
        const size:[number,number]=options.resolution==="edopro"?[421,614]:
          mode==="normal"?[1263,1842]:[1500,2000];
        report.produced.push({id:card.id,name:card.name,mode,path,size});
      }catch(e){
        const reason=e instanceof Error?e.message:"렌더링 오류";
        if(reason.includes("240MB"))throw e;
        report.omitted.push({id:card.id,name:card.name,mode,reason});
      }
    }
    // Keep the interface responsive on large batches.
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(signal?.aborted)throw Error("ZIP 출력을 취소했습니다.");
  if(!report.produced.length)
    throw Error("출력 가능한 카드가 없습니다. 원화와 자산팩을 확인하세요.");
  report.files=report.produced.length;
  files["제작_검수보고서.json"]=strToU8(JSON.stringify({
    schema_version:4,application:"YGO STUDIO",type:"integrated_batch",
    requested:selected.length,output:options,success:report.produced.length,
    items:report.produced,skipped:report.omitted,
  },null,2));
  files["누락_및_오류.txt"]=strToU8(report.omitted.length
    ?report.omitted.map(x=>x.id+" · "+x.name+" · "+x.mode+": "+x.reason).join("\n")
    :"누락·오류 없음");
  const archive=zipSync(files,{level:0});
  return {
    blob:new Blob([archive as Uint8Array<ArrayBuffer>],{type:"application/zip"}),
    report,
  };
}
