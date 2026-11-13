import { describe, expect, it } from "vitest";
import { DEFAULT_SIMPLE_OVERFRAME, cropToPortrait, validSimpleOverframe, requiredSimpleOverframeAssets, sourceAssetKeyForLevel } from "./simpleOverframe";
import { mergeCards, newCard, parseImport, validateCards } from "./model";
import { setActivePack } from "./assetPack";

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

describe("간편 오버프레임 원본 에셋 재사용", () => {
  it("엑시즈의 랭크 PNG와 일반 몬스터의 레벨 PNG를 구별한다", () => {
    expect(sourceAssetKeyForLevel("xyz")).toBe("star:rank");
    expect(sourceAssetKeyForLevel("effect")).toBe("star:level");
    expect(sourceAssetKeyForLevel("spell")).toBe(null);
    expect(sourceAssetKeyForLevel("trap")).toBe(null);
    expect(sourceAssetKeyForLevel("link")).toBe(null);
  });
  it("가짜 문자 원형 아이콘 대신 실제 원본 에셋만 요구한다", () => {
    setActivePack(null);
    expect(requiredSimpleOverframeAssets(settings, "어둠", "xyz", 5)).toEqual([
      "font:name", "attribute:dark", "star:rank",
    ]);
    expect(requiredSimpleOverframeAssets(settings, "빛", "effect", 4)).toEqual([
      "font:name", "attribute:light", "star:level",
    ]);
    expect(requiredSimpleOverframeAssets(settings, "어둠", "spell", 0)).toEqual([
      "font:name", "attribute:spell",
    ]);
    expect(requiredSimpleOverframeAssets(settings, "어둠", "trap", 0)).toEqual([
      "font:name", "attribute:trap",
    ]);
  });
  it("선택적으로 표기를 숨기면 해당 에셋을 요구하지 않는다", () => {
    setActivePack(null);
    expect(requiredSimpleOverframeAssets({
      ...settings, showName: false, showAttribute: false, showLevel: false,
    }, "어둠", "xyz", 12)).toEqual([]);
  });
  it("사용자가 선택한 ZIP에 실제 에셋이 있으면 추가 요구하지 않는다", () => {
    setActivePack({ version: 1, name: "검증.zip", importedAt: "2026-11-13",
      files: { "font:name": "data:font/woff2;base64,AA==", "attribute:dark": "data:image/png;base64,AA==",
        "star:rank": "data:image/png;base64,AA==" } });
    try {
      expect(requiredSimpleOverframeAssets(settings, "어둠", "xyz", 5)).toEqual([]);
      expect(requiredSimpleOverframeAssets(settings, "어둠", "effect", 5)).toEqual([
        "star:level",
      ]);
    } finally { setActivePack(null); }
  });
  it("레벨 아이콘 표시 설정을 포함해 저장하고 구버전도 유지한다", () => {
    expect(validSimpleOverframe({ ...settings, showLevel: false })).toBe(true);
    expect(validSimpleOverframe({ ...settings, showLevel: "no" })).toBe(false);
    const old = { ...settings }; delete (old as {showLevel?:boolean}).showLevel;
    expect(validSimpleOverframe(old)).toBe(true);
    expect(parseImport([{ ...newCard(), simpleOverframe: { ...settings, showLevel: false } }])[0]
      .simpleOverframe?.showLevel).toBe(false);
  });
});
