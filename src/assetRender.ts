import { isMonster, monsterKindLabels, type Card } from "./model";
import { assetFont, assetUrl, ensureAssetFonts } from "./assetPack";

const FONT = '"Noto Sans KR Variable", sans-serif';
const NATIVE_W = 1394;
const NATIVE_H = 2031;
const VIEW_W = 842;
const VIEW_H = 1228;
const loaded = new Map<string, Promise<HTMLImageElement>>();

export const ASSET_LAYOUT = {
  artwork: { x: 170, y: 375, w: 1054, h: 1054 },
  pendulumArtwork: { x: 94, y: 364, w: 1205, h: 1205 },
  artworkMask: { x: 117, y: 322 },
  pendulumArtworkMask: { x: 68, y: 342 },
  attribute: { x: 1163, y: 96, w: 128, h: 128 },
  level: { y: 247, size: 88, step: 92 },
  name: { x: 116, y: 90, maxW: 1033, opticalYOffset: 18 },
  effect: { x: 109, y: 1526, maxW: 1175 },
  stats: { y: 1844 },
  pendulumPanel: { x: 221, y: 1282, w: 950, h: 230 },
  pendulumScaleY: 1370,
} as const;

const ATTR_CODES: Record<string, string> = {
  "어둠": "dark", "빛": "light", "땅": "earth", "물": "water",
  "불": "fire", "바람": "wind", "신": "divine",
};
const TYPE_CODES: Record<string, string> = {
  "지속": "continuous", "속공": "quick-play", "장착": "equip",
  "필드": "field", "의식": "ritual", "카운터": "counter",
};
const LINK_GEOMETRY: ReadonlyArray<readonly [number, string, number, number]> = [
  [128, "up", 555, 278],
  [256, "right-up", 1130, 299],
  [32, "right", 1223, 761],
  [4, "right-down", 1130, 1336],
  [2, "down", 555, 1428],
  [1, "left-down", 95, 1336],
  [8, "left", 71, 758],
  [64, "left-up", 95, 299],
];
export const LINK_POSITIONS = LINK_GEOMETRY;

function image(src: string): Promise<HTMLImageElement> {
  const existing = loaded.get(src);
  if (existing) return existing;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error("이미지 로딩에 실패했습니다."));
    img.src = src;
  });
  loaded.set(src, pending);
  // Failed images can be re-imported without retaining a rejected promise.
  void pending.catch(() => loaded.delete(src));
  return pending;
}

async function paint(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number, y: number, w?: number, h?: number,
): Promise<boolean> {
  const src = assetUrl(key);
  if (!src) return false;
  const img = await image(src);
  ctx.drawImage(img, x, y, w ?? img.naturalWidth, h ?? img.naturalHeight);
  return true;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const glyph of Array.from(paragraph)) {
      if (line && ctx.measureText(line + glyph).width > maxW) {
        if (/[),.!?:;。，！？、）」』》】]/u.test(glyph)) {
          // Keep a closing punctuation mark with the preceding phrase.
          lines.push(line + glyph);
          line = "";
        } else {
          lines.push(line.trimEnd());
          line = glyph.trimStart();
        }
      } else line += glyph;
    }
    lines.push(line);
  }
  return lines;
}

/** Render the complete description. Never silently truncate card rules text.
 * Compact card text can use a smaller font, but overly dense cards still fail
 * with a useful diagnostic so that the editor cannot export incomplete effects.
 */
export function fitText(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, width: number, height: number,
  fontSize: number, minSize = 20,
): number {
  let lines: string[] = [];
  for (let size = fontSize; size >= minSize; size--) {
    ctx.font = "400 " + size + "px " + assetFont("body");
    lines = wrap(ctx, text, width);
    if (lines.length * size * 1.19 <= height) {
      ctx.fillStyle = "#111915";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      lines.forEach((line, index) =>
        ctx.fillText(line, x, y + index * size * 1.19));
      return size;
    }
  }
  throw Error(
    `효과문 ${text.length}자: 최소 글꼴 ${minSize}px로도 ${lines.length}줄이 필요합니다. ` +
    "현재 카드 효과창에 전부 들어가지 않습니다. 문장을 간결하게 정리하거나 줄바꿈을 조정해 주세요.",
  );
}

