import { FRAMES, isMonster, type Card } from "./model";
import { assetUrl } from "./assetPack";

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
  name: { x: 116, y: 90, maxW: 1033 },
  effect: { x: 109, y: 1526, maxW: 1175 },
  stats: { y: 1844 },
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

function fitText(
  ctx: CanvasRenderingContext2D, text: string,
  x: number, y: number, width: number, height: number,
  fontSize: number, minSize = 29,
): number {
  let size = fontSize, lines: string[] = [];
  for (; size >= minSize; size--) {
    ctx.font = "400 " + size + "px " + FONT;
    lines = wrap(ctx, text, width);
    if (lines.length * size * 1.19 <= height) break;
  }
  if (size < minSize)
    throw Error("프레임 효과 영역에 들어가지 않는 긴 효과문입니다. 내용을 줄이거나 줄바꿈을 조정해 주세요.");
  ctx.fillStyle = "#111915";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * size * 1.19));
  return size;
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
    ctx.strokeStyle = "#b5b6ac";
    ctx.lineWidth = 5;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
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
  let size = 106;
  while (size > 41) {
    ctx.font = "600 " + size + "px " + FONT;
    if (ctx.measureText(card.name).width <= maxW) break;
    size--;
  }
  ctx.fillText(card.name, ASSET_LAYOUT.name.x, ASSET_LAYOUT.name.y);
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

async function drawSpellTrapSubtype(ctx: CanvasRenderingContext2D, card: Card) {
  const subtype = TYPE_CODES[card.subtype];
  const icon = subtype ? assetUrl("spell_trap_icon:" + subtype) : null;
  const bracket = "]";
  const title = "[" + FRAMES[card.frame] + " 카드";
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "600 84px " + FONT;
  ctx.fillStyle = "#fafafa";
  ctx.translate(0, 253);
  ctx.scale(1, .75);
  const bracketWidth = ctx.measureText(bracket).width;
  const titleWidth = ctx.measureText(title).width;
  const right = NATIVE_W - 142;
  const iconWidth = icon ? 72 : 0;
  const gap = icon ? 24 : 0;
  let start = right - bracketWidth - iconWidth - gap - titleWidth;
  // Do not overlap the level / left edge even for unexpectedly long localizations.
  start = Math.max(550, start);
  ctx.fillText(title, start, 0);
  ctx.fillText(bracket, right - bracketWidth, 0);
  ctx.restore();
  if (icon) {
    const img = await image(icon);
    ctx.drawImage(img, right - bracketWidth - 12 - 72, 259, 72, 72);
  }
}

function drawMonsterKind(ctx: CanvasRenderingContext2D, card: Card) {
  const labels: string[] = [card.race];
  if (card.frame === "normal") labels.push("일반");
  else {
    if (card.frame !== "effect") labels.push(FRAMES[card.frame]);
    if (card.pendulum) labels.push("펜듈럼");
    labels.push("효과");
  }
  ctx.font = "600 48px " + FONT;
  ctx.fillStyle = "#141915";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("[" + labels.join(" / ") + "]", ASSET_LAYOUT.effect.x, ASSET_LAYOUT.effect.y);
}

function drawStats(ctx: CanvasRenderingContext2D, card: Card) {
  ctx.fillStyle = "#171b17";
  ctx.textBaseline = "top";
  ctx.font = "600 52px " + FONT;
  ctx.textAlign = "right";
  ctx.fillText(card.atk, 1000, 1839);
  ctx.fillText(card.frame === "link" ? String(card.level) : card.def, 1280, 1839);
  ctx.font = "500 36px " + FONT;
  ctx.fillText("ATK /", 824, 1846);
  ctx.fillText(card.frame === "link" ? "LINK /" : "DEF /", 1124, 1846);
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
      ctx.fillText(String(card.scaleLeft), 145, 1370);
      ctx.fillText(String(card.scaleRight), 1249, 1370);
      fitText(ctx, card.pendulumEffect, 221, 1282, 950, 230, 36, 29);
    }
    let fontSize: number;
    if (isMonster(card)) {
      drawMonsterKind(ctx, card);
      fontSize = fitText(ctx, card.effect, 109, 1590, 1175, 252, 40, 29);
      drawStats(ctx, card);
    } else {
      // Spell/trap subtypes belong in the heading, not in the effect text box.
      fontSize = fitText(ctx, card.effect, 109, 1534, 1175, 385, 42, 29);
    }
    drawPassword(ctx, card);
    return { fontSize };
  } finally {
    ctx.restore();
  }
}
