import { describe, expect, it } from "vitest";
import { DEFAULT_SIMPLE_OVERFRAME, validSimpleOverframe } from "./simpleOverframe";
import { newCard, parseImport, mergeCards } from "./model";
import {
  overlayRects, updateLayoutPart, validOverframeLayout, validLayoutPresets,
  builtInLayout, completeLayout, snapOverlayRect,
} from "./overframeLayout";

const config = { ...DEFAULT_SIMPLE_OVERFRAME, image: "data:image/png;base64,AA==" };
describe("오버프레임 V3.3 레이아웃 좌표·데이터 호환", () => {
  it("이전 V3 프로젝트의 레이아웃이 없어도 원래 카드 위치를 그대로 유지한다", () => {
    const original = overlayRects(config, "xyz", 4);
    expect(original.effect).toEqual({ x: 36, y: 912, w: 828, h: 252 });
    expect(original.name.x).toBeGreaterThan(65);
    expect(original.attribute.x).toBeGreaterThan(700);
    expect(original.level.w).toBeGreaterThan(200);
    const old = { ...config };
    delete (old as {layout?:unknown}).layout;
    expect(validSimpleOverframe(old)).toBe(true);
    expect(parseImport([{ ...newCard(), simpleOverframe: old }])[0].simpleOverframe?.layout)
      .toBeUndefined();
  });
  it("카드명·속성·랭크·효과창을 별도 좌표로 이동하고 크기 변경한다", () => {
    const before = overlayRects(config, "xyz", 4);
    const movedTitle = { ...before.name, x: 90, y: 100, w: before.name.w * .8, h: before.name.h * .8 };
    const layout = updateLayoutPart(config, "xyz", 4, "name", movedTitle);
    const updated = { ...config, layout };
    expect(overlayRects(updated, "xyz", 4).name.x).toBe(90);
    expect(overlayRects(updated, "xyz", 4).name.y).toBe(100);
    expect(overlayRects(updated, "xyz", 4).name.w).toBeCloseTo(movedTitle.w);
    expect(overlayRects(updated, "xyz", 4).attribute).toEqual(before.attribute);
    const movedEffect = { x: 50, y: 1000, w: 800, h: 160 };
    const effectLayout = updateLayoutPart(updated, "xyz", 4, "effect", movedEffect);
    expect(overlayRects({ ...updated, layout: effectLayout }, "xyz", 4).effect)
      .toEqual(movedEffect);
  });
  it("정렬 스냅은 중앙과 안전 여백에서만 발생하며 끌 수 있다", () => {
    const r = { x: 346, y: 534, w: 200, h: 120 };
    const on = snapOverlayRect(r, true);
    expect(on.rect.x).toBe(350);
    expect(on.rect.y).toBe(540);
    expect(on.guides).toEqual({ x: 450, y: 600 });
    const off = snapOverlayRect(r, false);
    expect(off.rect.x).toBe(346);
    expect(off.guides).toEqual({});
  });
  it("기본·중앙형·상단 여백형 프리셋을 적용할 수 있다", () => {
    const base = builtInLayout("기본", "effect", 4, 76, 21);
    const center = builtInLayout("중앙형", "effect", 4, 76, 21);
    const bottom = builtInLayout("상단 여백형", "effect", 4, 76, 21);
    expect(base.effect?.y).toBe(912);
    expect(center.effect?.y).toBe(970);
    expect(bottom.effect?.y).toBe(1010);
    expect(validOverframeLayout(base)).toBe(true);
    expect(validOverframeLayout(center)).toBe(true);
    expect(validOverframeLayout(bottom)).toBe(true);
  });
  it("프로젝트 JSON과 카드 메타데이터 갱신 시 사용자 프리셋을 보존한다", () => {
    const layout = completeLayout(config, "xyz", 4);
    const withPreset = { ...config, layout, savedPresets: [{ name: "내 레이아웃", layout }] };
    expect(validSimpleOverframe(withPreset)).toBe(true);
    const card = { ...newCard(), simpleOverframe: withPreset };
    expect(parseImport([card])[0].simpleOverframe).toEqual(withPreset);
    expect(mergeCards([card], [{ ...newCard(), name: "갱신" }])[0].simpleOverframe)
      .toEqual(withPreset);
  });
  it("잘못된 좌표·크기·범위·프리셋 중복·과다 저장을 차단한다", () => {
    for (const layout of [
      { name: { x: -2, y: 5, scale: 1 } },
      { attribute: { x: 5, y: NaN, scale: 1 } },
      { level: { x: 5, y: 5, scale: Infinity } },
      { effect: { x: 30, y: 300, w: 900, h: 100 } },
      { effect: { x: 30, y: 300, w: -50, h: 100 } },
      { unknown: { x: 4, y: 6, scale: 1 } },
    ]) {
      expect(validOverframeLayout(layout)).toBe(false);
      expect(validSimpleOverframe({ ...config, layout })).toBe(false);
    }
    expect(validLayoutPresets([{ name: "A", layout: {} }, { name: "A", layout: {} }]))
      .toBe(false);
    expect(validLayoutPresets(Array.from({ length: 6 }, (_, i) => ({
      name: String(i), layout: {},
    })))).toBe(false);
  });
});
