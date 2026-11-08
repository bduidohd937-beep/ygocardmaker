/** Non-destructive artwork selection, expressed in proportions of the original image. */
export interface ArtworkCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ArtworkBounds { x: number; y: number; w: number; h: number }

export const FULL_CROP: ArtworkCrop = { x: 0, y: 0, w: 1, h: 1 };

export function validArtworkCrop(value: unknown): value is ArtworkCrop {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (![r.x, r.y, r.w, r.h].every(v => typeof v === "number" && Number.isFinite(v))) return false;
  const { x, y, w, h } = r as unknown as ArtworkCrop;
  return x >= 0 && y >= 0 && w >= 0.02 && h >= 0.02 &&
    w <= 1 && h <= 1 && x + w <= 1.00000001 && y + h <= 1.00000001;
}

export const clamp = (v: number, low: number, high: number) =>
  Math.min(Math.max(v, low), high);

export function normalizeCrop(input: ArtworkCrop): ArtworkCrop {
  const w = clamp(input.w, 0.02, 1);
  const h = clamp(input.h, 0.02, 1);
  return {
    x: clamp(input.x, 0, 1 - w),
    y: clamp(input.y, 0, 1 - h),
    w, h,
  };
}

/** Match the crop's actual pixel aspect to the output frame without stretching it. */
export function fitCropAspect(crop: ArtworkCrop, imageW: number, imageH: number, frameAspect: number): ArtworkCrop {
  const ratio = frameAspect * imageH / imageW;
  if (!(ratio > 0) || !Number.isFinite(ratio)) return crop;
  let { w, h } = crop;
  if (w / h > ratio) w = h * ratio;
  else h = w / ratio;
  const next = {
    x: crop.x + (crop.w - w) / 2,
    y: crop.y + (crop.h - h) / 2,
    w, h,
  };
  return normalizeCrop(next);
}

/** Exact legacy cover/zoom/offset behavior is retained when crop is absent. */
export function artworkPlacement(
  imageW: number, imageH: number, dest: ArtworkBounds,
  crop?: ArtworkCrop,
  zoom = 1, offsetX = 0, offsetY = 0,
) {
  const r = validArtworkCrop(crop) ? crop : FULL_CROP;
  const sx = r.x * imageW, sy = r.y * imageH;
  const sw = r.w * imageW, sh = r.h * imageH;
  const scale = Math.max(dest.w / sw, dest.h / sh) * zoom;
  const dw = sw * scale, dh = sh * scale;
  return {
    sx, sy, sw, sh,
    dx: dest.x - (dw - dest.w) * (offsetX + 100) / 200,
    dy: dest.y - (dh - dest.h) * (offsetY + 100) / 200,
    dw, dh,
  };
}
