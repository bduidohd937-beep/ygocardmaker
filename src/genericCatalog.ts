import { strToU8, zipSync } from "fflate";
import type { Card } from "./model";

export type Adoption = "채택" | "보류" | "폐기";
export type BuildStatus = "미확인" | "제작 기록" | "파일 확인";
export type DuelStatus = "미검증" | "검증 중" | "통과" | "오류";
export type ArtworkSlot = "original" | "overframe" | "final";
export interface GenericHistory {
  at: string;
  version: string;
  note: string;
}
export interface GenericCard {
  key: string;
  id: number | null;
  name: string;
  role: string;
  adoption: Adoption;
  cdbStatus: BuildStatus;
  luaStatus: BuildStatus;
  duelStatus: DuelStatus;
  version: string;
  effect: string;
  luaText: string;
  issues: string;
  artwork: Partial<Record<ArtworkSlot, string>>;
  history: GenericHistory[];
}

function entry(key: string, id: number | null, name: string, role: string,
  adoption: Adoption, version = "미확인"): GenericCard {
  return {
    key, id, name, role, adoption, version,
    cdbStatus: adoption === "채택" ? "제작 기록" : "미확인",
    luaStatus: adoption === "채택" ? "제작 기록" : "미확인",
    duelStatus: "미검증", effect: "", luaText: "", issues: "",
    artwork: {}, history: [],
  };
}

/** User-reported CDB/Lua preparation is not EDOPro verification. Effects are intentionally blank. */
export function initialGenericCards(): GenericCard[] {
  return [
    entry("card-990470201", 990470201, "정수약탈자 루미크론", "특수 소환 대응 드로우", "채택"),
    entry("card-919300101", 919300101, "탐색세 징수관 로코", "서치·회수 견제", "채택"),
    entry("card-919300102", 919300102, "반론의 여지는 없다", "체인 무효·보호", "채택"),
    entry("card-919300103", 919300103, "원천봉쇄관 리제", "덱·묘지 견제", "채택"),
    entry("card-919300104", 919300104, "공역의 관측자－오르비아", "순간 광역 무효", "채택", "V0.8"),
    entry("candidate-1", null, "반격의 첫 수", "역할 확인 필요", "보류"),
    entry("candidate-2", null, "예비 시동", "역할 확인 필요", "보류"),
    entry("candidate-3", null, "인과의 중재자－벨렌", "역할 확인 필요", "보류"),
    entry("candidate-4", null, "차원의 유예", "역할 확인 필요", "보류"),
  ];
}

