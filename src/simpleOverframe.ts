/** Standalone 3:4 overframe artwork. This never reuses the legacy card frame. */
import type { Frame } from "./model";
import { assetUrl, assetFont, ensureAssetFonts } from "./assetPack";
import { ASSET_LAYOUT } from "./assetRender";

const NATIVE_CARD_WIDTH = 1394;
const ATTRIBUTE_CODES: Record<string, string> = {
  "어둠": "dark", "빛": "light", "땅": "earth", "물": "water",
  "불": "fire", "바람": "wind", "신": "divine",
};

export interface SimpleOverframe {
  image: string;
  showName: boolean;
  showAttribute: boolean;
  /** Optional for V3 projects written before the authentic rank/level overlay was added. */
  showLevel?: boolean;
  showEffectBox: boolean;
  showEffectText: boolean;
  effectStyle: "glass" | "classic" | "outline";
  effectOpacity: number;
  effectTop: number;
  effectHeight: number;
}

export const DEFAULT_SIMPLE_OVERFRAME: SimpleOverframe = {
  image: "",
  showName: true, showAttribute: true, showLevel: true, showEffectBox: true, showEffectText: false,
  effectStyle: "glass", effectOpacity: 78, effectTop: 76, effectHeight: 21,
};
export const PORTRAIT_WIDTH = 900;
export const PORTRAIT_HEIGHT = 1200;
export function validSimpleOverframe(value: unknown): value is SimpleOverframe {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return typeof r.image === "string" &&
    (r.image === "" || (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(r.image) && r.image.length < 16_000_000)) &&
    ["showName", "showAttribute", "showEffectBox", "showEffectText"].every(k => typeof r[k] === "boolean") &&
    (r.showLevel === undefined || typeof r.showLevel === "boolean") &&
    (r.effectStyle === "glass" || r.effectStyle === "classic" || r.effectStyle === "outline") &&
    typeof r.effectOpacity === "number" && Number.isFinite(r.effectOpacity) && r.effectOpacity >= 0 && r.effectOpacity <= 100 &&
    typeof r.effectTop === "number" && Number.isFinite(r.effectTop) && r.effectTop >= 55 && r.effectTop <= 87 &&
    typeof r.effectHeight === "number" && Number.isFinite(r.effectHeight) && r.effectHeight >= 10 && r.effectHeight <= 32 &&
    r.effectTop + r.effectHeight <= 99;
}
export function cropToPortrait(imageWidth: number, imageHeight: number) {
  if (imageWidth <= 0 || imageHeight <= 0) throw Error("원화의 크기가 올바르지 않습니다.");
  const aspect = PORTRAIT_WIDTH / PORTRAIT_HEIGHT;
  const sourceAspect = imageWidth / imageHeight;
  if (sourceAspect > aspect) {
    const sw = imageHeight * aspect;
    return { sx: (imageWidth - sw) / 2, sy: 0, sw, sh: imageHeight };
  }
  const sh = imageWidth / aspect;
  return { sx: 0, sy: (imageHeight - sh) / 2, sw: imageWidth, sh };
}
function loadArtwork(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error("오버프레임 원화를 열 수 없습니다."));
    img.src = src;
  });
}
function paintRounded(ctx: CanvasRenderingContext2D, x: number, y: number,
  w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}
/** Reuse the very same font face as the existing asset-card renderer. */
function fitTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  let n = 106 * PORTRAIT_WIDTH / NATIVE_CARD_WIDTH;
  for (; n > 26; n--) {
    ctx.font = `600 ${n}px ${assetFont("name")}`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  return n;
}
/** No homemade circles, Unicode attribute glyphs or star icons. */
export function requiredSimpleOverframeAssets(
  config: SimpleOverframe, attribute: string, frame: Frame, level: number,
): string[] {
  const keys: string[] = [];
  if (config.showName) keys.push("font:name");
  if (config.showAttribute)
    keys.push("attribute:" + (frame === "spell" || frame === "trap"
      ? frame : ATTRIBUTE_CODES[attribute] ?? "dark"));
  if (config.showLevel !== false && !["spell", "trap", "link"].includes(frame) && level > 0)
    keys.push(frame === "xyz" ? "star:rank" : "star:level");
  if (config.showEffectBox && config.showEffectText) keys.push("font:body");
  return keys.filter(key => !assetUrl(key));
}
export function sourceAssetKeyForLevel(frame: Frame): string | null {
  return frame === "spell" || frame === "trap" || frame === "link"
    ? null : frame === "xyz" ? "star:rank" : "star:level";
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const ch of Array.from(paragraph)) {
      if (current && ctx.measureText(current + ch).width > width) {
        lines.push(current);
        current = ch;
      } else current += ch;
    }
    lines.push(current);
  }
  return lines;
}