export function frameKey(card: Card): string {
  return "frame:" + card.frame + (card.pendulum ? "-pendulum" : "");
}

async function drawArtwork(ctx: CanvasRenderingContext2D, card: Card) {
  const b = card.pendulum ? ASSET_LAYOUT.pendulumArtwork : ASSET_LAYOUT.artwork;
  if (card.artwork) {
    const img = await image(card.artwork);
    const scale = Math.max(b.w / img.naturalWidth, b.h / img.naturalHeight) * card.zoom;
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const x = b.x - (w - b.w) * (card.offsetX + 100) / 200;
    const y = b.y - (h - b.h) * (card.offsetY + 100) / 200;
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#e2e7e2";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#5c6e66";
    ctx.font = "34px " + FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("일러스트를 업로드해 주세요", b.x + b.w / 2, b.y + b.h / 2);
  }
  const pos = card.pendulum ? ASSET_LAYOUT.pendulumArtworkMask : ASSET_LAYOUT.artworkMask;
  const mask = card.pendulum ? "mask:pendulum" : "mask:default";
  if (!(await paint(ctx, mask, pos.x, pos.y))) {
    if (card.pendulum) {
      // The imported 49-image pack predates the original pendulum mask.
      // Never draw the pendulum text directly over the artwork when it is absent.
      const shade = ctx.createLinearGradient(0, 1260, 0, 1568);
      shade.addColorStop(0, "rgba(205,232,222,0.97)");
      shade.addColorStop(1, "rgba(228,243,233,0.98)");
      ctx.fillStyle = shade;
      ctx.fillRect(94, 1262, 1205, 307);
      ctx.strokeStyle = "#61958d";
      ctx.lineWidth = 4;
      ctx.strokeRect(94, 1262, 1205, 307);
      const p = ASSET_LAYOUT.pendulumPanel;
      ctx.fillStyle = "rgba(245,249,239,0.97)";
      ctx.fillRect(p.x - 8, p.y - 7, p.w + 16, p.h + 14);
      ctx.strokeStyle = "#759c8b";
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x - 8, p.y - 7, p.w + 16, p.h + 14);
      // A separate light strip protects the monster type line below the
      // pendulum description until the original overlay PNG is imported.
      ctx.fillStyle = "rgba(245,243,234,0.98)";
      ctx.fillRect(109, 1519, 1175, 65);
    } else {
      ctx.strokeStyle = "#b5b6ac";
      ctx.lineWidth = 5;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
  }
}

async function drawAttribute(ctx: CanvasRenderingContext2D, card: Card) {
  const code = isMonster(card) ? ATTR_CODES[card.attribute] ?? "dark" : card.frame;
  await paint(ctx, "attribute:" + code, ASSET_LAYOUT.attribute.x,
    ASSET_LAYOUT.attribute.y, ASSET_LAYOUT.attribute.w, ASSET_LAYOUT.attribute.h);
}

function drawName(ctx: CanvasRenderingContext2D, card: Card) {
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = ["xyz", "link", "spell", "trap"].includes(card.frame) ? "#ffffff" : "#111915";
  const maxW = ASSET_LAYOUT.name.maxW;
  // Noto Sans KR is wider/heavier than the source's ygo-kr-name face.
  // Slightly reduce the optical size while keeping the original coordinates.
  const hasOriginalNameFont = Boolean(assetUrl("font:name"));
  const nameFont = assetFont("name");
  // The Noto fallback sits higher than the source font at identical top coordinates.
  // Move Korean card titles down slightly within the top nameplate; leave font size unchanged.
  const nameY = ASSET_LAYOUT.name.y + ASSET_LAYOUT.name.opticalYOffset + (hasOriginalNameFont ? 0 : 22);
  let size = hasOriginalNameFont ? 106 : 90;
  while (size > 41) {
    ctx.font = "600 " + size + "px " + nameFont;
    if (ctx.measureText(card.name).width <= maxW) break;
    size--;
  }
  ctx.fillText(card.name, ASSET_LAYOUT.name.x, nameY);
}

