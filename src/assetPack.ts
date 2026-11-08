import { unzipSync } from "fflate";
import type { Card } from "./model";

export type AssetKind = "frame" | "mask" | "attribute" | "star" | "spell_trap_icon" | "link_arrow" | "font";
export type AssetPack = {
  version: 1;
  name: string;
  files: Record<string, string>;
  importedAt: string;
};
export type ImportReport = {
  pack: AssetPack;
  counts: Record<AssetKind, number>;
  duplicates: number;
  ignored: number;
};

const FRAMES = new Set(["normal", "effect", "ritual", "fusion", "synchro", "xyz", "link", "spell", "trap", "token"]);
const PENDULUM = new Set(["normal", "effect", "ritual", "fusion", "synchro", "xyz"]);
const ATTRIBUTES = new Set(["dark", "light", "earth", "water", "fire", "wind", "divine", "spell", "trap"]);
const SUBTYPES = new Set(["continuous", "quick-play", "equip", "field", "ritual", "counter"]);
const DIRECTIONS = new Set(["up", "right-up", "right", "right-down", "down", "left-down", "left", "left-up"]);
const ATTR_MAP: Record<string, string> = {
  "어둠": "dark", "빛": "light", "땅": "earth", "물": "water",
  "불": "fire", "바람": "wind", "신": "divine",
};
const SUBTYPE_MAP: Record<string, string> = {
  "지속": "continuous", "속공": "quick-play", "장착": "equip",
  "필드": "field", "의식": "ritual", "카운터": "counter",
};
const ARROW_MAP: Record<number, string> = {
  64: "left-up", 128: "up", 256: "right-up",
  8: "left", 32: "right",
  1: "left-down", 2: "down", 4: "right-down",
};

export function classifyAsset(path: string): { key: string; kind: AssetKind } | null {
  const name = path.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  if (name === "card-mask.png") return { key: "mask:default", kind: "mask" };
  if (name === "card-mask-pendulum.png") return { key: "mask:pendulum", kind: "mask" };
  if (name === "ygo-kr-name.woff2") return { key: "font:name", kind: "font" };
  if (name === "ygo-kr-race.woff2") return { key: "font:type", kind: "font" };
  if (name === "ygo-kr.woff2") return { key: "font:body", kind: "font" };
  let m = /^card-([a-z]+?)(-pendulum)?\.png$/.exec(name);
  if (m && FRAMES.has(m[1]) && (!m[2] || PENDULUM.has(m[1])))
    return { key: "frame:" + m[1] + (m[2] ?? ""), kind: "frame" };
  m = /^attribute-([a-z]+)-kr\.png$/.exec(name);
  if (m && ATTRIBUTES.has(m[1]))
    return { key: "attribute:" + m[1], kind: "attribute" };
  if (name === "level.png" || name === "rank.png")
    return { key: "star:" + name.slice(0, -4), kind: "star" };
  m = /^icon-([a-z-]+)\.png$/.exec(name);
  if (m && SUBTYPES.has(m[1]))
    return { key: "spell_trap_icon:" + m[1], kind: "spell_trap_icon" };
  m = /^arrow-([a-z-]+)-(on|off)\.png$/.exec(name);
  if (m && DIRECTIONS.has(m[1]))
    return { key: "link_arrow:" + m[1] + ":" + m[2], kind: "link_arrow" };
  return null;
}

export function requiredAssets(card: Card): string[] {
  const frame = card.frame + (card.pendulum && PENDULUM.has(card.frame) ? "-pendulum" : "");
  const keys = ["frame:" + frame];
  if (card.frame === "spell" || card.frame === "trap") {
    keys.push("attribute:" + card.frame);
    if (SUBTYPE_MAP[card.subtype]) keys.push("spell_trap_icon:" + SUBTYPE_MAP[card.subtype]);
  } else {
    keys.push("attribute:" + (ATTR_MAP[card.attribute] ?? "dark"));
    if (card.frame === "link") {
      for (const bit of [64, 128, 256, 8, 32, 1, 2, 4]) {
        const dir = ARROW_MAP[bit];
        keys.push("link_arrow:" + dir + ":" + (card.arrows.includes(bit) ? "on" : "off"));
      }
    } else if (card.level > 0) keys.push("star:" + (card.frame === "xyz" ? "rank" : "level"));
  }
  return keys;
}

function sourcePriority(path: string): number {
  const p = path.toLowerCase();
  if (p.includes("kooriookami")) return 0;
  if (p.includes("paper-yuan")) return 1;
  return 2;
}

