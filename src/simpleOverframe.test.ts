import { describe, expect, it } from "vitest";
import { DEFAULT_SIMPLE_OVERFRAME, cropToPortrait, validSimpleOverframe } from "./simpleOverframe";
import { mergeCards, newCard, parseImport, validateCards } from "./model";

const image = "data:image/png;base64,AA==";
const settings = { ...DEFAULT_SIMPLE_OVERFRAME, image };

describe("3:4 오버프레임 간편 모드", () => {
  it("원화 하나만 사용하고 정확한 3:4 크롭을 계산한다", () => {
    expect(cropToPortrait(900, 1200)).toEqual({ sx: 0, sy: 0, sw: 900, sh: 1200 });
    expect(cropToPortrait(1600, 1200)).toEqual({ sx: 350, sy: 0, sw: 900, sh: 1200 });
    expect(cropToPortrait(600, 1200)).toEqual({ sx: 0, sy: 200, sw: 600, sh: 800 });
  });
  it("카드 프레임, 랭크, 돌출 레이어 없이도 설정을 저장한다", () => {
    const c = { ...newCard(), simpleOverframe: settings };
    expect(validateCards([c], false)).toEqual([]);
    expect(parseImport([c])[0].simpleOverframe).toEqual(settings);
  });
  it("기존 CDB 메타데이터를 다시 가져와도 간편 제작 설정을 유지한다", () => {
    const old = { ...newCard(), simpleOverframe: settings };
    const imported = { ...newCard(), name: "새 이름" };
    expect(mergeCards([old], [imported])[0].simpleOverframe).toEqual(settings);
  });
  it("기존 프로젝트에는 간편 모드 필드가 없어도 문제없다", () => {
    const old = newCard();
    expect(parseImport([old])[0].simpleOverframe).toBeUndefined();
  });
  it("잘못된 이미지 URL, 부정확한 불투명도 및 상자 영역을 거부한다", () => {
    expect(validSimpleOverframe(settings)).toBe(true);
    for (const invalid of [
      { ...settings, image: "https://example.com/a.png" },
      { ...settings, image: "data:image/svg+xml;base64,AA==" },
      { ...settings, effectOpacity: 101 },
      { ...settings, effectTop: 88 },
      { ...settings, effectTop: 85, effectHeight: 20 },
      { ...settings, showName: "yes" },
      { ...settings, effectStyle: "unknown" },
    ]) {
      expect(validSimpleOverframe(invalid)).toBe(false);
      expect(() => parseImport([{ ...newCard(), simpleOverframe: invalid }])).toThrow();
    }
  });
});
