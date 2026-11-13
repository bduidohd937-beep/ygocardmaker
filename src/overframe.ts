/** Optional foreground cutout composited over the artwork frame.
 * All geometry uses 842×1228 logical card coordinates for preview/export parity.
 * Keep the title/rank and effect panels unobscured by restricting the clip region.
 */
export interface OverframeLayer {
  enabled: boolean;
  image: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export const DEFAULT_OVERFRAME: OverframeLayer = {
  enabled: false,
  image: "",
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
};

export function validOverframe(value: unknown): value is OverframeLayer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  const validImage = typeof r.image === "string" &&
    (r.image === "" || (/^data:image\/png;base64,/.test(r.image) && r.image.length < 16_000_000));
  return typeof r.enabled === "boolean" &&
    validImage &&
    (!r.enabled || (typeof r.image === "string" && r.image !== "")) &&
    typeof r.x === "number" && Number.isFinite(r.x) && Math.abs(r.x) <= 350 &&
    typeof r.y === "number" && Number.isFinite(r.y) && Math.abs(r.y) <= 400 &&
    typeof r.scale === "number" && Number.isFinite(r.scale) && r.scale >= 0.25 && r.scale <= 3 &&
    typeof r.rotation === "number" && Number.isFinite(r.rotation) && Math.abs(r.rotation) <= 45;
}

/** The allowed layer occupies the art and its surrounding border, not the title or rules. */
export function overframeClip(pendulum: boolean) {
  const top = 210;
  const bottom = pendulum ? 784 : 883;
  return { x: 25, y: top, w: 792, h: bottom - top };
}

/** Returns centered placement before rotation. The PNG's transparent pixels are retained. */
export function overframePlacement(imageWidth: number, imageHeight: number, layer: OverframeLayer) {
  if (!(imageWidth > 0 && imageHeight > 0)) throw Error("돌출 이미지 크기가 올바르지 않습니다.");
  const w = 640 * layer.scale;
  const h = w * imageHeight / imageWidth;
  return { centerX: 421 + layer.x, centerY: 545 + layer.y, w, h,
    angle: layer.rotation * Math.PI / 180 };
}