async function drawRanksAndArrows(ctx: CanvasRenderingContext2D, card: Card) {
  if (card.frame === "link") {
    for (const [bit, dir, x, y] of LINK_GEOMETRY)
      await paint(ctx, "link_arrow:" + dir + ":" + (card.arrows.includes(bit) ? "on" : "off"), x, y);
    return;
  }
  const key = card.frame === "xyz" ? "star:rank" : "star:level";
  const star = assetUrl(key) ? await image(assetUrl(key)!) : null;
  for (let i = 0; i < Math.min(card.level, 13); i++) {
    const x = card.frame === "xyz"
      ? (card.level < 13 ? 147 : 101) + i * ASSET_LAYOUT.level.step
      : NATIVE_W - (card.level < 13 ? 147 : 101) - ASSET_LAYOUT.level.size - i * ASSET_LAYOUT.level.step;
    if (star)
      ctx.drawImage(star, x, ASSET_LAYOUT.level.y, ASSET_LAYOUT.level.size, ASSET_LAYOUT.level.size);
  }
}

export function spellTrapHeadingPositions(
  leftTextWidth: number, rightBracketWidth: number, hasIcon: boolean,
) {
  const right = NATIVE_W - 142;
  const iconSize = hasIcon ? 72 : 0;
  const gap = hasIcon ? 12 : 0;
  const bracketX = right - rightBracketWidth;
  const iconX = bracketX - gap - iconSize;
  const textX = iconX - gap - leftTextWidth;
  return { textX, iconX, bracketX };
}

async function drawSpellTrapSubtype(ctx: CanvasRenderingContext2D, card: Card) {
  const subtype = TYPE_CODES[card.subtype];
  const icon = subtype ? assetUrl("spell_trap_icon:" + subtype) : null;
  const prefix = "[" + FRAMES[card.frame] + " 카드";
  const suffix = "]";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fafafa";
  // Korean source font is vertically compressed; here we use an equivalent
  // visual size instead of scaling the entire canvas (which displaced icons).
  ctx.font = "600 " + (assetUrl("font:type") ? 88 : 68) + "px " + assetFont("type");
  const leftWidth = ctx.measureText(prefix).width;
  const rightWidth = ctx.measureText(suffix).width;
  const p = spellTrapHeadingPositions(leftWidth, rightWidth, !!icon);
  ctx.fillText(prefix, p.textX, 253);
  if (icon) ctx.drawImage(await image(icon), p.iconX, 259, 72, 72);
  ctx.fillText(suffix, p.bracketX, 253);
}

function drawMonsterKind(ctx: CanvasRenderingContext2D, card: Card) {
  const line = "[" + monsterKindLabels(card).join(" / ") + "]";
  const fontFamily = assetFont("type");
  let size = assetUrl("font:type") ? 48 : 43;
  while (size > 29) {
    ctx.font = "600 " + size + "px " + fontFamily;
    if (ctx.measureText(line).width <= ASSET_LAYOUT.effect.maxW) break;
    size--;
  }
  ctx.fillStyle = "#141915";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(line, ASSET_LAYOUT.effect.x, ASSET_LAYOUT.effect.y, ASSET_LAYOUT.effect.maxW);
}

/**
 * Source atk-def.svg uses an origin of (109, 1844). Its printed labels begin
 * at native x ~= 739 (ATK) and x ~= 1030 (DEF), while the original number
 * right anchors are 999 and 1282. All four elements share one baseline.
 */
export const STAT_LAYOUT = {
  // Move both groups slightly right, retaining a safe margin inside the frame.
  atkLabelX: 751,
  atkValueRight: 1011,
  defLabelX: 1039,
  defValueRight: 1288,
  baseline: 1879,
  labelSize: 35,
  maxNumberSize: 50,
  minNumberSize: 27,
  gap: 14,
} as const;

/** The stat numbers should never grow just because they contain fewer digits.
 * Each length has an optical ceiling; long values can shrink further to fit.
 */
export function chooseStatNumberSize(
  content: string,
  available: number,
  measureAtSize: (size: number, content: string) => number,
): number {
  const length = [...content].length;
  const opticalCap = length <= 2 ? 40
    : length === 3 ? 45
    : length === 4 ? 50
    : length === 5 ? 45
    : length === 6 ? 40
    : 34;
  for (let size = Math.min(opticalCap, STAT_LAYOUT.maxNumberSize);
    size > STAT_LAYOUT.minNumberSize; size--) {
    if (measureAtSize(size, content) <= available) return size;
  }
  return STAT_LAYOUT.minNumberSize;
}

