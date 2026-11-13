/** Batch overframe artwork matching, non-destructive configuration and ZIP export.
 * EDOPro 421x614 differs from 3:4: crop/pad without stretching the card.
 */
import { unzipSync, zipSync, strToU8 } from "fflate";
import type { Card } from "./model";
import {
  DEFAULT_SIMPLE_OVERFRAME, renderSimpleOverframe, requiredSimpleOverframeAssets,
  validSimpleOverframe, type SimpleOverframe,
} from "./simpleOverframe";
import { builtInLayout } from "./overframeLayout";
import { recommendedFinish } from "./overframeFinish";
import { recommendLayoutChoices } from "./overframeRecommend";
import { toBlob } from "./render";

export const BATCH_MAX_CARDS = 100;
export const BATCH_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const BATCH_TOTAL_MAX_BYTES = 120 * 1024 * 1024;
export type BatchLayoutMode = "keep" | "default" | "center" | "bottom" | "recommend";
export type BatchFinishMode = "keep" | "off" | "auto";
export type EDOProFitMode = "crop" | "pad";
export type BatchOutput = "full" | "edopro" | "both";
export type ImageMap = Record<number, string>;
export interface ImageMatchResult {
  images: ImageMap;
  warnings: string[];
  matched: number;
  ignored: number;
}
export interface BatchSettings {
  layout: BatchLayoutMode;
  finish: BatchFinishMode;
  fallbackArtwork: boolean;
  output: BatchOutput;
  edoFit: EDOProFitMode;
}
export const DEFAULT_BATCH_SETTINGS: BatchSettings = {
  layout: "keep", finish: "keep", fallbackArtwork: false, output: "both", edoFit: "crop",
};
export interface BatchOutputReport {
  successful: number[];
  skipped: { id: number; reason: string }[];
  manifest: { id: number; name: string; full?: string; edopro?: string }[];
}
export interface BatchExportResult { blob: Blob; report: BatchOutputReport; }
export interface CanvasRect { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number; }

