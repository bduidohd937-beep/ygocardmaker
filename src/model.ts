export const FRAMES = {
  effect: "효과",
  normal: "일반",
  fusion: "융합",
  ritual: "의식",
  synchro: "싱크로",
  xyz: "엑시즈",
  link: "링크",
  spell: "마법",
  trap: "함정",
} as const;
export type Frame = keyof typeof FRAMES;
export const ATTRIBUTES = ["어둠", "빛", "땅", "물", "불", "바람", "신"];
export const RACES = [
  "전사족",
  "마법사족",
  "천사족",
  "악마족",
  "언데드족",
  "기계족",
  "수족",
  "화염족",
  "암석족",
  "비행야수족",
  "식물족",
  "곤충족",
  "번개족",
  "드래곤족",
  "야수족",
  "야수전사족",
  "공룡족",
  "어류족",
  "바다뱀족",
  "파충류족",
  "사이킥족",
  "환신야수족",
  "창조신족",
  "환룡족",
  "사이버스족",
  "환상마족",
];
export const LINK_BITS = [1, 2, 4, 8, 32, 64, 128, 256];
/** EDOPro/OCG card type flags. These are categories, not separate card frames. */
export const MONSTER_TRAIT_FLAGS = {
  "튜너": 0x1000,
  "리버스": 0x200000,
  "유니온": 0x400,
  "스피릿": 0x200,
  "듀얼": 0x800,
  "툰": 0x400000,
} as const;
export type MonsterTrait = keyof typeof MONSTER_TRAIT_FLAGS;
export const MONSTER_TRAITS = Object.keys(MONSTER_TRAIT_FLAGS) as MonsterTrait[];

