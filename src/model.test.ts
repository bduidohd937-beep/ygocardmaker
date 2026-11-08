import { describe, it, expect } from "vitest";
import {
  newCard,
  validateCards,
  parseImport,
  mergeCards,
  fromEDO,
  nextId,
} from "./model";
describe("project data", () => {
  it("validates image, name and id", () => {
    expect(validateCards([newCard()])[0]).toContain("일러스트");
    expect(validateCards([{ ...newCard(), id: -1 }], false).join()).toContain(
      "ID",
    );
  });
  it("rejects duplicate IDs atomically", () => {
    expect(() => parseImport([newCard(), newCard()])).toThrow("중복");
  });
  it("restores JSON project without loss", () => {
    const c = {
      ...newCard(),
      artwork: "data:image/png;base64,AA==",
      zoom: 2,
      offsetX: 34,
    };
    expect(parseImport({ version: 1, cards: [c] })).toEqual([c]);
  });
  it("protects local art and crop when updating metadata", () => {
    const old = { ...newCard(), artwork: "local", zoom: 2, offsetX: 12 };
    const incoming = { ...newCard(), name: "갱신", artwork: "incoming" };
    expect(mergeCards([old], [incoming])).toEqual([
      { ...incoming, artwork: "local", zoom: 2, offsetX: 12, offsetY: 0 },
    ]);
  });
  it("does not use a remote image URL from JSON", () => {
    expect(
      parseImport([{ ...newCard(), artwork: "https://remote.test/a.png" }])[0]
        .artwork,
    ).toBe("");
  });
  it("supports all monster base frames", () => {
    for (const frame of [
      "normal",
      "effect",
      "fusion",
      "ritual",
      "synchro",
      "xyz",
    ] as const)
      expect(validateCards([{ ...newCard(), frame }], false)).toEqual([]);
  });
  it("validates link rating and markers", () => {
    expect(
      validateCards([{ ...newCard(), frame: "link", level: 3 }], false).join(),
    ).toContain("화살표");
    expect(
      validateCards([{ ...newCard(), frame: "link", level: 2 }], false),
    ).toEqual([]);
  });
  it("blocks pendulum link", () => {
    expect(
      validateCards(
        [{ ...newCard(), frame: "link", level: 2, pendulum: true }],
        false,
      ).join(),
    ).toContain("펜듈럼");
  });
  it("rejects malformed fields", () => {
    expect(() => parseImport([{ ...newCard(), name: 0 }])).toThrow();
    expect(() => parseImport([{ ...newCard(), zoom: NaN }])).toThrow();
  });
  it("assigns available unique ID", () => {
    expect(nextId([newCard(210000900)])).toBe(210000901);
  });
});
describe("EDOPro metadata conversion", () => {
  it("imports a machine monster", () => {
    const c = fromEDO({
      id: 12,
      name: "몬스터",
      desc: "효과",
      type: 33,
      race: 32,
      attribute: 8,
      level: 4,
      atk: 1600,
      def: 1200,
    });
    expect([
      c.name,
      c.effect,
      c.race,
      c.attribute,
      c.level,
      c.atk,
      c.def,
    ]).toEqual(["몬스터", "효과", "기계족", "바람", 4, "1600", "1200"]);
  });
  it("imports Xyz and Link packed fields", () => {
    expect(fromEDO({ type: 0x800001, level: 4 }).frame).toBe("xyz");
    const c = fromEDO({ type: 0x4000001, level: 2, def: 5 });
    expect(c.frame).toBe("link");
    expect(c.arrows).toEqual([1, 4]);
  });
  it("decodes pendulum scales and split texts", () => {
    const c = fromEDO({
      type: 0x1000021,
      level: (3 << 24) | (7 << 16) | 4,
      desc: "[ Pendulum Effect ]\n효과 A\n----------------------------------------\n[ Monster Effect ]\n효과 B",
    });
    expect([
      c.level,
      c.scaleLeft,
      c.scaleRight,
      c.pendulumEffect,
      c.effect,
    ]).toEqual([4, 3, 7, "효과 A", "효과 B"]);
  });
  it("flags unparsed pendulum and tuner rather than inventing", () => {
    expect(fromEDO({ type: 0x1000021, desc: "긴 글" }).unsupported).toContain(
      "펜듈럼 효과 분리 필요",
    );
    expect(fromEDO({ type: 0x1021 }).unsupported).toContain("튜너 표기");
  });
  it("imports quickplay spell and counter trap", () => {
    expect(fromEDO({ type: 0x10002 }).subtype).toBe("속공");
    expect(fromEDO({ type: 0x100004 }).subtype).toBe("카운터");
  });
  it("maps unknown stats to question mark", () => {
    expect(fromEDO({ atk: -2, def: -1 }).atk).toBe("?");
  });
});
