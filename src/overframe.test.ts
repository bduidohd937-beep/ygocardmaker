import { describe, expect, it } from "vitest";
import { DEFAULT_OVERFRAME, cardToOverframeImage, overframeClip, overframePlacement, validOverframe } from "./overframe";
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

describe("오버프레임 정밀 편집 V2", () => {
  it("기존 V1 프로젝트의 마스크 없는 돌출 레이어도 읽을 수 있다", () => {
    const previous = { enabled: true, image: "data:image/png;base64,AA==",
      x: 0, y: 0, scale: 1, rotation: 0 };
    expect(validOverframe(previous)).toBe(true);
    expect(parseImport([{ ...newCard(), overframe: previous }])[0].overframe).toEqual(previous);
  });
  it("마스크와 가림 모드를 JSON에 보존하며 잘못된 입력은 차단한다", () => {
    const updated = { ...layer, mask: "data:image/png;base64,AA==", depth: "front" as const };
    expect(validOverframe(updated)).toBe(true);
    const card = { ...newCard(), overframe: updated };
    expect(parseImport([card])[0].overframe).toEqual(updated);
    expect(validOverframe({ ...updated, mask: "https://bad.example/mask.png" })).toBe(false);
    expect(validOverframe({ ...updated, depth: "invalid" })).toBe(false);
    expect(validOverframe({ ...updated, mask: "data:image/svg+xml;base64,AA==" })).toBe(false);
  });
  it("캔버스 좌표를 회전된 이미지 좌표로 정확하게 변환한다", () => {
    const p = overframePlacement(1000, 2000, layer);
    expect(cardToOverframeImage(p.centerX, p.centerY, 1000, 2000, layer)).toEqual({ x: 0.5, y: 0.5 });
    const right = cardToOverframeImage(p.centerX + Math.cos(p.angle) * p.w / 2,
      p.centerY + Math.sin(p.angle) * p.w / 2, 1000, 2000, layer);
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0.5);
  });
  it("프레임 상단과 효과창 보호 범위를 유지하고 내부만 보기 지원", () => {
    const front = overframeClip(false, "front");
    const inside = overframeClip(false, "inside");
    expect(front.x).toBeLessThan(inside.x);
    expect(front.y).toBeLessThan(inside.y);
    expect(front.y + front.h).toBeLessThan(886);
    expect(inside).toEqual({ x: 78, y: 233, w: 686, h: 625 });
    const asset = overframeClip(false, "inside", true);
    expect(asset.x).toBeGreaterThan(90);
    expect(asset.w).toBeGreaterThan(600);
  });
});
