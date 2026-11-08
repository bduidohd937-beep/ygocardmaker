import { describe, it, expect } from "vitest";
import {
  newCard,
  validateCards,
  parseImport,
  mergeCards,
  fromEDO,
  nextId,
  MONSTER_TRAITS,
  MONSTER_TRAIT_FLAGS,
  normalizeCardTraits,
  monsterKindLabels,
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
  it("warns only for unresolved pendulum text, not supported tuner type", () => {
    expect(fromEDO({ type: 0x1000021, desc: "긴 글" }).unsupported).toContain(
      "펜듈럼 효과 분리 필요",
    );
    expect(fromEDO({ type: 0x1021 }).traits).toContain("튜너");
    expect(fromEDO({ type: 0x1021 }).unsupported ?? []).not.toContain("튜너 표기");
  });
  it("imports quickplay spell and counter trap", () => {
    expect(fromEDO({ type: 0x10002 }).subtype).toBe("속공");
    expect(fromEDO({ type: 0x100004 }).subtype).toBe("카운터");
  });
  it("maps unknown stats to question mark", () => {
    expect(fromEDO({ atk: -2, def: -1 }).atk).toBe("?");
  });
});

describe("monster trait support and backward compatibility", () => {
  it("decodes all six independent EDOPro type flags", () => {
    for (const trait of MONSTER_TRAITS) {
      const value = 0x21 | MONSTER_TRAIT_FLAGS[trait];
      expect(fromEDO({ type: value }).traits).toEqual([trait]);
    }
  });
  it("supports stacked traits on an extra deck monster", () => {
    const c = fromEDO({
      type: 0x1 | 0x20 | 0x2000 | 0x1000 | 0x200000,
      name: "싱크로 리버스 튜너",
    });
    expect(c.frame).toBe("synchro");
    expect(c.traits).toEqual(["튜너", "리버스"]);
    expect(monsterKindLabels({ ...c, race: "드래곤족" })).toEqual([
      "드래곤족", "싱크로", "튜너", "리버스", "효과",
    ]);
  });
  it("rejects traits on spells and invalid imported traits", () => {
    expect(validateCards([{ ...newCard(), frame: "spell", traits: ["튜너"] }], false).join())
      .toContain("몬스터 특성");
    expect(() => parseImport([{ ...newCard(), traits: ["unknown"] }])).toThrow();
    expect(() => parseImport([{ ...newCard(), traits: "튜너" }])).toThrow();
    expect(validateCards([{ ...newCard(), traits: ["튜너", "튜너"] }], false).join())
      .toContain("몬스터 특성");
  });
  it("preserves uploaded artwork and trait selection through JSON", () => {
    const c = {
      ...newCard(910200001, "코스모코드"),
      traits: ["튜너", "스피릿"] as ("튜너" | "스피릿")[],
      artwork: "data:image/png;base64,AA==",
      zoom: 1.5, offsetX: -16, offsetY: 25,
    };
    expect(parseImport({ cards: [c] })).toEqual([c]);
  });
  it("upgrades old flagged cards without changing images or other review warnings", () => {
    const old = {
      ...newCard(),
      artwork: "data:image/png;base64,AA==",
      traits: undefined,
      unsupported: ["튜너 표기", "리버스 표기", "다른 확인사항"],
    };
    const converted = normalizeCardTraits(old);
    expect(converted.traits).toEqual(["튜너", "리버스"]);
    expect(converted.unsupported).toEqual(["다른 확인사항"]);
    expect(converted.artwork).toEqual(old.artwork);
    expect(converted.zoom).toEqual(old.zoom);
  });
  it("merges CDB metadata while keeping imported local artwork and crop", () => {
    const old = {
      ...newCard(910200001, "코스모코드"),
      artwork: "data:image/png;base64,AA==", zoom: 2, offsetX: 10,
    };
    const next = fromEDO({ id: old.id, type: 0x1021, name: "루나", desc: "효과", level: 3 });
    const merged = mergeCards([old], [next])[0];
    expect(merged.traits).toContain("튜너");
    expect(merged.artwork).toEqual(old.artwork);
    expect(merged.zoom).toEqual(2);
    expect(merged.offsetX).toEqual(10);
    expect(merged.theme).toEqual("코스모코드");
  });
});
