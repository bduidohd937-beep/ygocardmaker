/** 3:4 overframe effect-panel chrome. Geometry and typography remain in 900×1200 coordinates. */
import type { Frame } from "./model";
import type { OverlayRect } from "./overframeLayout";
import { assetFont } from "./assetPack";

export type EffectPanelStyle = "glass" | "classic" | "outline" | "ocg";
export type PanelTint = "auto" | "charcoal" | "violet" | "silver" | "azure" | "sepia";
export type PanelBorder = "none" | "single" | "double";

export interface EffectPanelSettings {
  effectStyle: EffectPanelStyle;
  effectOpacity: number;
  showEffectText: boolean;
  panelTint?: PanelTint;
  panelBorder?: PanelBorder;
  borderThickness?: number;
  panelTexture?: number;
  showTypeLine?: boolean;
  showStats?: boolean;
  statsFontSize?: number;
}
export interface EffectPanelContent {
  effect: string;
  frame: Frame;
  race?: string;
  atk?: string;
  def?: string;
  level?: number;
}
const TINTS: Record<Exclude<PanelTint, "auto">, { edge: string; top: string; label: string }> = {
  charcoal: { edge: "#666173", top: "#26232d", label: "#312b36" },
  violet: { edge: "#896792", top: "#36253f", label: "#38273b" },
  silver: { edge: "#9499a5", top: "#38414a", label: "#303740" },
  azure: { edge: "#5a819c", top: "#253d55", label: "#283e4e" },
  sepia: { edge: "#998268", top: "#453525", label: "#463626" },
};
const AUTO_TINT: Record<Frame, Exclude<PanelTint, "auto">> = {
  effect:"sepia", normal:"sepia", token:"sepia", ritual:"azure",
  fusion:"violet", synchro:"silver", xyz:"charcoal", link:"azure",
  spell:"azure", trap:"violet",
};
const KIND: Partial<Record<Frame,string>> = {
  ritual:"의식", fusion:"융합", synchro:"싱크로", xyz:"엑시즈", link:"링크",
};
const validNumber = (x: unknown, min: number, max: number) =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;

export function validEffectPanelSettings(c: Record<string,unknown>): boolean {
  return ["glass","classic","outline","ocg"].includes(String(c.effectStyle)) &&
    validNumber(c.effectOpacity, 0, 100) &&
    (c.panelTint === undefined || ["auto","charcoal","violet","silver","azure","sepia"].includes(String(c.panelTint))) &&
    (c.panelBorder === undefined || ["none","single","double"].includes(String(c.panelBorder))) &&
    (c.borderThickness === undefined || validNumber(c.borderThickness, 1, 6)) &&
    (c.panelTexture === undefined || validNumber(c.panelTexture, 0, 100)) &&
    (c.showTypeLine === undefined || typeof c.showTypeLine === "boolean") &&
    (c.showStats === undefined || typeof c.showStats === "boolean") &&
    (c.statsFontSize === undefined || validNumber(c.statsFontSize, 14, 32));
}

export function supportsStats(frame: Frame) { return frame !== "spell" && frame !== "trap"; }
export function panelTypeLabel(frame: Frame, race = "") {
  if (frame === "spell") return "[마법 카드]";
  if (frame === "trap") return "[함정 카드]";
  const descriptors = [race || "몬스터", KIND[frame], frame === "normal" ? "일반" :
    frame === "token" ? "토큰" : "효과"].filter(Boolean);
  return "[" + descriptors.join("／") + "]";
}
export function statLabel(content: EffectPanelContent) {
  if (!supportsStats(content.frame)) return "";
  const atk = /^[0-9]{1,6}$|^\?$/.test(content.atk ?? "") ? content.atk : "?";
  if (content.frame === "link") return `ATK / ${atk}    LINK-${content.level ?? 1}`;
  const def = /^[0-9]{1,6}$|^\?$/.test(content.def ?? "") ? content.def : "?";
  return `ATK / ${atk}    DEF / ${def}`;
}
export function panelFontRequirements(settings: EffectPanelSettings, frame: Frame): string[] {
  const keys: string[] = [];
  if (settings.showEffectText || (settings.showStats && supportsStats(frame))) keys.push("font:body");
  if (settings.showTypeLine) keys.push("font:type");
  return [...new Set(keys)];
}

