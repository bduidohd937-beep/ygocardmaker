import { describe, it, expect } from "vitest";
import {
  artworkPlacement, fitCropAspect, normalizeCrop, validArtworkCrop, FULL_CROP,
} from "./artworkCrop";

describe("non-destructive artwork crop", () => {
  it("treats missing crop as the original full image", () => {
    expect(artworkPlacement(1200, 800, { x: 10, y: 20, w: 400, h: 400 }))
      .toEqual(artworkPlacement(1200, 800, { x: 10, y: 20, w: 400, h: 400 }, FULL_CROP));
  });
  it("keeps the legacy zoom and offset geometry", () => {
    const result = artworkPlacement(1200, 800, {x: 10,y: 20,w: 400,h: 400}, undefined, 1, 0, 0);
    expect(result).toMatchObject({ sx: 0, sy: 0, sw: 1200, sh: 800, dx: -90, dy: 20, dw: 600, dh: 400 });
  });
  it("draws only a normalized source selection", () => {
    expect(artworkPlacement(1000, 800, {x: 0,y: 0,w: 200,h: 200},
      {x: .1,y: .2,w: .4,h: .5})).toMatchObject({sx: 100,sy: 160,sw: 400,sh: 400,dx: 0,dy: 0,dw: 200,dh: 200});
  });
  it("rejects invalid/non-finite crop rectangles", () => {
    for (const invalid of [
      {x: -1,y: 0,w: 1,h: 1}, {x: 0,y: 0,w: 2,h: 1},
      {x: .8,y: .8,w: .4,h: .4}, {x: 0,y: 0,w: NaN,h: 1},
      {x: 0,y: 0,w: .001,h: 1}, null, [],
    ]) expect(validArtworkCrop(invalid)).toBe(false);
  });
  it("clamps dragged crops to image bounds", () => {
    expect(normalizeCrop({x: .95,y: -1,w: .4,h: .3}))
      .toEqual({x: .6,y: 0,w: .4,h: .3});
  });
  it("fits frame aspect without stretching or leaving image bounds", () => {
    const crop = fitCropAspect(FULL_CROP, 1600, 900, 1);
    expect(crop.w * 1600 / (crop.h * 900)).toBeCloseTo(1);
    expect(validArtworkCrop(crop)).toBe(true);
  });
});
