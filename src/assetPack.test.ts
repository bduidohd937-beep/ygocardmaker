import { describe, expect, it } from "vitest";
import { classifyAsset, requiredAssets } from "./assetPack";
import { newCard } from "./model";
import { ASSET_LAYOUT, LINK_POSITIONS, spellTrapHeadingPositions } from "./assetRender";

describe("asset catalog filename classification", () => {
  it("recognizes blank frames including pendulum", () => {
    expect(classifyAsset("folder/card-effect.png")?.key).toBe("frame:effect");
    expect(classifyAsset("folder/card-synchro-pendulum.png")?.key).toBe("frame:synchro-pendulum");
    expect(classifyAsset("folder/card-link-pendulum.png")).toBeNull();
  });
  it("recognizes artwork overlay masks", () => {
    expect(classifyAsset("image/card-mask.png")?.key).toBe("mask:default");
    expect(classifyAsset("image/card-mask-pendulum.png")?.key).toBe("mask:pendulum");
  });
  it("recognizes korean attributes, stars and spell icons", () => {
    expect(classifyAsset("attribute-wind-kr.png")?.key).toBe("attribute:wind");
    expect(classifyAsset("rank.png")?.key).toBe("star:rank");
    expect(classifyAsset("icon-field.png")?.key).toBe("spell_trap_icon:field");
  });
  it("recognizes eight link arrows with on/off states", () => {
    const dirs = ["up", "right-up", "right", "right-down", "down", "left-down", "left", "left-up"];
    for (const dir of dirs) for (const state of ["on", "off"])
      expect(classifyAsset("arrow-" + dir + "-" + state + ".png")?.key)
        .toBe("link_arrow:" + dir + ":" + state);
  });
  it("ignores unrecognized names, fonts, and layout scripts", () => {
    expect(classifyAsset("ygo-kr.woff2")).toBeNull();
    expect(classifyAsset("kr-style.js")).toBeNull();
    expect(classifyAsset("../image.png")).toBeNull();
  });
});
describe("automatic asset placement decisions", () => {
  it("maps normal monsters to level star and attribute", () => {
    const card = newCard();
    card.frame = "normal";
    card.attribute = "바람";
    expect(requiredAssets(card)).toEqual(["frame:normal", "attribute:wind", "star:level"]);
  });
  it("maps xyz to rank star and pendulum frame", () => {
    const card = newCard();
    card.frame = "xyz"; card.pendulum = true;
    expect(requiredAssets(card)).toEqual(["frame:xyz-pendulum", "attribute:wind", "star:rank"]);
  });
  it("maps field spell and counter trap icons", () => {
    const spell = newCard();
    spell.frame = "spell"; spell.subtype = "필드";
    expect(requiredAssets(spell)).toEqual(["frame:spell", "attribute:spell", "spell_trap_icon:field"]);
    const trap = { ...spell, frame: "trap" as const, subtype: "카운터" };
    expect(requiredAssets(trap)).toEqual(["frame:trap", "attribute:trap", "spell_trap_icon:counter"]);
  });
  it("maps EDOPro link bit values to named active/inactive directions", () => {
    const card = newCard();
    card.frame = "link"; card.arrows = [64, 2];
    const assets = requiredAssets(card);
    expect(assets).toContain("link_arrow:left-up:on");
    expect(assets).toContain("link_arrow:down:on");
    expect(assets).toContain("link_arrow:right-up:off");
    expect(assets).not.toContain("star:level");
  });
});

describe("source asset geometry regression", () => {
  it("places artwork at 1394x2031 source geometry", () => {
    expect(ASSET_LAYOUT.artwork).toEqual({ x: 170, y: 375, w: 1054, h: 1054 });
    expect(ASSET_LAYOUT.pendulumArtwork).toEqual({ x: 94, y: 364, w: 1205, h: 1205 });
    expect(ASSET_LAYOUT.artworkMask).toEqual({ x: 117, y: 322 });
  });
  it("matches all eight source arrow placements and EDOPro bits", () => {
    expect(LINK_POSITIONS).toEqual([
      [128, "up", 555, 278],
      [256, "right-up", 1130, 299],
      [32, "right", 1223, 761],
      [4, "right-down", 1130, 1336],
      [2, "down", 555, 1428],
      [1, "left-down", 95, 1336],
      [8, "left", 71, 758],
      [64, "left-up", 95, 299],
    ]);
  });
});

describe("pendulum text layer protection", () => {
  it("fits the separate panel before the monster type line", () => {
    const p = ASSET_LAYOUT.pendulumPanel;
    expect(p.y).toBeGreaterThan(ASSET_LAYOUT.pendulumArtwork.y);
    expect(p.y + p.h).toBeLessThan(ASSET_LAYOUT.effect.y);
    expect(ASSET_LAYOUT.pendulumScaleY).toBeGreaterThan(p.y);
    expect(ASSET_LAYOUT.pendulumScaleY).toBeLessThan(p.y + p.h);
  });
  it("lays out spell/trap text, subtype icon and closing bracket without overlap", () => {
    const p = spellTrapHeadingPositions(320, 36, true);
    expect(p.textX + 320).toBeLessThanOrEqual(p.iconX);
    expect(p.iconX + 72).toBeLessThanOrEqual(p.bracketX);
    expect(p.bracketX + 36).toBe(1394 - 142);
    const without = spellTrapHeadingPositions(320, 36, false);
    expect(without.textX + 320).toBe(without.bracketX);
  });
});
