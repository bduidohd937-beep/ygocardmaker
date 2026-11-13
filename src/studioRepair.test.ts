import { describe, expect, it } from "vitest";
import { newCard, validateCards } from "./model";
import { DEFAULT_SIMPLE_OVERFRAME } from "./simpleOverframe";
import { applyStudioSafeRepairs, planStudioSafeRepairs } from "./studioRepair";

const art = "data:image/png;base64,AA==";
describe("V4.2 선택 적용형 안전 오류 수정", () => {
  it("중복 특성·미리보기만 고치고 원본과 원화를 유지한다", () => {
    const card = { ...newCard(918760001), artwork: art,
      traits: ["튜너", "튜너"] as ("튜너")[],
      previewMode: "overframe" as const,
    };
    const before = JSON.stringify(card);
    const patches = planStudioSafeRepairs([card], [card.id]);
    expect(patches).toHaveLength(1);
    expect(patches[0].reasons).toHaveLength(2);
    const [fixed] = applyStudioSafeRepairs([card],patches);
    expect(fixed.traits).toEqual(["튜너"]);
    expect(fixed.previewMode).toBe("normal");
    expect(fixed.artwork).toBe(art);
    expect(validateCards([fixed],false)).toEqual([]);
    expect(JSON.stringify(card)).toBe(before);
  });
  it("3:4 원화만 있을 때는 기본 미리보기를 3:4로 수정한다", () => {
    const card = { ...newCard(918760002),simpleOverframe:{
      ...DEFAULT_SIMPLE_OVERFRAME,image:art,
    }};
    const patched = applyStudioSafeRepairs([card],
      planStudioSafeRepairs([card],[card.id]))[0];
    expect(patched.previewMode).toBe("overframe");
    expect(patched.simpleOverframe).toEqual(card.simpleOverframe);
  });
  it("LINK 숫자가 달라지는 마커는 자동 수정하지 않는다", () => {
    const card = {...newCard(918760003),frame:"link" as const,level:3,arrows:[1,1,4]};
    expect(planStudioSafeRepairs([card],[card.id])).toEqual([]);
    const correct = {...card,level:2};
    const patches = planStudioSafeRepairs([correct],[card.id]);
    expect(patches[0].change.arrows).toEqual([1,4]);
  });
  it("문제가 있어도 명확한 복구법이 없으면 데이터는 그대로 둔다", () => {
    const card = {...newCard(918760004),name:"",artwork:""};
    expect(planStudioSafeRepairs([card],[card.id])).toEqual([]);
    expect(applyStudioSafeRepairs([card],[])[0]).toBe(card);
  });
  it("선택된 카드에만 수정하고 다른 카드·효과·수치·원화를 보존한다", () => {
    const cards = [
      {...newCard(918760005),traits:["튜너","튜너"] as ("튜너")[]},
      {...newCard(918760006),traits:["튜너","튜너"] as ("튜너")[]},
    ];
    const updated = applyStudioSafeRepairs(cards,
      planStudioSafeRepairs(cards,[918760006]));
    expect(updated[0]).toBe(cards[0]);
    expect(updated[1].traits).toEqual(["튜너"]);
    expect(updated[1].effect).toBe(cards[1].effect);
    expect(updated[1].atk).toBe(cards[1].atk);
  });
});