const hexRgb = (hex: string) => {
  const digits = hex.replace("#","");
  return [0,2,4].map(i => parseInt(digits.slice(i,i+2),16));
};
const rgba = (hex: string, alpha: number) => {
  const [r,g,b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,alpha))})`;
};
function rounded(ctx: CanvasRenderingContext2D, r: OverlayRect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}
function textLines(ctx: CanvasRenderingContext2D, effect: string, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of effect.split("\n")) {
    let current = "";
    for (const char of paragraph) {
      if (current && ctx.measureText(current + char).width > maxWidth) {
        lines.push(current);
        current = char;
      } else current += char;
    }
    lines.push(current);
  }
  return lines;
}
export function effectPanelTextArea(
  rect: OverlayRect, settings: EffectPanelSettings, content: EffectPanelContent,
) {
  const inset = Math.max(9, Math.min(22, rect.w * .026));
  const header = settings.showTypeLine ? 37 : 0;
  const footer = settings.showStats && supportsStats(content.frame) ? 43 : 0;
  return {
    x: rect.x + inset,
    y: rect.y + 11 + header,
    w: Math.max(1, rect.w - 2 * inset),
    h: Math.max(0, rect.h - 20 - header - footer),
  };
}
/** Draw without mutating canvas global styles; the outer renderer owns scaling. */
export function paintEffectPanel(
  ctx: CanvasRenderingContext2D,
  rect: OverlayRect,
  settings: EffectPanelSettings,
  content: EffectPanelContent,
) {
  if (rect.w <= 0 || rect.h <= 0) throw Error("효과창 크기가 올바르지 않습니다.");
  const style = settings.effectStyle;
  const tint = TINTS[(settings.panelTint && settings.panelTint !== "auto"
    ? settings.panelTint : AUTO_TINT[content.frame])];
  const alpha = settings.effectOpacity / 100;
  const borderMode = settings.panelBorder ?? (style === "ocg" ? "double" : "single");
  const thick = settings.borderThickness ?? (style === "ocg" ? 2 : 1.5);
  const radius = style === "ocg" ? 5 : 13;
  const x=rect.x,y=rect.y,w=rect.w,h=rect.h;
  ctx.save();
  try {
    if (style !== "outline") {
      rounded(ctx,rect,radius);
      ctx.save();
      ctx.clip();
      if (style === "ocg") {
        const fade = ctx.createLinearGradient(x,y,x,y+h);
        fade.addColorStop(0,rgba("#fbf6e9",alpha));
        fade.addColorStop(.5,rgba("#e8dfd5",alpha));
        fade.addColorStop(1,rgba("#d6c9bd",alpha));
        ctx.fillStyle = fade;
      } else ctx.fillStyle = style === "classic"
        ? rgba("#f5ede2",alpha) : rgba("#0c0d1d",alpha);
      ctx.fillRect(x,y,w,h);
      // A quiet etched-paper grain, not artificial glows or striped ornaments.
      if (style === "ocg" && (settings.panelTexture ?? 22) > 0) {
        ctx.strokeStyle = rgba(tint.edge, Math.min(.13,(settings.panelTexture ?? 22) / 650));
        ctx.lineWidth = .55;
        const step = 8;
        for (let i=0;i<Math.ceil(h/step);i++) {
          ctx.beginPath();
          const yy = y + 4 + i * step;
          ctx.moveTo(x + 7,yy);
          ctx.lineTo(x + w - 7,yy);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (borderMode !== "none") {
      rounded(ctx,rect,radius);
      ctx.strokeStyle = style === "classic" ? "#72533f" : style === "glass" ? "#d5c5e9" : tint.edge;
      ctx.lineWidth = thick;
      ctx.stroke();
      if (borderMode === "double" && w > 48 && h > 48) {
        const inner = {x:x+6,y:y+6,w:w-12,h:h-12};
        rounded(ctx,inner,Math.max(2,radius-1));
        ctx.strokeStyle = style === "ocg" ? rgba(tint.edge,.5) : rgba("#c1b2c5",.6);
        ctx.lineWidth = Math.max(.7,thick*.65);
        ctx.stroke();
      }
    }
    const darkText = style === "classic" || style === "ocg";
    const ink = darkText ? "#241d22" : "#f5f0ff";
    const inner = effectPanelTextArea(rect,settings,content);
    if (settings.showTypeLine) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x+12,y+9,w-24,Math.min(31,h-14));
      ctx.clip();
      ctx.textAlign="left";
      ctx.textBaseline="middle";
      const line=panelTypeLabel(content.frame,content.race);
      let font=23;
      do {
        ctx.font=`600 ${font}px ${assetFont("type")}`;
        if(ctx.measureText(line).width<=w-34) break;
        font--;
      } while(font>12);
      ctx.fillStyle=ink;
      ctx.fillText(line,x+17,y+26,w-34);
      ctx.restore();
      ctx.strokeStyle=rgba(tint.edge,.45);
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(x+16,y+38);
      ctx.lineTo(x+w-16,y+38);
      ctx.stroke();
    }
    if (settings.showEffectText && content.effect.trim()) {
      if (inner.h < 19) throw Error("효과창 공간이 부족합니다. 크기나 항목 표시를 조절하세요.");
      let size=Math.max(14,Math.min(29,Math.floor(inner.h/3.6)));
      let lines:string[]=[];
      while (size >= 12) {
        ctx.font=`400 ${size}px ${assetFont("body")}`;
        lines=textLines(ctx,content.effect,inner.w);
        if(lines.length*size*1.29<=inner.h) break;
        size--;
      }
      if(size<12 || lines.length*size*1.29>inner.h) {
        throw Error("효과문이 효과창을 초과합니다. 효과창을 키우거나 텍스트를 줄여 주세요.");
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(inner.x,inner.y,inner.w,inner.h);
      ctx.clip();
      ctx.textAlign="left";
      ctx.textBaseline="top";
      ctx.fillStyle=ink;
      lines.forEach((line,i)=>ctx.fillText(line,inner.x,inner.y+i*size*1.29));
      ctx.restore();
    }
    if (settings.showStats && supportsStats(content.frame)) {
      const line=statLabel(content);
      const fontSize=settings.statsFontSize ?? 20;
      ctx.save();
      ctx.strokeStyle=rgba(tint.edge,.72);
      ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.moveTo(x+16,y+h-45);
      ctx.lineTo(x+w-16,y+h-45);
      ctx.stroke();
      ctx.font=`600 ${fontSize}px ${assetFont("body")}`;
      ctx.textAlign="right";
      ctx.textBaseline="middle";
      ctx.fillStyle=ink;
      ctx.fillText(line,x+w-18,y+h-24,w-36);
      ctx.restore();
    }
  } finally { ctx.restore(); }
}
