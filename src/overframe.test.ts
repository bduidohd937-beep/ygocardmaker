import { describe, expect, it } from "vitest";
import { DEFAULT_OVERFRAME, overframeClip, overframePlacement, validOverframe } from "./overframe";
import { mergeCards, newCard, parseImport, validateCards } from "./model";

const layer = { ...DEFAULT_OVERFRAME, enabled: true,
  image: "data:image/png;base64,AA==", x: 42, y: -30, scale: 1.5, rotation: 15 };

describe("오버프레임 돌출 레이어", () => {
  it("기존 카드에 없어도 유효하며 JSON 왕복을 유지한다", () => {
    const old = newCard();
    expect(validateCards([old], false)).toEqual([]);
    const card = { ...old, overframe: layer };
    expect(parseImport({ version: 1, cards: [card] })).toEqual([card]);
  });

  it("CDB 메타데이터 업데이트에도 기존 돌출 이미지를 보존한다", () => {
    const old = { ...newCard(), artwork: "data:image/png;base64,AA==", overframe: layer };
    const incoming = { ...newCard(), name: "업데이트" };
    expect(mergeCards([old], [incoming])[0].overframe).toEqual(layer);
  });

  it("악성 데이터 URL, 크기 범위 초과, 없는 PNG를 거부한다", () => {
    expect(validOverframe(layer)).toBe(true);
    for (const invalid of [
      { ...layer, image: "https://example.com/a.png" },
      { ...layer, image: "data:image/jpeg;base64,AA==" },
      { ...layer, x: 999 },
      { ...layer, y: Infinity },
      { ...layer, scale: 3.1 },
      { ...layer, rotation: 90 },
      { ...layer, image: "" },
    ]) {
      expect(validOverframe(invalid)).toBe(false);
      expect(() => parseImport([{ ...newCard(), overframe: invalid }])).toThrow();
    }
  });

  it("일반/펜듈럼 카드의 제목과 효과창을 가리지 않는 영역만 사용한다", () => {
    expect(overframeClip(false)).toEqual({ x: 25, y: 210, w: 792, h: 673 });
    expect(overframeClip(true)).toEqual({ x: 25, y: 210, w: 792, h: 574 });
  });

  it("투명 원화의 종횡비와 사용자 위치·회전을 지킨다", () => {
    const p = overframePlacement(1000, 2000, layer);
    expect(p.w).toBe(960);
    expect(p.h).toBe(1920);
    expect(p.centerX).toBe(463);
    expect(p.centerY).toBe(515);
    expect(p.angle).toBeCloseTo(Math.PI / 12);
  });
});