export function filenameCardId(path: string): number | null {
  const name = path.replace(/\\/g, "/").split("/").pop() ?? "";
  const match = /^([1-9][0-9]{0,9})(?:[_\s\-.(][^/\\]*)?\.(png|jpe?g|webp)$/i.exec(name);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 && id <= 4294967295 ? id : null;
}
function imageMime(name: string): string {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.webp$/i.test(name)) return "image/webp";
  return "";
}
function bytesToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(Error("이미지를 읽을 수 없습니다."));
    fr.readAsDataURL(new Blob([new Uint8Array(bytes)], { type: mime }));
  });
}
async function verifyImage(bytes: Uint8Array, mime: string): Promise<string> {
  if (bytes.length > BATCH_IMAGE_MAX_BYTES || !bytes.length)
    throw Error("이미지 용량 초과 또는 빈 파일 (최대 10MB)");
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight ||
      img.naturalWidth * img.naturalHeight > 40_000_000)
      throw Error("이미지는 최대 4000만 픽셀까지 지원합니다.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  const url = await bytesToDataUrl(bytes, mime);
  if (url.length >= 16_000_000) throw Error("저장 가능한 이미지 크기를 초과했습니다.");
  return url;
}
/** ZIP imports are filtered using uncompressed headers BEFORE decompression. */
export async function matchBatchImages(files: readonly File[], cards: readonly Card[]): Promise<ImageMatchResult> {
  if (files.length === 0) throw Error("원화 파일이나 ZIP을 선택하세요.");
  if (files.length > BATCH_MAX_CARDS) throw Error("한 번에 최대 100개 파일을 선택할 수 있습니다.");
  const validIds = new Set(cards.map(c => c.id));
  const warnings: string[] = [];
  const images: ImageMap = {};
  let ignored = 0, sum = 0, examined = 0;
  const candidates: { id: number; name: string; bytes: Uint8Array; mime: string }[] = [];
  function addCandidate(name: string, bytes: Uint8Array) {
    if (++examined > BATCH_MAX_CARDS + 25) {
      ignored++;
      return;
    }
    const id = filenameCardId(name), mime = imageMime(name);
    if (!id || !mime) { ignored++; return; }
    if (!validIds.has(id)) { warnings.push(name + ": 현재 카드 목록에 없는 ID"); ignored++; return; }
    if (candidates.some(c => c.id === id)) {
      warnings.push(name + ": 같은 카드 ID의 이미지가 중복되어 첫 번째 파일만 사용");
      ignored++;
      return;
    }
    if (!bytes.length || bytes.length > BATCH_IMAGE_MAX_BYTES) {
      warnings.push(name + ": 이미지 크기 제한 초과 (10MB)");
      ignored++;
      return;
    }
    sum += bytes.length;
    if (sum > BATCH_TOTAL_MAX_BYTES) throw Error("원화 합계 120MB를 초과했습니다.");
    candidates.push({ id, name, bytes, mime });
  }
  for (const file of files) {
    if (file.size > BATCH_TOTAL_MAX_BYTES) throw Error("파일 크기 제한 초과 (120MB)");
    if (/\.zip$/i.test(file.name)) {
      if (file.size > 80 * 1024 * 1024) throw Error("이미지 ZIP은 최대 80MB까지 지원합니다.");
      let zipTotal = 0, zipCount = 0;
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: info => {
          if (!imageMime(info.name)) return false;
          zipCount++;
          if (zipCount > BATCH_MAX_CARDS + 25 ||
              info.originalSize > BATCH_IMAGE_MAX_BYTES) return false;
          zipTotal += info.originalSize;
          if (zipTotal > BATCH_TOTAL_MAX_BYTES) throw Error("ZIP 압축 해제 크기가 120MB를 넘습니다.");
          return true;
        },
      });
      for (const [name, bytes] of Object.entries(entries)) addCandidate(name, bytes);
    } else {
      if (!imageMime(file.name)) { ignored++; warnings.push(file.name + ": 지원하지 않는 확장자"); continue; }
      addCandidate(file.name, new Uint8Array(await file.arrayBuffer()));
    }
  }
  for (const item of candidates) {
    try { images[item.id] = await verifyImage(item.bytes, item.mime); }
    catch (error) { warnings.push(item.name + ": " + (error instanceof Error ? error.message : "이미지 오류")); ignored++; }
  }
  return { images, warnings, matched: Object.keys(images).length, ignored };
}
export function batchCardConfig(card: Card, images: ImageMap, settings: BatchSettings): SimpleOverframe {
  const base = { ...DEFAULT_SIMPLE_OVERFRAME, ...card.simpleOverframe };
  const image = images[card.id] || card.simpleOverframe?.image ||
    (settings.fallbackArtwork ? card.artwork : "") || "";
  const result: SimpleOverframe = { ...base, image };
  if (settings.layout !== "keep") {
    result.layout = settings.layout === "default" ? undefined :
      settings.layout === "recommend"
        ? recommendLayoutChoices(card,result)[0].layout
        : builtInLayout(settings.layout === "center" ? "중앙형" : "상단 여백형",
          card.frame, card.level, result.effectTop, result.effectHeight);
  }
  if (settings.finish === "off") {
    result.finishEnabled = false;
  } else if (settings.finish === "auto") {
    result.finishEnabled = true;
    result.finishStyle = recommendedFinish(card.frame);
    result.finishStrength = 28;
  }
  return result;
}
export function batchCardIssues(card: Card, config: SimpleOverframe): string[] {
  const problems: string[] = [];
  if (!config.image) problems.push("3:4 원화 없음");
  if (!validSimpleOverframe(config)) problems.push("오버프레임 설정 오류");
  const missing = requiredSimpleOverframeAssets(config, card.attribute, card.frame, card.level);
  if (missing.length) problems.push("원본 카드 에셋 누락: " + missing.join(", "));
  return problems;
}
/** Exact aspect ratio conversion, no non-uniform scaling. */
export function edoRects(srcWidth: number, srcHeight: number, mode: EDOProFitMode): CanvasRect {
  if (!(srcWidth > 0 && srcHeight > 0)) throw Error("원본 이미지 크기가 올바르지 않습니다.");
  const W = 421, H = 614;
  const sourceRatio = srcWidth / srcHeight, targetRatio = W / H;
  if (mode === "crop") {
    if (sourceRatio > targetRatio) {
      const sw = srcHeight * targetRatio;
      return { sx:(srcWidth-sw)/2, sy:0, sw, sh:srcHeight, dx:0,dy:0,dw:W,dh:H };
    }
    const sh = srcWidth / targetRatio;
    return { sx:0,sy:(srcHeight-sh)/2,sw:srcWidth,sh,dx:0,dy:0,dw:W,dh:H };
  }
  if (sourceRatio > targetRatio) {
    const dh=W/sourceRatio;
    return { sx:0,sy:0,sw:srcWidth,sh:srcHeight,dx:0,dy:(H-dh)/2,dw:W,dh };
  }
  const dw=H*sourceRatio;
  return { sx:0,sy:0,sw:srcWidth,sh:srcHeight,dx:(W-dw)/2,dy:0,dw,dh:H };
}
export function makeEdoCanvas(source: HTMLCanvasElement, mode: EDOProFitMode): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 421; canvas.height = 614;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("EDOPro용 이미지 캔버스를 만들 수 없습니다.");
  ctx.fillStyle = "#12131b";
  ctx.fillRect(0,0,421,614);
  const r = edoRects(source.width,source.height,mode);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source,r.sx,r.sy,r.sw,r.sh,r.dx,r.dy,r.dw,r.dh);
  return canvas;
}
export function ensureValidBatchSelection(ids: readonly number[], cards: readonly Card[]) {
  const existing = new Set(cards.map(c => c.id));
  const selected = [...new Set(ids)];
  if (!selected.length) throw Error("출력할 카드를 선택하세요.");
  if (selected.length > BATCH_MAX_CARDS) throw Error("한 번에 최대 100장까지 출력할 수 있습니다.");
  if (selected.some(id => !existing.has(id))) throw Error("존재하지 않는 카드 ID가 포함되어 있습니다.");
  return selected;
}
/** ZIP contains only successful outputs, plus a manifest and a Korean diagnostics report. */
export async function exportBatchOverframes(
  cards: readonly Card[], selectedIds: readonly number[], images: ImageMap,
  settings: BatchSettings, onProgress: (s: string) => void, signal?: AbortSignal,
): Promise<BatchExportResult> {
  const selected = ensureValidBatchSelection(selectedIds,cards);
  if (!["full","edopro","both"].includes(settings.output) ||
      !["crop","pad"].includes(settings.edoFit)) throw Error("출력 설정이 올바르지 않습니다.");
  const byId = new Map(cards.map(c => [c.id,c]));
  const report: BatchOutputReport = { successful: [], skipped: [], manifest: [] };
  const zipFiles: Record<string, Uint8Array> = {};
  const wantsFull = settings.output !== "edopro";
  const wantsEdo = settings.output !== "full";
  for (let i=0;i<selected.length;i++) {
    if (signal?.aborted) throw Error("일괄 제작이 취소되었습니다.");
    const card = byId.get(selected[i])!;
    onProgress((i+1)+" / "+selected.length+" · "+card.name+" 렌더링");
    const config = batchCardConfig(card,images,settings);
    const errors = batchCardIssues(card,config);
    if (errors.length) {
      report.skipped.push({id:card.id,reason:errors.join("; ")});
      continue;
    }
    try {
      const canvas = document.createElement("canvas");
      await renderSimpleOverframe(canvas,config,card.name,card.attribute,
        card.effect,wantsFull?1500:900,card.frame,card.level,
        {race:card.race,atk:card.atk,def:card.def});
      const item: { id:number;name:string;full?:string;edopro?:string } = {id:card.id,name:card.name};
      if (wantsFull) {
        const name = "고화질_3대4/"+card.id+".png";
        zipFiles[name] = new Uint8Array(await (await toBlob(canvas,"png")).arrayBuffer());
        item.full = name;
      }
      if (wantsEdo) {
        const name = "pics/"+card.id+".png";
        zipFiles[name] = new Uint8Array(await (await toBlob(
          makeEdoCanvas(canvas,settings.edoFit),"png")).arrayBuffer());
        item.edopro = name;
      }
      report.manifest.push(item);
      report.successful.push(card.id);
    } catch (e) {
      report.skipped.push({id:card.id,reason:e instanceof Error ? e.message : "렌더링 오류"});
    }
    await new Promise(resolve => setTimeout(resolve,0));
  }
  if (signal?.aborted) throw Error("일괄 제작이 취소되었습니다.");
  if (!report.successful.length)
    throw Error("출력 가능한 카드가 없습니다. 원화·카드 에셋 누락 항목을 확인하세요.");
  const summary = {
    schema_version:1,application:"YGO STUDIO 오버프레임",format:"png",
    full_art_size:[1500,2000],edopro_size:[421,614],
    edopro_fit:settings.edoFit,
    requested:selected.length,successful:report.successful.length,
    skipped:report.skipped,files:report.manifest,
  };
  zipFiles["제작내역.json"]=strToU8(JSON.stringify(summary,null,2));
  zipFiles["누락_및_오류.txt"]=strToU8(report.skipped.length
    ? report.skipped.map(x=>x.id+" · "+x.reason).join("\n")
    : "누락·오류 없음");
  const archive=zipSync(zipFiles,{level:0});
  return {blob:new Blob([archive as Uint8Array<ArrayBuffer>],{type:"application/zip"}),report};
}