export function monsterKindLabels(card: Card): string[] {
  if (!isMonster(card)) return [];
  const labels = [card.race];
  if (card.frame !== "effect" && card.frame !== "normal") labels.push(FRAMES[card.frame]);
  if (card.pendulum) labels.push("펜듈럼");
  for (const trait of MONSTER_TRAITS) {
    if (card.traits?.includes(trait)) labels.push(trait);
  }
  labels.push(card.frame === "normal" ? "일반" : "효과");
  return labels;
}
export interface Card {
  id: number;
  name: string;
  theme: string;
  frame: Frame;
  attribute: string;
  race: string;
  /** Optional for backward compatibility with existing IndexedDB/JSON projects. */
  traits?: MonsterTrait[];
  level: number;
  atk: string;
  def: string;
  effect: string;
  subtype: string;
  pendulum: boolean;
  scaleLeft: number;
  scaleRight: number;
  pendulumEffect: string;
  arrows: number[];
  artwork: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  unsupported?: string[];
}
export interface Project {
  version: 1;
  name: string;
  cards: Card[];
}
export const isMonster = (c: Card) => !["spell", "trap"].includes(c.frame);
export function newCard(id = 210000401, theme = "새로운 테마"): Card {
  return {
    id,
    name: "이름 없는 카드",
    theme,
    frame: "effect",
    attribute: "바람",
    race: "기계족",
    traits: [],
    level: 4,
    atk: "1600",
    def: "1200",
    effect: "①: 이 카드의 효과를 입력하세요.",
    subtype: "일반",
    pendulum: false,
    scaleLeft: 1,
    scaleRight: 1,
    pendulumEffect: "",
    arrows: [1, 4],
    artwork: "",
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  };
}
export function nextId(cards: Card[]) {
  let n = Math.max(210000400, ...cards.map((c) => c.id)) + 1;
  while (cards.some((c) => c.id === n)) n++;
  return n;
}
export function validateCards(cards: Card[], requireArt = true): string[] {
  const errors: string[] = [];
  const ids = new Set<number>();
  for (const c of cards) {
    const tag = `${c.id} · ${c.name}`;
    if (!Number.isInteger(c.id) || c.id < 1 || c.id > 4294967295)
      errors.push(`${tag}: ID는 1~4294967295 정수여야 합니다.`);
    if (ids.has(c.id)) errors.push(`${tag}: 중복 카드 ID`);
    ids.add(c.id);
    if (!c.name.trim()) errors.push(`${tag}: 카드명 누락`);
    if (typeof c.frame !== "string" || !Object.hasOwn(FRAMES, c.frame))
      errors.push(`${tag}: 지원하지 않는 프레임`);
    if (!ATTRIBUTES.includes(c.attribute) || !RACES.includes(c.race))
      errors.push(`${tag}: 지원하지 않는 속성·종족`);
    if (
      new Set(c.arrows).size !== c.arrows.length ||
      c.arrows.some((a) => !LINK_BITS.includes(a))
    )
      errors.push(`${tag}: 잘못된 링크 마커`);
    if (c.traits !== undefined &&
      (!Array.isArray(c.traits) ||
       c.traits.some((trait) => !MONSTER_TRAITS.includes(trait)) ||
       new Set(c.traits).size !== c.traits.length ||
       (!isMonster(c) && c.traits.length > 0)))
      errors.push(`${tag}: 몬스터 특성 설정이 올바르지 않습니다.`);
    if (requireArt && !c.artwork) errors.push(`${tag}: 일러스트가 없습니다.`);
    if (
      isMonster(c) &&
      (!Number.isInteger(c.level) || c.level < 0 || c.level > 13)
    )
      errors.push(`${tag}: 레벨·랭크·링크는 0~13 정수`);
    if (
      c.frame === "link" &&
      (c.level < 1 || c.level > 8 || c.arrows.length !== c.level)
    )
      errors.push(`${tag}: LINK 수치와 화살표 개수가 일치해야 합니다.`);
    if (c.pendulum && (!isMonster(c) || c.frame === "link"))
      errors.push(`${tag}: 이 펜듈럼 조합은 지원하지 않습니다.`);
    if (
      c.pendulum &&
      [c.scaleLeft, c.scaleRight].some(
        (v) => !Number.isInteger(v) || v < 0 || v > 13,
      )
    )
      errors.push(`${tag}: 펜듈럼 스케일은 0~13`);
    if (
      isMonster(c) &&
      ![c.atk, ...(c.frame === "link" ? [] : [c.def])].every((v) =>
        /^(\?|\d{1,6})$/.test(v),
      )
    )
      errors.push(`${tag}: 스탯은 숫자 또는 ?`);
    if (c.unsupported?.length)
      errors.push(`${tag}: 확인 필요 — ${c.unsupported.join(", ")}`);
  }
  return errors;
}
function artData(value: unknown): string {
  return typeof value === "string" &&
    /^data:image\/(png|jpeg|webp);base64,/.test(value) &&
    value.length < 16_000_000
    ? value
    : "";
}
export function parseImport(raw: unknown): Card[] {
  const source = Array.isArray(raw) ? raw : (raw as { cards?: unknown })?.cards;
  if (!Array.isArray(source) || !source.length || source.length > 2000)
    throw Error("1~2000장의 cards 배열 또는 카드 배열 JSON이 필요합니다.");
  const cards = source.map((item: Record<string, unknown>) => {
    if (!item || typeof item !== "object")
      throw Error("잘못된 카드 데이터입니다.");
    const id = Number(item.id);
    let c = newCard(id);
    if ("frame" in item) {
      c = {
        ...c,
        ...Object.fromEntries(
          Object.keys(c)
            .filter((k) => k in item)
            .map((k) => [k, item[k]]),
        ),
      } as Card;
      c.artwork = artData(item.artwork);
      c.id = id;
      // Legacy project JSON has no traits; preserve all existing artwork and fields.
      if (!("traits" in item)) c.traits = [];
      else if (!Array.isArray(item.traits) ||
        item.traits.some((value: unknown) => !MONSTER_TRAITS.includes(value as MonsterTrait)))
        throw Error("몬스터 특성 정보가 올바르지 않습니다.");
      if (
        typeof c.name !== "string" ||
        typeof c.effect !== "string" ||
        typeof c.theme !== "string" ||
        typeof c.atk !== "string" ||
        typeof c.def !== "string" ||
        typeof c.subtype !== "string" ||
        typeof c.pendulumEffect !== "string" ||
        !Array.isArray(c.arrows) ||
        c.arrows.some((v) => !LINK_BITS.includes(v))
      )
        throw Error("카드 필드 형식이 올바르지 않습니다.");
      if (
        Array.isArray(item.unsupported) &&
        item.unsupported.every((v) => typeof v === "string")
      )
        c.unsupported = item.unsupported;
      if (
        typeof c.pendulum !== "boolean" ||
        [c.zoom, c.offsetX, c.offsetY].some(
          (v) => typeof v !== "number" || !Number.isFinite(v),
        ) ||
        c.zoom < 1 ||
        c.zoom > 3
      )
        throw Error("일러스트 설정이 올바르지 않습니다.");
    } else c = fromEDO(item);
    return normalizeCardTraits(c);
  });
  const errors = validateCards(
    cards.map((c) => ({ ...c, unsupported: [] })),
    false,
  );
  if (errors.length) throw Error(errors.slice(0, 8).join("\n"));
  return cards;
}
/** Upgrade older locally saved projects that stored tuner/flip/toon as warnings.
 * Keep all artwork, crop settings and unrelated review notes unchanged.
 */
