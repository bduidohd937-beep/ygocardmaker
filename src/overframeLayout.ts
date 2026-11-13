/** 3:4 full-art coordinate system: all positions are in 900 × 1200 pixels. */
import type { Frame } from "./model";
import { ASSET_LAYOUT } from "./assetRender";

export const ART_W = 900, ART_H = 1200;
export type OverlayPart = "name" | "attribute" | "level" | "effect";
export type PositionedPart = { x: number; y: number; scale: number };
export type EffectPart = { x: number; y: number; w: number; h: number };
export type OverframeLayout = {
  name?: PositionedPart;
  attribute?: PositionedPart;
  level?: PositionedPart;
  effect?: EffectPart;
};
export type LayoutPreset = { name: string; layout: OverframeLayout };
export type OverlayRect = { x: number; y: number; w: number; h: number };
const native = ART_W / 1394;

export function defaultOverlayRects(frame: Frame, level: number, effectTop = 76, effectHeight = 21):
  Record<OverlayPart, OverlayRect> {
  const star = ASSET_LAYOUT.level;
  const count = Math.max(0, Math.min(13, level));
  const step = star.step * native;
  const size = star.size * native;
  const rowWidth = count ? size + (count - 1) * step : size;
  return {
    name: {
      x: ASSET_LAYOUT.name.x * native,
      y: (ASSET_LAYOUT.name.y + ASSET_LAYOUT.name.opticalYOffset) * native,
      w: ASSET_LAYOUT.name.maxW * native,
      h: 72,
    },
    attribute: {
      x: ASSET_LAYOUT.attribute.x * native,
      y: ASSET_LAYOUT.attribute.y * native,
      w: ASSET_LAYOUT.attribute.w * native,
      h: ASSET_LAYOUT.attribute.h * native,
    },
    level: {
      x: frame === "xyz" ? (count === 13 ? 101 : 147) * native
        : ART_W - (count === 13 ? 101 : 147) * native - rowWidth,
      y: star.y * native,
      w: rowWidth,
      h: size,
    },
    effect: {
      x: 36, y: ART_H * effectTop / 100, w: 828, h: ART_H * effectHeight / 100,
    },
  };
}
export function overlayRects(
  config: { layout?: OverframeLayout; effectTop: number; effectHeight: number },
  frame: Frame,
  level: number,
): Record<OverlayPart, OverlayRect> {
  const base = defaultOverlayRects(frame, level, config.effectTop, config.effectHeight);
  const l = config.layout;
  return {
    name: { ...base.name, ...(l?.name ? { x: l.name.x, y: l.name.y,
      w: base.name.w * l.name.scale, h: base.name.h * l.name.scale } : {}) },
    attribute: { ...base.attribute, ...(l?.attribute ? { x: l.attribute.x, y: l.attribute.y,
      w: base.attribute.w * l.attribute.scale, h: base.attribute.h * l.attribute.scale } : {}) },
    level: { ...base.level, ...(l?.level ? { x: l.level.x, y: l.level.y,
      w: base.level.w * l.level.scale, h: base.level.h * l.level.scale } : {}) },
    effect: { ...base.effect, ...l?.effect },
  };
}
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const within = (r: OverlayRect) => finite(r.x) && finite(r.y) && finite(r.w) && finite(r.h)
  && r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0
  && r.x + r.w <= ART_W + 0.01 && r.y + r.h <= ART_H + 0.01;

