import { describe, expect, it } from "vitest";
import { classifyAsset, requiredAssets } from "./assetPack";
import { newCard } from "./model";

describe("asset catalog filename classification", () => {
  it("recognizes blank frames including pendulum", () => {
    expect(classifyAsset("folder/card-effect.png")?.key).toBe("frame:effect");
    expect(classifyAsset("folder/card-synchro-pendulum.png")?.key).toBe("frame:synchro-pendulum");
    expect(classifyAsset("folder/card-link-pendulum.png")).toBeNull();
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