function asFontDataUri(bytes: Uint8Array): string {
  if (bytes.length < 4 || bytes[0] !== 0x77 || bytes[1] !== 0x4f ||
    bytes[2] !== 0x46 || bytes[3] !== 0x32)
    throw Error("WOFF2 서명이 올바르지 않습니다.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return "data:font/woff2;base64," + btoa(binary);
}

function asPngDataUri(bytes: Uint8Array): string {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !sig.every((n, i) => bytes[i] === n))
    throw Error("PNG 형식이 아닌 파일이 포함되어 있습니다.");
  const width = (bytes[16] * 16777216 + (bytes[17] << 16) + (bytes[18] << 8) + bytes[19]) >>> 0;
  const height = (bytes[20] * 16777216 + (bytes[21] << 16) + (bytes[22] << 8) + bytes[23]) >>> 0;
  if (!width || !height || width > 5000 || height > 5000 || width * height > 16000000)
    throw Error("지원하지 않는 이미지 크기입니다.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return "data:image/png;base64," + btoa(binary);
}

export async function importAssetZip(file: File): Promise<ImportReport> {
  if (!file.name.toLowerCase().endsWith(".zip") || file.size > 90 * 1024 * 1024)
    throw Error("90MB 이하의 리소스 ZIP을 선택하세요.");
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const paths = Object.keys(archive);
  if (paths.length > 1000) throw Error("ZIP 항목이 너무 많습니다.");
  const sorted = paths.sort((a, b) => sourcePriority(a) - sourcePriority(b) || a.localeCompare(b));
  const chosen = new Map<string, { kind: AssetKind; bytes: Uint8Array }>();
  let total = 0, duplicates = 0, ignored = 0;
  for (const path of sorted) {
    const bytes = archive[path];
    total += bytes.length;
    if (total > 150 * 1024 * 1024) throw Error("ZIP 압축 해제 크기가 150MB를 초과합니다.");
    const candidate = classifyAsset(path);
    if (!candidate || bytes.length === 0) { ignored++; continue; }
    if (bytes.length > 12 * 1024 * 1024) throw Error("개별 이미지가 12MB를 초과합니다.");
    if (chosen.has(candidate.key)) { duplicates++; continue; }
    chosen.set(candidate.key, { kind: candidate.kind, bytes });
  }
  if (!chosen.has("frame:effect") || !chosen.has("frame:spell") || !chosen.has("frame:trap"))
    throw Error("효과 몬스터·마법·함정 기본 프레임이 포함된 ZIP이 필요합니다.");
  const counts: Record<AssetKind, number> = {
    frame: 0, mask: 0, attribute: 0, star: 0, spell_trap_icon: 0, link_arrow: 0, font: 0,
  };
  const files: Record<string, string> = {};
  for (const [key, value] of chosen) {
    files[key] = value.kind === "font" ? asFontDataUri(value.bytes) : asPngDataUri(value.bytes);
    counts[value.kind]++;
  }
  return {
    pack: { version: 1, name: file.name, files, importedAt: new Date().toISOString() },
    counts, duplicates, ignored,
  };
}

let current: AssetPack | null = null;
export function getActivePack() { return current; }
export function setActivePack(pack: AssetPack | null) { current = pack; }
export function assetUrl(key: string): string | null { return current?.files[key] ?? null; }

const DATABASE = "duelmind-card-studio-assets";
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DATABASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("packs");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveAssetPack(pack: AssetPack | null): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("packs", "readwrite");
      if (pack) tx.objectStore("packs").put(pack, "current");
      else tx.objectStore("packs").delete("current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function loadAssetPack(): Promise<AssetPack | null> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("packs").objectStore("packs").get("current");
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

export type AssetFontRole = "name" | "type" | "body";
const FONT_FALLBACK = '"Noto Sans KR Variable", sans-serif';
const loadedFaces = new Map<string, Promise<void>>();

export function assetFont(role: AssetFontRole): string {
  const pack = getActivePack();
  if (!pack?.files["font:" + role]) return FONT_FALLBACK;
  const family = "DUELMIND-YGO-KR-" + role + "-" + pack.importedAt.replace(/[^a-zA-Z0-9]/g, "");
  return '"' + family + '", ' + FONT_FALLBACK;
}

export async function ensureAssetFonts(): Promise<void> {
  const pack = getActivePack();
  if (!pack) return;
  await Promise.all((["name", "type", "body"] as const).map(async (role) => {
    const source = pack.files["font:" + role];
    if (!source) return;
    const family = "DUELMIND-YGO-KR-" + role + "-" + pack.importedAt.replace(/[^a-zA-Z0-9]/g, "");
    if (!loadedFaces.has(family)) {
      const pending = (async () => {
        const face = new FontFace(family, 'url("' + source + '") format("woff2")');
        const loaded = await face.load();
        document.fonts.add(loaded);
      })();
      loadedFaces.set(family, pending);
      void pending.catch(() => loadedFaces.delete(family));
    }
    await loadedFaces.get(family);
  }));
}