export function normalizeCardTraits(card: Card): Card {
  const legacy: Partial<Record<MonsterTrait, string>> = {
    "튜너": "튜너 표기",
    "리버스": "리버스 표기",
    "툰": "툰",
  };
  const existing = Array.isArray(card.traits) ? card.traits : [];
  const found = MONSTER_TRAITS.filter((trait) =>
    existing.includes(trait) ||
    (isMonster(card) && !!card.unsupported?.includes(legacy[trait] ?? "\u0000")),
  );
  const legacyLabels = Object.values(legacy);
  const review = card.unsupported?.filter((flag) => !legacyLabels.includes(flag));
  return {
    ...card,
    traits: isMonster(card) ? found : [],
    ...(card.unsupported !== undefined ? { unsupported: review } : {}),
  };
}
export function mergeCards(existing: Card[], incoming: Card[]): Card[] {
  const map = new Map(existing.map((c) => [c.id, c]));
  for (const c of incoming) {
    const prev = map.get(c.id);
    map.set(
      c.id,
      {
        ...c,
        // A CDB row does not carry theme metadata. Preserve the editor's
        // manually assigned theme when refreshing that row from a CDB.
        ...(prev && c.theme === "가져온 테마" ? { theme: prev.theme } : {}),
        ...(prev?.artwork
          ? {
              artwork: prev.artwork,
              zoom: prev.zoom,
              offsetX: prev.offsetX,
              offsetY: prev.offsetY,
            }
          : {}),
      },
    );
  }
  return [...map.values()];
}
export function fromEDO(row: Record<string, unknown>): Card {
  const c = newCard(Number(row.id), "가져온 테마");
  const type = Number(row.type) || 0;
  const lvl = Number(row.level) || 0;
  c.name = String(row.name ?? "이름 없는 카드");
  c.effect = String(row.desc ?? row.effect ?? "");
  c.traits = MONSTER_TRAITS.filter(
    (trait) => (type & MONSTER_TRAIT_FLAGS[trait]) !== 0,
  );
  c.frame =
    type & 2
      ? "spell"
      : type & 4
        ? "trap"
        : type & 0x4000000
          ? "link"
          : type & 0x800000
            ? "xyz"
            : type & 0x2000
              ? "synchro"
              : type & 0x40
                ? "fusion"
                : type & 0x80
                  ? "ritual"
                  : type & 0x10
                    ? "normal"
                    : "effect";
  c.attribute =
    (
      {
        1: "땅",
        2: "물",
        4: "불",
        8: "바람",
        16: "빛",
        32: "어둠",
        64: "신",
      } as Record<number, string>
    )[Number(row.attribute)] ?? "어둠";
  c.race = RACES[Math.log2(Number(row.race))] ?? "기계족";
  c.level = lvl & 0xff;
  c.atk = Number(row.atk) < 0 ? "?" : String(row.atk ?? 0);
  c.def = Number(row.def) < 0 ? "?" : String(row.def ?? 0);
  c.pendulum = !!(type & 0x1000000);
  c.scaleLeft = (lvl >>> 24) & 0xff;
  c.scaleRight = (lvl >>> 16) & 0xff;
  c.arrows =
    c.frame === "link" ? LINK_BITS.filter((b) => Number(row.def) & b) : [];
  c.subtype =
    type & 0x10000
      ? "속공"
      : type & 0x20000
        ? "지속"
        : type & 0x40000
          ? "장착"
          : type & 0x80000
            ? "필드"
            : type & 0x100000
              ? "카운터"
              : type & 0x80
                ? "의식"
                : "일반";
  if (c.pendulum) {
    const parts = c.effect.split(/\n?-{4,}\n?/);
    if (parts.length >= 2) {
      c.pendulumEffect = parts[0].replace(/^\[.*?\]\s*/, "");
      c.effect = parts
        .slice(1)
        .join("\n")
        .replace(/^\[.*?\]\s*/, "");
    } else c.unsupported = ["펜듈럼 효과 분리 필요"];
  }
  const flags: string[] = [];
  if (type & 0x4000) flags.push("토큰 프레임");
  if (type & 0x4000000 && type & 0x1000000) flags.push("링크 펜듈럼");
  if (flags.length) c.unsupported = [...(c.unsupported ?? []), ...flags];
  return c;
}
export async function readCDB(bytes: Uint8Array): Promise<Card[]> {
  const [{ default: init }, { default: wasm }] = await Promise.all([
    import("sql.js"),
    import("sql.js/dist/sql-wasm.wasm?url"),
  ]);
  const SQL = await init({ locateFile: () => wasm });
  const db = new SQL.Database(bytes);
  try {
    const result = db.exec(
      "SELECT d.*, t.name, t.desc FROM datas d JOIN texts t ON d.id=t.id",
    );
    if (!result.length) throw Error("datas/texts 카드 테이블이 없습니다.");
    const rows = result[0].values.map((vals) =>
      Object.fromEntries(result[0].columns.map((key, i) => [key, vals[i]])),
    );
    const cards = rows.map(fromEDO);
    const seen = new Set<number>();
    for (const c of cards) {
      if (
        !Number.isInteger(c.id) ||
        c.id < 1 ||
        c.id > 4294967295 ||
        seen.has(c.id)
      )
        throw Error("CDB에 잘못되거나 중복된 카드 ID가 있습니다.");
      seen.add(c.id);
    }
    // Incomplete CDB settings (e.g. absent link markers) remain editable.
    // Export validation blocks these cards until the author corrects them.
    return cards;
  } finally {
    db.close();
  }
}
