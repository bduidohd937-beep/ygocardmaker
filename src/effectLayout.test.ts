import { describe, expect, it } from "vitest";
import { fitText } from "./assetRender";

function mockCanvasText() {
  const drawn: string[] = [];
  const state: { font: string; fillStyle: string; textAlign: string; textBaseline: string } = {
    font: "", fillStyle: "", textAlign: "left", textBaseline: "top",
  };
  const ctx = {
    get font() { return state.font; },
    set font(value: string) { state.font = value; },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(value: string) { state.fillStyle = value as string; },
    get textAlign() { return state.textAlign; },
    set textAlign(value: string) { state.textAlign = value; },
    get textBaseline() { return state.textBaseline; },
    set textBaseline(value: string) { state.textBaseline = value; },
    measureText(text: string) {
      const size = Number(state.font.match(/(\d+)px/)?.[1] ?? 20);
      return { width: Array.from(text).length * size * 0.9 };
    },
    fillText(text: string) { drawn.push(text); },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, drawn };
}

describe("long effect layout and clear error reporting", () => {
  it("fits a longer Korean effect at a smaller size and retains every character", () => {
    const { ctx, drawn } = mockCanvasText();
    const input = "가".repeat(320);
    const size = fitText(ctx, input, 0, 0, 600, 300, 40, 20);
    expect(size).toBeLessThan(29);
    expect(size).toBeGreaterThanOrEqual(20);
    expect(drawn.join("")).toBe(input);
  });
  it("keeps the font larger for short card descriptions", () => {
    const { ctx, drawn } = mockCanvasText();
    const input = "①: 이 카드를 특수 소환한다.";
    expect(fitText(ctx, input, 0, 0, 600, 300, 40, 20)).toBe(40);
    expect(drawn.join("")).toBe(input);
  });
  it("refuses to silently clip an effect that cannot fit even at minimum size", () => {
    const { ctx, drawn } = mockCanvasText();
    expect(() => fitText(ctx, "가".repeat(1000), 0, 0, 600, 300, 40, 20))
      .toThrow(/효과문 1000자.*최소 글꼴 20px/);
    expect(drawn).toEqual([]);
  });
});
