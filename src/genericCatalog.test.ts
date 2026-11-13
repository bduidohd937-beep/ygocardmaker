import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { newCard } from "./model";
import {
  artworkFor, catalogCsv, catalogZip, effectiveText, filterGenericCards,
  initialGenericCards, parseCatalogBackup, validateGenericCards,
} from "./genericCatalog";

const seed = initialGenericCards();
describe("범용 카드 도감 V1.0", () => {
  it("채택 5종과 보류 4종을 별개로 기록하고 실전 검증은 미검증으로 둔다", () => {
    expect(seed).toHaveLength(9);
    expect(seed.filter(c => c.adoption === "채택")).toHaveLength(5);
    expect(seed.filter(c => c.adoption === "보류")).toHaveLength(4);
    expect(seed.every(c => c.duelStatus === "미검증")).toBe(true);
    expect(seed.filter(c => c.adoption === "채택").every(
      c => c.cdbStatus === "제작 기록" && c.luaStatus === "제작 기록")).toBe(true);
    expect(seed.find(c => c.id === 919300104)?.version).toBe("V0.8");
    expect(seed.filter(c => c.adoption === "보류").every(c => c.id === null)).toBe(true);
    expect(seed.every(c => c.effect === "")).toBe(true);
  });
  it("ID·역할·효과로 검색하며 제작 프로젝트 효과를 원문으로 참조한다", () => {
    const card = { ...newCard(919300101, "범용"), name: "로코",
      effect: "확인된 서치 견제 효과" };
    expect(effectiveText(seed[1], [card])).toContain("서치 견제");
    expect(filterGenericCards(seed, [card], "919300101", "전체")).toHaveLength(1);
    expect(filterGenericCards(seed, [card], "서치 견제", "채택")[0].id).toBe(919300101);
    expect(filterGenericCards(seed, [card], "바람", "채택")[0].id).toBe(919300101);
    expect(filterGenericCards(seed, [card], "반격", "보류")[0].name).toBe("반격의 첫 수");
    expect(filterGenericCards(seed, [card], "반격", "채택")).toHaveLength(0);
  });
  it("작업실 이미지 자동 참조와 도감 별도 이미지 슬롯의 독립성", () => {
    const card = { ...newCard(990470201, "범용"),
      artwork: "data:image/png;base64,AA==" };
    expect(artworkFor(seed[0], [card], "original")).toBe(card.artwork);
    const changed = { ...seed[0], artwork: {
      original: "data:image/png;base64,BB==" } };
    expect(artworkFor(changed, [card], "original")).toBe("data:image/png;base64,BB==");
    expect(card.artwork).toBe("data:image/png;base64,AA==");
    expect(artworkFor(changed, [card], "overframe")).toBe("");
  });
  it("중복 ID 및 손상 백업 거부, 정상 JSON 도감 복원", () => {
    expect(() => validateGenericCards([seed[0], { ...seed[1], id: seed[0].id }])).toThrow();
    expect(() => parseCatalogBackup('{"version":2,"records":[]}')).toThrow();
    expect(parseCatalogBackup(JSON.stringify({ version: 1, records: seed })))
      .toHaveLength(9);
  });
  it("마스터 CSV와 한글 ZIP 구조에 효과·검증·Lua·이미지를 분리", () => {
    const edited = seed.map(c => c.id === 919300104 ?
      { ...c, effect: "확정 원문", luaText: "-- sample Lua",
        artwork: { original: "data:image/png;base64,AA==" },
        history: [{ at: "2026-11-13", version: "V0.8", note: "패치 기록" }] } : c);
    const csv = catalogCsv(edited, []);
    expect(csv).toContain("실전 검증");
    expect(csv).toContain("919300104");
    const zip = unzipSync(catalogZip(edited, []));
    const root = "범용카드_도감/";
    expect(Object.keys(zip)).toContain(root + "범용카드_마스터목록.csv");
    expect(Object.keys(zip)).toContain(root + "범용카드_효과원문.md");
    expect(Object.keys(zip)).toContain(root + "범용카드_채택기록.md");
    expect(Object.keys(zip)).toContain(root + "보류카드/ID미정_반격의_첫_수/효과원문.md");
    const folder = root + "채택카드/919300104_공역의_관측자－오르비아/";
    expect(strFromU8(zip[folder + "효과원문.md"])).toContain("확정 원문");
    expect(strFromU8(zip[folder + "검증기록.md"])).toContain("미검증");
    expect(strFromU8(zip[folder + "c919300104.lua"])).toContain("sample Lua");
    expect(zip[folder + "원본_일러스트.png"]).toBeDefined();
  });
});
