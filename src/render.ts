import { isMonster, FRAMES, type Card } from "./model";
export const WIDTH = 842,
  HEIGHT = 1228;
const COLORS = {
  normal: "#cba46a",
  effect: "#bd8654",
  fusion: "#9570ad",
  ritual: "#6a9dad",
  synchro: "#d5d9d5",
  xyz: "#353a42",
  link: "#477caa",
  spell: "#46978a",
  trap: "#b56c93",
};
const FONT = '"Noto Sans KR Variable", sans-serif';
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const result: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of Array.from(para)) {
      if (line && ctx.measureText(line + ch).width > width) {
        result.push(line.trimEnd());
        line = ch.trimStart();
      } else line += ch;
    }
    result.push(line);
  }
  return result;
}
function textBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  max = 25,
) {
  let size = max,
    lines: string[] = [];
  for (; size >= 16; size--) {
    ctx.font = `400 ${size}px ${FONT}`;
    lines = wrapText(ctx, text, w);
    if (lines.length * size * 1.44 <= h) break;
  }
  if (size < 16)
    throw Error(
      "효과 텍스트가 너무 깁니다. 내용을 줄이거나 줄바꿈을 조정해 주세요.",
    );
  ctx.textBaseline = "top";
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.44));
  return size;
}
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error("일러스트를 읽을 수 없습니다."));
    img.src = src;
  });
}
export async function renderCard(
  card: Card,
  canvas: HTMLCanvasElement,
  width = WIDTH,
): Promise<{ fontSize: number }> {
  const glyphs =
    card.name +
    card.effect +
    card.pendulumEffect +
    card.race +
    card.attribute +
    "【효과】ATK DEF LINK ★風闇光地水火神魔罠";
  await Promise.all([
    document.fonts.load(`400 25px ${FONT}`, glyphs),
    document.fonts.load(`600 43px ${FONT}`, glyphs),
  ]);
  await document.fonts.ready;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("Canvas를 사용할 수 없습니다.");
  canvas.width = width;
  canvas.height = Math.round((width * HEIGHT) / WIDTH);
  ctx.scale(width / WIDTH, width / WIDTH);
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke?: string,
  ) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
    }
  };
  rect(0, 0, WIDTH, HEIGHT, "#33312c");
  rect(13, 13, 816, 1202, "#c8bb9c");
  rect(23, 23, 796, 1182, "#544b3b");
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, COLORS[card.frame] || COLORS.effect);
  grad.addColorStop(0.5, card.frame === "xyz" ? "#11171b" : COLORS[card.frame]);
  grad.addColorStop(1, card.pendulum ? "#3b8f7a" : COLORS[card.frame]);
  rect(30, 30, 782, 1168, grad as unknown as string);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  for (let i = -1200; i < 1200; i += 13) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 1200, 1228);
    ctx.stroke();
  }
  ctx.restore();
  rect(51, 57, 739, 100, "#ffffff16", "#ffffff45");
  rect(59, 65, 723, 84, "#0000000d");
  const light = card.frame === "xyz" || card.frame === "link";
  ctx.fillStyle = light ? "#fff7de" : "#17241f";
  ctx.textBaseline = "middle";
  let titleSize = 43;
  do {
    ctx.font = `600 ${titleSize}px ${FONT}`;
    if (ctx.measureText(card.name).width < 626) break;
    titleSize--;
  } while (titleSize > 18);
  ctx.fillText(card.name, 76, 105);
  const attr =
    card.frame === "spell"
      ? "魔"
      : card.frame === "trap"
        ? "罠"
        : (
            {
              어둠: "闇",
              빛: "光",
              땅: "地",
              물: "水",
              불: "火",
              바람: "風",
              신: "神",
            } as Record<string, string>
          )[card.attribute] || "風";
  ctx.beginPath();
  ctx.arc(741, 106, 31, 0, Math.PI * 2);
  ctx.fillStyle =
    card.frame === "trap"
      ? "#793252"
      : card.frame === "spell"
        ? "#165d53"
        : card.attribute === "바람"
          ? "#386d55"
          : card.attribute === "물"
            ? "#296182"
            : "#716449";
  ctx.fill();
  ctx.strokeStyle = "#e5dcc0";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `500 34px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff9e5";
  ctx.fillText(attr, 741, 106);
  ctx.textAlign = "left";
  ctx.font = `600 25px ${FONT}`;
  ctx.fillStyle = light ? "#f5ebd1" : "#1f302c";
  if (!isMonster(card)) {
    ctx.textAlign = "right";
    ctx.fillText(
      `【${card.subtype === "일반" ? "" : card.subtype + " "}${FRAMES[card.frame]} 카드】`,
      768,
      192,
    );
    ctx.textAlign = "left";
  } else if (card.frame === "link") {
    ctx.textAlign = "right";
    ctx.fillText(`LINK — ${card.level}`, 767, 192);
    ctx.textAlign = "left";
  } else {
    for (let n = 0; n < card.level; n++) {
      const x = card.frame === "xyz" ? 89 + n * 48 : 752 - n * 48;
      ctx.beginPath();
      ctx.arc(x, 190, 19, 0, Math.PI * 2);
      ctx.fillStyle = card.frame === "xyz" ? "#1b1b19" : "#be522b";
      ctx.fill();
      ctx.strokeStyle = "#f3ca66";
      ctx.stroke();
      ctx.font = `24px ${FONT}`;
      ctx.fillStyle = "#ffdf87";
      ctx.textAlign = "center";
      ctx.fillText("★", x, 191);
    }
    ctx.textAlign = "left";
  }
  const art = { x: 78, y: 233, w: 686, h: card.pendulum ? 539 : 625 };
  rect(70, 225, 702, art.h + 16, "#333c39", "#d8ceb1");
  rect(art.x, art.y, art.w, art.h, "#182e36");
  if (card.artwork) {
    const img = await loadImage(card.artwork);
    const ratio = Math.max(art.w / img.width, art.h / img.height) * card.zoom;
    const dw = img.width * ratio,
      dh = img.height * ratio;
    const dx = art.x - ((dw - art.w) * (card.offsetX + 100)) / 200,
      dy = art.y - ((dh - art.h) * (card.offsetY + 100)) / 200;
    ctx.save();
    ctx.beginPath();
    ctx.rect(art.x, art.y, art.w, art.h);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.textAlign = "center";
    ctx.font = `28px ${FONT}`;
    ctx.fillStyle = "#81a2aa";
    ctx.fillText("YOUR ARTWORK", 421, 490);
    ctx.font = `18px ${FONT}`;
    ctx.fillText("일러스트를 업로드해 주세요", 421, 530);
    ctx.textAlign = "left";
  }
  if (card.frame === "link") {
    const points: [[number, number], number][] = [
      [[78, 233], 64],
      [[421, 233], 128],
      [[764, 233], 256],
      [[78, 545], 8],
      [[764, 545], 32],
      [[78, 858], 1],
      [[421, 858], 2],
      [[764, 858], 4],
    ];
    for (const [p, bit] of points) {
      ctx.save();
      ctx.translate(...p);
      ctx.rotate(Math.atan2(p[1] - 545, p[0] - 421));
      ctx.beginPath();
      ctx.moveTo(23, 0);
      ctx.lineTo(-15, -16);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-15, 16);
      ctx.closePath();
      ctx.fillStyle = card.arrows.includes(bit) ? "#ef7857" : "#283339";
      ctx.fill();
      ctx.strokeStyle = "#b7b8ad";
      ctx.stroke();
      ctx.restore();
    }
  }
  if (card.pendulum) {
    rect(70, 785, 702, 104, "#e4ead7", "#647b68");
    ctx.fillStyle = "#1f3e44";
    ctx.font = `700 38px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(String(card.scaleLeft), 104, 831);
    ctx.fillStyle = "#844b48";
    ctx.fillText(String(card.scaleRight), 737, 831);
    ctx.textAlign = "left";
    ctx.fillStyle = "#263d37";
    textBlock(ctx, card.pendulumEffect, 140, 799, 560, 77, 21);
  }
  const ey = card.pendulum ? 906 : 886;
  rect(58, ey, 726, 274 - (ey - 886), "#f3eddb", "#7b7057");
  ctx.fillStyle = "#26342e";
  ctx.textBaseline = "top";
  ctx.font = `600 24px ${FONT}`;
  const kind = isMonster(card)
    ? `${card.race} / ${FRAMES[card.frame]}${card.pendulum ? " / 펜듈럼" : ""}`
    : `${card.subtype} ${FRAMES[card.frame]}`;
  ctx.fillText(`【${kind}】`, 76, ey + 14);
  const size = textBlock(
    ctx,
    card.effect,
    78,
    ey + 52,
    686,
    isMonster(card) ? 166 - (ey - 886) : 207 - (ey - 886),
  );
  if (isMonster(card)) {
    ctx.strokeStyle = "#7d7866";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(77, 1118);
    ctx.lineTo(765, 1118);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.font = `600 27px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(
      `ATK / ${card.atk}     ${card.frame === "link" ? "LINK / " + card.level : "DEF / " + card.def}`,
      762,
      1140,
    );
    ctx.textAlign = "left";
  }
  ctx.font = `500 17px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = light ? "#ece4d2" : "#253830";
  ctx.fillText(String(card.id), 60, 1180);
  ctx.textAlign = "right";
  ctx.font = `12px ${FONT}`;
  ctx.fillText("DUELMIND  /  CUSTOM CARD", 778, 1180);
  ctx.textAlign = "left";
  return { fontSize: size };
}
export function toBlob(
  canvas: HTMLCanvasElement,
  format: "png" | "jpg",
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("이미지 생성 실패"))),
      format === "png" ? "image/png" : "image/jpeg",
      0.96,
    ),
  );
}