export function validOverframeLayout(value: unknown): value is OverframeLayout {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["name","attribute","level","effect"].includes(k))) return false;
  for (const key of ["name","attribute","level"] as const) {
    const part = v[key];
    if (part === undefined) continue;
    if (!part || typeof part !== "object" || Array.isArray(part)) return false;
    const p = part as Record<string, unknown>;
    if (!finite(p.x) || !finite(p.y) || !finite(p.scale) ||
      p.x < 0 || p.x > ART_W || p.y < 0 || p.y > ART_H ||
      p.scale < .35 || p.scale > 2) return false;
  }
  if (v.effect !== undefined) {
    const part = v.effect;
    if (!part || typeof part !== "object" || Array.isArray(part)) return false;
    if (!within(part as OverlayRect)) return false;
  }
  return true;
}
export function validLayoutPresets(value: unknown): value is LayoutPreset[] {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 5) return false;
  const names = new Set<string>();
  for (const p of value) {
    if (!p || typeof p !== "object" || Array.isArray(p)) return false;
    if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 32 ||
      names.has(p.name) || !validOverframeLayout(p.layout)) return false;
    names.add(p.name);
  }
  return true;
}
export function updateLayoutPart(
  config: { layout?: OverframeLayout; effectTop: number; effectHeight: number },
  frame: Frame, level: number, part: OverlayPart, rect: OverlayRect,
): OverframeLayout {
  if (!within(rect)) throw Error("레이아웃 요소가 카드 바깥으로 벗어났습니다.");
  const base = defaultOverlayRects(frame, level, config.effectTop, config.effectHeight)[part];
  if (part === "effect") return { ...config.layout, effect: { ...rect } };
  const scale = rect.w / base.w;
  if (!Number.isFinite(scale) || scale < .35 || scale > 2) throw Error("크기 범위를 벗어났습니다.");
  return { ...config.layout, [part]: {
    x: rect.x, y: rect.y, scale: Math.round(scale * 10000) / 10000,
  } };
}
export function completeLayout(
  config: { layout?: OverframeLayout; effectTop: number; effectHeight: number },
  frame: Frame, level: number,
): OverframeLayout {
  const rects = overlayRects(config, frame, level);
  return (["name","attribute","level","effect"] as const).reduce((out, part) =>
    updateLayoutPart({ ...config, layout: out }, frame, level, part, rects[part]), {} as OverframeLayout);
}
export function clampOverlayRect(rect: OverlayRect): OverlayRect {
  const w = Math.max(24, Math.min(ART_W, rect.w));
  const h = Math.max(20, Math.min(ART_H, rect.h));
  return { x: Math.max(0, Math.min(ART_W - w, rect.x)),
    y: Math.max(0, Math.min(ART_H - h, rect.y)), w, h };
}
/** Snap center to art center and edges to the 36px safety margins. */
export function snapOverlayRect(rect: OverlayRect, enabled: boolean) {
  const r = clampOverlayRect(rect);
  if (!enabled) return { rect: r, guides: [] as ("x" | "y")[] };
  const threshold = 10;
  const targetsX = [36, ART_W / 2 - r.w / 2, ART_W - 36 - r.w];
  const targetsY = [36, ART_H / 2 - r.h / 2, ART_H - 36 - r.h];
  const near = (n: number, values: number[]) => values.find(v => Math.abs(n - v) <= threshold);
  const x = near(r.x, targetsX), y = near(r.y, targetsY);
  return { rect: clampOverlayRect({ ...r, x: x ?? r.x, y: y ?? r.y }),
    guides: [...(x !== undefined ? ["x" as const] : []), ...(y !== undefined ? ["y" as const] : [])] };
}
export function builtInLayout(name: "기본" | "중앙형" | "상단 여백형",
  frame: Frame, level: number, effectTop: number, effectHeight: number): OverframeLayout {
  const d = defaultOverlayRects(frame, level, effectTop, effectHeight);
  const effect = name === "중앙형" ? { x: 58, y: 970, w: 784, h: 200 }
    : name === "상단 여백형" ? { x: 54, y: 1010, w: 792, h: 160 } : d.effect;
  const nameRect = name === "상단 여백형" ? { ...d.name, x: 40, y: 42 } : d.name;
  const attrRect = name === "중앙형" ? { ...d.attribute, x: 804, y: 95 } : d.attribute;
  const raw = { layout: undefined, effectTop, effectHeight };
  return (["name","attribute","level","effect"] as const).reduce((out, part) =>
    updateLayoutPart({ ...raw, layout: out }, frame, level, part,
      part === "effect" ? effect : part === "name" ? nameRect : part === "attribute" ? attrRect : d[part]),
    {} as OverframeLayout);
}
