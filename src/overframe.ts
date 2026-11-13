/** Overframe geometry is expressed in the shared 842×1228 card space. */
export interface OverframeLayer {
  enabled: boolean;
  image: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  /** Alpha PNG mask: white/opaque reveals, transparent hides the foreground. */
  mask?: string;
  /** "inside" is a non-destructive before/after comparison, clipped to the art. */
  depth?: "front" | "inside";
}

export const DEFAULT_OVERFRAME: OverframeLayer = {
  enabled: false, image: "", x: 0, y: 0, scale: 1, rotation: 0,
  depth: "front",
};
const pngData = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value)
  && value.length < maxLength;

export function validOverframe(value: unknown): value is OverframeLayer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return typeof r.enabled === "boolean" &&
    (r.image === "" || pngData(r.image, 16_000_000)) &&
    (!r.enabled || (typeof r.image === "string" && r.image !== "")) &&
    (r.mask === undefined || pngData(r.mask, 4_000_000)) &&
    (r.depth === undefined || r.depth === "front" || r.depth === "inside") &&
    typeof r.x === "number" && Number.isFinite(r.x) && Math.abs(r.x) <= 350 &&
    typeof r.y === "number" && Number.isFinite(r.y) && Math.abs(r.y) <= 400 &&
    typeof r.scale === "number" && Number.isFinite(r.scale) && r.scale >= 0.25 && r.scale <= 3 &&
    typeof r.rotation === "number" && Number.isFinite(r.rotation) && Math.abs(r.rotation) <= 45;
}

/** Front protects header / ranks / effect zone. Inside clips the image to its frame. */
export function overframeClip(pendulum: boolean, depth: "front" | "inside" = "front", assetPack = false) {
  if (depth === "inside") {
    if (assetPack) return pendulum
      ? { x: 94 * 842 / 1394, y: 364 * 1228 / 2031, w: 1205 * 842 / 1394, h: 1205 * 1228 / 2031 }
      : { x: 170 * 842 / 1394, y: 375 * 1228 / 2031, w: 1054 * 842 / 1394, h: 1054 * 1228 / 2031 };
    return { x: 78, y: 233, w: 686, h: pendulum ? 539 : 625 };
  }
  const top = 210, bottom = pendulum ? 784 : 883;
  return { x: 25, y: top, w: 792, h: bottom - top };
}

export function overframePlacement(imageWidth: number, imageHeight: number, layer: OverframeLayer) {
  if (!(imageWidth > 0 && imageHeight > 0)) throw Error("돌출 이미지 크기가 올바르지 않습니다.");
  const w = 640 * layer.scale, h = w * imageHeight / imageWidth;
  return { centerX: 421 + layer.x, centerY: 545 + layer.y, w, h,
    angle: layer.rotation * Math.PI / 180 };
}

/** Convert a logical card pointer coordinate to normalized source-PNG space. */
export function cardToOverframeImage(
  cardX: number, cardY: number, imageWidth: number, imageHeight: number,
  layer: OverframeLayer,
) {
  const p = overframePlacement(imageWidth, imageHeight, layer);
  const dx = cardX - p.centerX, dy = cardY - p.centerY;
  const c = Math.cos(p.angle), s = Math.sin(p.angle);
  return { x: (c * dx + s * dy) / p.w + 0.5,
    y: (-s * dx + c * dy) / p.h + 0.5 };
}
