/** Non-destructive static finish effects for 3:4 cards (900 x 1200 coordinates).
 * Never paints a replacement attribute, rank, font, monster, or frame.
 * Applies only to the illustration layer, before card text and effect panel.
 */
import type { Frame } from "./model";

export type FinishStyle = "none" | "xyz" | "fusion" | "synchro" | "link" | "prism";
export interface FinishPreset { name: string; style: Exclude<FinishStyle,"none">; strength: number }
export interface FinishSettings {
  finishEnabled?: boolean;
  finishStyle?: FinishStyle;
  finishStrength?: number;
  finishPresets?: FinishPreset[];
}
export const FINISH_STYLES: {value: FinishStyle; label: string}[] = [
  { value: "none", label: "연출 없음" },
  { value: "xyz", label: "엑시즈 · 흑요석" },
  { value: "fusion", label: "융합 · 자수정" },
  { value: "synchro", label: "싱크로 · 백은" },
  { value: "link", label: "링크 · 청록 회로광" },
  { value: "prism", label: "프리즘 · 은은한 홀로그램" },
];
export const DEFAULT_FINISH: Required<Pick<FinishSettings,"finishEnabled"|"finishStyle"|"finishStrength">> = {
  finishEnabled: false, finishStyle: "none", finishStrength: 28,
};
const VALID = new Set(FINISH_STYLES.map(x=>x.value));
const finite = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
function validPreset(p: unknown): p is FinishPreset {
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const o = p as Record<string,unknown>;
  return typeof o.name === "string" && o.name.trim().length > 0 &&
    o.name.length <= 32 && typeof o.style === "string" &&
    o.style !== "none" && VALID.has(o.style as FinishStyle) && finite(o.strength,0,100);
}
export function validFinishSettings(c: Record<string,unknown>): boolean {
  if (c.finishEnabled !== undefined && typeof c.finishEnabled !== "boolean") return false;
  if (c.finishStyle !== undefined && (typeof c.finishStyle !== "string" ||
      !VALID.has(c.finishStyle as FinishStyle))) return false;
  if (c.finishStrength !== undefined && !finite(c.finishStrength,0,100)) return false;
  if (c.finishPresets === undefined) return true;
  if (!Array.isArray(c.finishPresets) || c.finishPresets.length > 5) return false;
  const names = new Set<string>();
  for (const p of c.finishPresets) {
    if (!validPreset(p) || names.has(p.name)) return false;
    names.add(p.name);
  }
  return true;
}
export function recommendedFinish(frame: Frame): Exclude<FinishStyle,"none"> {
  return frame === "xyz" ? "xyz" : frame === "fusion" ? "fusion" :
    frame === "synchro" ? "synchro" : frame === "link" ? "link" : "prism";
}
export function applyFinishPreset(preset: FinishPreset): FinishSettings {
  return { finishEnabled: true, finishStyle: preset.style, finishStrength: preset.strength };
}
export const BUILT_IN_FINISH: FinishPreset[] = [
  { name: "흑요석", style: "xyz", strength: 30 },
  { name: "자수정", style: "fusion", strength: 32 },
  { name: "백은", style: "synchro", strength: 30 },
  { name: "청록 회로광", style: "link", strength: 26 },
  { name: "프리즘", style: "prism", strength: 22 },
];
type Palette = { light: string; mid: string; edge: string; shadow: string };
const PALETTES: Record<Exclude<FinishStyle,"none">, Palette> = {
  xyz: { light:"#b8b9e8",mid:"#6b65a8",edge:"#9c96d0",shadow:"#161525" },
  fusion: { light:"#edb5e9",mid:"#9e69b8",edge:"#c593ce",shadow:"#25162c" },
  synchro: { light:"#f3f3fc",mid:"#9db5d3",edge:"#ced9ea",shadow:"#1c252e" },
  link: { light:"#b3f4e8",mid:"#46b5c9",edge:"#7bd6df",shadow:"#172c35" },
  prism: { light:"#fff3cc",mid:"#c5ace6",edge:"#d9c7ee",shadow:"#242433" },
};
function rgba(hex: string, a: number) {
  const v=hex.slice(1);
  return `rgba(${parseInt(v.slice(0,2),16)},${parseInt(v.slice(2,4),16)},${parseInt(v.slice(4,6),16)},${Math.max(0,Math.min(.3,a))})`;
}
/** Static finish on source artwork; all labels and genuine OCG assets render afterward.
 * Strength <=100 limits every individual pass to <=0.15 opacity; no solid black header.
 */
export function paintFinish(ctx: CanvasRenderingContext2D, setting: FinishSettings) {
  const style=setting.finishStyle ?? "none";
  const power=(setting.finishStrength ?? DEFAULT_FINISH.finishStrength)/100;
  if (setting.finishEnabled !== true || style === "none" || power <= 0) return;
  const p=PALETTES[style];
  const W=900,H=1200;
  ctx.save();
  try {
    // Directional pearlescent reflection restricted to one narrow diagonal.
    const shine=ctx.createLinearGradient(-230,130,1000,1050);
    shine.addColorStop(0,"rgba(255,255,255,0)");
    shine.addColorStop(.31,"rgba(255,255,255,0)");
    shine.addColorStop(.42,rgba(p.mid,.065*power));
    shine.addColorStop(.49,rgba(p.light,.13*power));
    shine.addColorStop(.55,rgba(p.edge,.08*power));
    shine.addColorStop(.66,"rgba(255,255,255,0)");
    shine.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=shine;
    ctx.fillRect(0,0,W,H);
    // Subtle edge reflection only; preserve artwork colors and brightness.
    const edge=ctx.createLinearGradient(0,0,W,0);
    edge.addColorStop(0,rgba(p.edge,.12*power));
    edge.addColorStop(.11,"rgba(255,255,255,0)");
    edge.addColorStop(.89,"rgba(255,255,255,0)");
    edge.addColorStop(1,rgba(p.light,.115*power));
    ctx.fillStyle=edge;
    ctx.fillRect(0,0,W,H);
    // Thin etched edge, not an opaque frame or a net of decorative lines.
    ctx.strokeStyle=rgba(p.edge,.22*power);
    ctx.lineWidth=3;
    ctx.strokeRect(10,10,W-20,H-20);
    ctx.strokeStyle=rgba(p.light,.21*power);
    ctx.lineWidth=1;
    ctx.strokeRect(17,17,W-34,H-34);
    // A single restrained colored glint at the bottom left, avoiding the title.
    const glow=ctx.createRadialGradient(110,1020,6,110,1020,220);
    glow.addColorStop(0,rgba(p.light,.10*power));
    glow.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=glow;
    ctx.fillRect(0,800,400,400);
  } finally {
    ctx.restore();
  }
}