/** WYSIWYG canvas renderer. No card chrome, repeated art layer or effect stat bar. */
export async function renderSimpleOverframe(
  canvas: HTMLCanvasElement,
  config: SimpleOverframe,
  title: string,
  attribute: string,
  effect: string,
  width = PORTRAIT_WIDTH,
  frame: Frame = "effect",
  level = 4,
): Promise<void> {
  if (!validSimpleOverframe(config)) throw Error("오버프레임 간편 모드 설정이 올바르지 않습니다.");
  if (!config.image) throw Error("3:4 원화를 먼저 업로드하세요.");
  if (width < 180 || width > 3000) throw Error("지원하지 않는 출력 해상도입니다.");
  const missing = requiredSimpleOverframeAssets(config, attribute, frame, level);
  if (missing.length) throw Error("기존 카드 에셋이 없습니다: " + missing.join(", ") +
    ". YGO STUDIO 왼쪽의 '카드 프레임 ZIP 불러오기'에서 원본 리소스를 적용하세요.");
  await ensureAssetFonts();
  await document.fonts.ready;
  const image = await loadArtwork(config.image);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("캔버스를 사용할 수 없습니다.");
  canvas.width = width;
  canvas.height = Math.round(width * 4 / 3);
  ctx.setTransform(width / PORTRAIT_WIDTH, 0, 0, canvas.height / PORTRAIT_HEIGHT, 0, 0);
  const c = cropToPortrait(image.naturalWidth, image.naturalHeight);
  ctx.drawImage(image, c.sx, c.sy, c.sw, c.sh, 0, 0, PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
  if (config.showName || config.showAttribute) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 160);
    gradient.addColorStop(0, "rgba(5,6,18,.91)");
    gradient.addColorStop(.72, "rgba(5,6,18,.55)");
    gradient.addColorStop(1, "rgba(5,6,18,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, PORTRAIT_WIDTH, 160);
  }
  const nativeScale = PORTRAIT_WIDTH / NATIVE_CARD_WIDTH;
  if (config.showName) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,.8)";
    ctx.shadowBlur = 6;
    const maxWidth = ASSET_LAYOUT.name.maxW * nativeScale;
    fitTitle(ctx, title, maxWidth);
    ctx.fillStyle = "#f7f3fc";
    ctx.fillText(title, ASSET_LAYOUT.name.x * nativeScale,
      (ASSET_LAYOUT.name.y + ASSET_LAYOUT.name.opticalYOffset) * nativeScale, maxWidth);
    ctx.shadowBlur = 0;
  }
  if (config.showAttribute) {
    const key = frame === "spell" || frame === "trap" ? frame : ATTRIBUTE_CODES[attribute] ?? "dark";
    const img = await loadArtwork(assetUrl("attribute:" + key)!);
    const area = ASSET_LAYOUT.attribute;
    ctx.drawImage(img, area.x * nativeScale, area.y * nativeScale,
      area.w * nativeScale, area.h * nativeScale);
  }
  const starKey = config.showLevel !== false ? sourceAssetKeyForLevel(frame) : null;
  if (starKey && level > 0) {
    const star = await loadArtwork(assetUrl(starKey)!);
    const step = ASSET_LAYOUT.level.step * nativeScale;
    const size = ASSET_LAYOUT.level.size * nativeScale;
    for (let i = 0; i < Math.min(level, 13); i++) {
      const base = level < 13 ? 147 : 101;
      const x = frame === "xyz"
        ? (base * nativeScale + i * step)
        : (PORTRAIT_WIDTH - base * nativeScale - size - i * step);
      ctx.drawImage(star, x, ASSET_LAYOUT.level.y * nativeScale, size, size);
    }
  }
  if (config.showEffectBox) {
    const x = 36, w = 828;
    const y = Math.round(PORTRAIT_HEIGHT * config.effectTop / 100);
    const h = Math.round(PORTRAIT_HEIGHT * config.effectHeight / 100);
    ctx.save();
    const opacity = config.effectOpacity / 100;
    if (config.effectStyle !== "outline") {
      ctx.fillStyle = config.effectStyle === "classic"
        ? `rgba(245,237,226,${opacity})`
        : `rgba(12,13,29,${opacity})`;
      paintRounded(ctx, x, y, w, h, 13);
      ctx.fill();
    }
    ctx.strokeStyle = config.effectStyle === "classic"
      ? "rgba(103,76,53,.9)" : "rgba(220,205,245,.85)";
    ctx.lineWidth = config.effectStyle === "outline" ? 3 : 2;
    paintRounded(ctx, x, y, w, h, 13);
    ctx.stroke();
    if (config.showEffectText && effect.trim()) {
      ctx.beginPath();
      ctx.rect(x + 22, y + 18, w - 44, h - 36);
      ctx.clip();
      ctx.fillStyle = config.effectStyle === "classic" ? "#241c26" : "#fff";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      let size = 28, lines: string[] = [];
      for (; size >= 14; size--) {
        ctx.font = `400 ${size}px ${assetFont("body")}`;
        lines = wrapText(ctx, effect, w - 48);
        if (lines.length * size * 1.45 <= h - 36) break;
      }
      lines.forEach((line, i) => {
        const lineY = y + 19 + i * Math.max(14, size) * 1.45;
        if (lineY < y + h - 15) ctx.fillText(line, x + 24, lineY);
      });
    }
    ctx.restore();
  }
}
