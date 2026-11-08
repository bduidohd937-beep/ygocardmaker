import type { Card } from "./model";
import { FRAMES, isMonster } from "./model";
import { assetUrl } from "./assetPack";

const FONT = '"Noto Sans KR Variable", sans-serif';
const ATTR_NAME: Record<string, string> = {
  "어둠": "闇", "빛": "光", "땅": "地", "물": "水", "불": "火", "바람": "風", "신": "神",
};
const ATTR_CODE: Record<string, string> = {
  "어둠": "dark", "빛": "light", "땅": "earth", "물": "water",
  "불": "fire", "바람": "wind", "신": "divine",
};
const TYPE_CODE: Record<string, string> = {
  "지속": "continuous", "속공": "quick-play", "장착": "equip",
  "필드": "field", "의식": "ritual", "카운터": "counter",
};
const LINK_DIRECTIONS: [number, string, number, number, number, number][] = [
  [64, "left-up", 82, 220, 65, 65],
  [128, "up", 365, 211, 112, 40],
  [256, "right-up", 695, 220, 65, 65],
  [8, "left", 74, 490, 38, 107],
  [32, "right", 731, 490, 38, 107],
  [1, "left-down", 82, 817, 65, 65],
  [2, "down", 365, 848, 112, 40],
  [4, "right-down", 695, 817, 65, 65],
];

async function load(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}
async function draw(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number) {
  const url = assetUrl(key);
  if (!url) return false;
  ctx.drawImage(await load(url), x, y, w, h);
  return true;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of Array.from(para)) {
      if (line && ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line.trimEnd());
        line = ch.trimStart();
      } else line += ch;
    }
    lines.push(line);
  }
  return lines;
}
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, maxSize = 27) {
  let size = maxSize, lines: string[] = [];
  for (; size >= 16; size--) {
    ctx.font = "400 " + size + "px " + FONT;
    lines = wrap(ctx, text, width);
    if (lines.length * size * 1.35 <= height) break;
  }
  if (size < 16) throw Error("효과 텍스트가 너무 깁니다. 줄바꿈을 조정해 주세요.");
  ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x, y + i * size * 1.35);
  return size;
}
export function frameKey(card: Card): string {
  return "frame:" + card.frame + (card.pendulum ? "-pendulum" : "");
}

/** Alternative rendering path for a user-imported, local-only asset pack.
 * Coordinates are an initial 842x1228 alignment and require visual QA per frame.
 * The public default renderer is unchanged until a local pack is imported.
 */
export async function renderWithAssetPack(card: Card, ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 842, 1228);
  const frame = await draw(ctx, frameKey(card), 0, 0, 842, 1228);
  if (!frame) throw Error("이 카드 종류의 프레임이 리소스 ZIP에 없습니다.");

  const box = { x: 101, y: card.pendulum ? 235 : 237, w: 640, h: card.pendulum ? 518 : 617 };
  if (card.artwork) {
    const img = await load(card.artwork);
    const scale = Math.max(box.w / img.width, box.h / img.height) * card.zoom;
    const w = img.width * scale, h = img.height * scale;
    const x = box.x - (w - box.w) * (card.offsetX + 100) / 200;
    const y = box.y - (h - box.h) * (card.offsetY + 100) / 200;
    ctx.save();
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#edf1ea"; ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.textAlign = "center"; ctx.font = "22px " + FONT; ctx.fillStyle = "#62756e";
    ctx.fillText("일러스트를 업로드해 주세요", 421, box.y + box.h / 2);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = card.frame === "xyz" || card.frame === "link" ? "#f4eddb" : "#171817";
  let nameSize = 46;
  while (nameSize > 19) {
    ctx.font = "600 " + nameSize + "px " + FONT;
    if (ctx.measureText(card.name).width <= 604) break;
    nameSize--;
  }
  ctx.fillText(card.name, 80, 105);

  const attrKey = card.frame === "spell" || card.frame === "trap"
    ? card.frame : (ATTR_CODE[card.attribute] ?? "dark");
  const hasAttribute = await draw(ctx, "attribute:" + attrKey, 701, 70, 71, 71);
  if (!hasAttribute) {
    ctx.fillStyle = "#233"; ctx.textAlign = "center";
    ctx.font = "600 35px " + FONT;
    ctx.fillText(card.frame === "spell" ? "魔" : card.frame === "trap" ? "罠" : (ATTR_NAME[card.attribute] ?? "闇"), 736, 105);
    ctx.textAlign = "left";
  }

  if (isMonster(card) && card.frame !== "link") {
    const starKey = "star:" + (card.frame === "xyz" ? "rank" : "level");
    const star = assetUrl(starKey);
    for (let i = 0; i < card.level; i++) {
      const x = card.frame === "xyz" ? 88 + i * 47 : 718 - i * 47;
      if (star) ctx.drawImage(await load(star), x, 167, 37, 37);
      else {
        ctx.fillStyle = "#af6033"; ctx.font = "32px " + FONT;
        ctx.fillText("★", x, 188);
      }
    }
  } else if (card.frame === "link") {
    for (const [bit, direction, x, y, w, h] of LINK_DIRECTIONS)
      await draw(ctx, "link_arrow:" + direction + ":" + (card.arrows.includes(bit) ? "on" : "off"), x, y, w, h);
  } else {
    ctx.fillStyle = card.frame === "spell" ? "#1b473e" : "#733653";
    ctx.textAlign = "right"; ctx.font = "600 24px " + FONT;
    ctx.fillText("【" + FRAMES[card.frame] + " 카드】", 747, 184);
    if (TYPE_CODE[card.subtype])
      await draw(ctx, "spell_trap_icon:" + TYPE_CODE[card.subtype], 667, 160, 38, 38);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#1b201c";
  if (card.pendulum) {
    ctx.textAlign = "center"; ctx.font = "600 36px " + FONT;
    ctx.fillText(String(card.scaleLeft), 107, 816);
    ctx.fillText(String(card.scaleRight), 735, 816);
    ctx.textAlign = "left";
    fitText(ctx, card.pendulumEffect, 160, 794, 526, 105, 21);
  }
  const effectY = card.pendulum ? 948 : 920;
  ctx.font = "600 21px " + FONT;
  const kind = isMonster(card)
    ? card.race + (card.frame === "normal" ? " / 일반" : " / 효과")
    : (card.subtype === "일반" ? "" : card.subtype + " ") + FRAMES[card.frame];
  ctx.textBaseline = "top"; ctx.fillText("【" + kind + "】", 88, effectY);
  const fontSize = fitText(ctx, card.effect, 87, effectY + 39, 668, isMonster(card) ? 141 : 198, 27);
  if (isMonster(card)) {
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.font = "600 24px " + FONT;
    ctx.fillText("ATK / " + card.atk + "   " + (card.frame === "link" ? "LINK / " + card.level : "DEF / " + card.def), 750, 1140);
  }
  ctx.textAlign = "left"; ctx.font = "500 15px " + FONT; ctx.fillStyle = "#222";
  ctx.fillText(String(card.id), 60, 1182);
  return { fontSize };
}