function drawStats(ctx: CanvasRenderingContext2D, card: Card) {
  ctx.save();
  try {
    ctx.fillStyle = "#171b17";
    ctx.textBaseline = "alphabetic";
    // Draw labels at the same baseline as the values, using source SVG anchors.
    // Measure each value so high ATK/DEF or "?" never overprints its label.
    const pair = (label: string, value: number | string, labelX: number, valueRight: number) => {
      ctx.font = "500 " + STAT_LAYOUT.labelSize + "px " + FONT;
      ctx.textAlign = "left";
      ctx.fillText(label, labelX, STAT_LAYOUT.baseline);
      const available = valueRight - labelX - ctx.measureText(label).width - STAT_LAYOUT.gap;
      const content = String(value);
      const size = chooseStatNumberSize(content, available, (candidate, text) => {
        ctx.font = "600 " + candidate + "px " + FONT;
        return ctx.measureText(text).width;
      });
      ctx.font = "600 " + size + "px " + FONT;
      ctx.textAlign = "right";
      // maxWidth prevents overflow even for unusually long custom ATK/DEF values.
      ctx.fillText(content, valueRight, STAT_LAYOUT.baseline, Math.max(1, available));
    };
    pair("ATK /", card.atk, STAT_LAYOUT.atkLabelX, STAT_LAYOUT.atkValueRight);
    pair(card.frame === "link" ? "LINK /" : "DEF /",
      card.frame === "link" ? card.arrows.length : card.def,
      STAT_LAYOUT.defLabelX, STAT_LAYOUT.defValueRight);
  } finally {
    ctx.restore();
  }
}

function drawPassword(ctx: CanvasRenderingContext2D, card: Card) {
  ctx.font = "400 30px " + FONT;
  ctx.fillStyle = card.frame === "xyz" ? "#eee" : "#1b201f";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(String(card.id), 66, 1932);
}

/** Native asset positions from kooriookami YugiohCard, scaled to the current canvas.
 * The default renderer is retained when no local asset pack is selected.
 */
export async function renderWithAssetPack(
  card: Card, ctx: CanvasRenderingContext2D,
): Promise<{ fontSize: number }> {
  ctx.save();
  try {
    await ensureAssetFonts();
    ctx.scale(VIEW_W / NATIVE_W, VIEW_H / NATIVE_H);
    if (!(await paint(ctx, frameKey(card), 0, 0, NATIVE_W, NATIVE_H)))
      throw Error("선택한 카드 종류의 프레임이 리소스 ZIP에 없습니다.");
    await drawArtwork(ctx, card);
    drawName(ctx, card);
    await drawAttribute(ctx, card);
    if (isMonster(card)) await drawRanksAndArrows(ctx, card);
    else await drawSpellTrapSubtype(ctx, card);

    if (card.pendulum) {
      ctx.fillStyle = "#1a201b";
      ctx.textAlign = "center";
      ctx.font = "600 90px " + FONT;
      ctx.textBaseline = "top";
      ctx.fillText(String(card.scaleLeft), 145, ASSET_LAYOUT.pendulumScaleY);
      ctx.fillText(String(card.scaleRight), 1249, ASSET_LAYOUT.pendulumScaleY);
      const panel = ASSET_LAYOUT.pendulumPanel;
      fitText(ctx, card.pendulumEffect, panel.x, panel.y, panel.w, panel.h, 36, 21);
    }
    let fontSize: number;
    if (isMonster(card)) {
      drawMonsterKind(ctx, card);
      fontSize = fitText(ctx, card.effect, 109, 1590, 1175, 252, 40, 20);
      drawStats(ctx, card);
    } else {
      // Spell/trap subtypes belong in the heading, not in the effect text box.
      fontSize = fitText(ctx, card.effect, 109, 1534, 1175, 385, 42, 20);
    }
    drawPassword(ctx, card);
    return { fontSize };
  } finally {
    ctx.restore();
  }
}