export function getGenericCards(saved: GenericCard[] | undefined): GenericCard[] {
  return Array.isArray(saved) ? saved : initialGenericCards();
}
export function linkedCard(record: GenericCard, cards: readonly Card[]): Card | undefined {
  return record.id === null ? undefined : cards.find(card => card.id === record.id);
}
export function effectiveText(record: GenericCard, cards: readonly Card[]): string {
  return record.effect || linkedCard(record, cards)?.effect || "";
}
export function artworkFor(record: GenericCard, cards: readonly Card[], slot: ArtworkSlot): string {
  const own = record.artwork[slot];
  if (own) return own;
  const card = linkedCard(record, cards);
  if (slot === "original") return card?.artwork || "";
  if (slot === "overframe") return card?.simpleOverframe?.image || "";
  return "";
}
export function filterGenericCards(records: readonly GenericCard[], cards: readonly Card[],
  query: string, adoption: Adoption | "전체"): GenericCard[] {
  const q = query.trim().toLowerCase();
  return records.filter(record =>
    (adoption === "전체" || record.adoption === adoption) &&
    (!q || [record.name, String(record.id ?? ""), record.role, record.effect,
      record.version, record.issues, linkedCard(record, cards)?.effect || ""]
      .join(" ").toLowerCase().includes(q)));
}
export function validateGenericCards(value: unknown): GenericCard[] {
  if (!Array.isArray(value) || value.length > 2000) throw Error("도감 목록 형식 또는 수량이 올바르지 않습니다.");
  const keys = new Set<string>();
  const ids = new Set<number>();
  return value.map((v, index) => {
    if (!v || typeof v !== "object") throw Error((index + 1) + "번 카드 항목이 손상되었습니다.");
    const item = v as GenericCard;
    if (typeof item.key !== "string" || !item.key || keys.has(item.key))
      throw Error("중복되거나 잘못된 도감 키가 있습니다.");
    keys.add(item.key);
    if (item.id !== null && (!Number.isSafeInteger(item.id) || item.id <= 0 || item.id > 2147483647 || ids.has(item.id)))
      throw Error("카드 ID가 잘못되었거나 중복되었습니다: " + item.id);
    if (item.id !== null) ids.add(item.id);
    if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 120)
      throw Error("카드명이 비어 있거나 너무 깁니다.");
    if (!["채택", "보류", "폐기"].includes(item.adoption) ||
      !["미확인", "제작 기록", "파일 확인"].includes(item.cdbStatus) ||
      !["미확인", "제작 기록", "파일 확인"].includes(item.luaStatus) ||
      !["미검증", "검증 중", "통과", "오류"].includes(item.duelStatus))
      throw Error("채택·구현·검증 상태값이 잘못되었습니다.");
    for (const field of ["role", "version", "effect", "luaText", "issues"] as const)
      if (typeof item[field] !== "string") throw Error(field + " 필드가 잘못되었습니다.");
    if (!item.artwork || typeof item.artwork !== "object" || !Array.isArray(item.history))
      throw Error("이미지/이력 자료가 손상되었습니다.");
    for (const slot of ["original", "overframe", "final"] as ArtworkSlot[]) {
      const image = item.artwork[slot];
      if (image !== undefined && (typeof image !== "string" ||
        !/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(image)))
        throw Error("지원하지 않는 이미지 형식: " + item.name);
    }
    if (item.history.some(h => !h || typeof h.at !== "string" ||
      typeof h.version !== "string" || typeof h.note !== "string"))
      throw Error("이력 기록이 손상되었습니다.");
    return item;
  });
}
export function catalogCsv(records: readonly GenericCard[], cards: readonly Card[]): string {
  const rows = [["카드 ID", "카드명", "역할", "채택 상태", "CDB", "Lua", "실전 검증", "버전",
    "효과 원문", "이미지 원화", "오버프레임", "최종본", "오류·메모"]];
  for (const card of records) rows.push([
    card.id === null ? "" : String(card.id), card.name, card.role, card.adoption,
    card.cdbStatus, card.luaStatus, card.duelStatus, card.version,
    effectiveText(card, cards), artworkFor(card, cards, "original") ? "보유" : "미확인",
    artworkFor(card, cards, "overframe") ? "보유" : "미확인",
    artworkFor(card, cards, "final") ? "보유" : "미확인", card.issues,
  ]);
  return "\ufeff" + rows.map(row => row.map(v => '"' + v.replace(/"/g, '""') + '"').join(",")).join("\r\n");
}
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, "_").slice(0, 75) || "이름없음";
}
function dataBytes(data: string): { bytes: Uint8Array; extension: string } | null {
  const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(data);
  if (!match) return null;
  const bin = atob(match[2]);
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  return { bytes, extension: match[1] === "jpeg" ? "jpg" : match[1] };
}
export function catalogZip(records: readonly GenericCard[], cards: readonly Card[]): Uint8Array {
  validateGenericCards(records);
  const files: Record<string, Uint8Array> = {};
  const base = "범용카드_도감/";
  const put = (path: string, content: string) => { files[base + path] = strToU8(content); };
  put("범용카드_마스터목록.csv", catalogCsv(records, cards));
  put("범용카드_도감_백업.json", JSON.stringify({ version: 1, records }, null, 2));
  const effects: string[] = ["# 범용 카드 효과 원문", "", "※ 효과 미확인 항목은 임의로 채우지 않았습니다.", ""];
  const decisions: string[] = ["# 범용 카드 채택 기록", ""];
  for (const record of records) {
    const dir = (record.adoption === "채택" ? "채택카드/" :
      record.adoption === "보류" ? "보류카드/" : "폐기카드/") +
      (record.id === null ? "ID미정" : String(record.id)) + "_" + safeName(record.name) + "/";
    const eff = effectiveText(record, cards);
    const head = "## " + record.name + " (" + (record.id ?? "ID 미정") + ")";
    effects.push(head, "", eff || "효과 원문 미확인", "");
    decisions.push(head, "", "- 채택 상태: " + record.adoption,
      "- CDB: " + record.cdbStatus, "- Lua: " + record.luaStatus,
      "- EDOPro: " + record.duelStatus, "- 버전: " + record.version, "");
    put(dir + "효과원문.md", head + "\n\n" + (eff || "효과 원문 미확인") + "\n");
    put(dir + "검증기록.md", "# 검증 기록\n\n채택: " + record.adoption +
      "\n\nCDB: " + record.cdbStatus + "\n\nLua: " + record.luaStatus +
      "\n\n실전 검증: " + record.duelStatus + "\n\n오류·메모: " +
      (record.issues || "기록 없음") + "\n\n" +
      record.history.map(h => "- " + h.at + " / " + h.version + " / " + h.note).join("\n") + "\n");
    if (record.id !== null && record.luaText)
      put(dir + "c" + record.id + ".lua", record.luaText);
    for (const [slot, filename] of [["original", "원본_일러스트"],
      ["overframe", "오버프레임_이미지"], ["final", "최종본"]] as const) {
      const data = artworkFor(record, cards, slot);
      const parsed = data ? dataBytes(data) : null;
      if (parsed) files[base + dir + filename + "." + parsed.extension] = parsed.bytes;
    }
  }
  put("범용카드_효과원문.md", effects.join("\n"));
  put("범용카드_채택기록.md", decisions.join("\n"));
  put("배포본/README.md", "실제 EDOPro 배포 전 CDB·Lua 파일과 대전 검증을 별도 확인하세요.\n");
  return zipSync(files, { level: 3 });
}
export function parseCatalogBackup(text: string): GenericCard[] {
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== "object" ||
    (raw as { version?: unknown }).version !== 1) throw Error("지원하지 않는 도감 백업 버전입니다.");
  return validateGenericCards((raw as { records?: unknown }).records);
}
