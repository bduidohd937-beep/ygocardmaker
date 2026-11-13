import { describe, expect, it } from "vitest";
import { newCard, parseImport, mergeCards } from "./model";
import { DEFAULT_SIMPLE_OVERFRAME, validSimpleOverframe } from "./simpleOverframe";
import {
  effectPanelTextArea, panelFontRequirements, panelTypeLabel, statLabel,
  supportsStats, validEffectPanelSettings,
} from "./effectPanel";

const rect = { x: 36, y: 912, w: 828, h: 252 };
const settings = { ...DEFAULT_SIMPLE_OVERFRAME, image: "data:image/png;base64,AA==" };

describe("V3.4 OCG풍 효과창", () => {
  it("기본 효과창에 OCG풍 세부 디자인 옵션이 적용된다", () => {
    expect(settings.effectStyle).toBe("ocg");
    expect(settings.panelBorder).toBe("double");
    expect(settings.panelTint).toBe("auto");
    expect(settings.panelTexture).toBe(22);
    expect(validEffectPanelSettings(settings)).toBe(true);
    expect(validSimpleOverframe(settings)).toBe(true);
  });
  it("옛날 V3.3 프로젝트의 세부 옵션 부재와 기존 효과창 스타일을 허용한다", () => {
    const old = { ...settings, effectStyle: "glass" as const };
    delete (old as { panelBorder?: string }).panelBorder;
    delete (old as { panelTint?: string }).panelTint;
    delete (old as { panelTexture?: number }).panelTexture;
    delete (old as { showStats?: boolean }).showStats;
    delete (old as { showTypeLine?: boolean }).showTypeLine;
    expect(validSimpleOverframe(old)).toBe(true);
    const card = { ...newCard(), simpleOverframe: old };
    expect(parseImport([card])[0].simpleOverframe).toEqual(old);
    expect(mergeCards([card],[{ ...newCard(), name:"갱신" }])[0].simpleOverframe).toEqual(old);
  });
  it("이중 테두리·색상·효과창 수치는 엄격하게 검증된다", () => {
    for (const invalid of [
      {panelTint:"purple"},
      {panelBorder:"triple"},
      {borderThickness:0},
      {borderThickness:7},
      {panelTexture:-1},
      {panelTexture:101},
      {showStats:"yes"},
      {showTypeLine:1},
      {statsFontSize:33},
      {statsFontSize:NaN},
    ]) expect(validSimpleOverframe({ ...settings, ...invalid })).toBe(false);
    expect(validSimpleOverframe({ ...settings, panelTint:"violet",
      panelBorder:"none",panelTexture:0,statsFontSize:32 })).toBe(true);
  });
  it("종족 및 소환 방식과 링크·일반 몬스터의 스탯 표시가 올바르다", () => {
    expect(panelTypeLabel("xyz","드래곤족")).toBe("[드래곤족／엑시즈／효과]");
    expect(panelTypeLabel("fusion","마법사족")).toBe("[마법사족／융합／효과]");
    expect(panelTypeLabel("spell")).toBe("[마법 카드]");
    expect(statLabel({effect:"",frame:"xyz",atk:"3000",def:"2500"}))
      .toBe("ATK / 3000    DEF / 2500");
    expect(statLabel({effect:"",frame:"link",atk:"3000",level:4}))
      .toBe("ATK / 3000    LINK-4");
    expect(statLabel({effect:"",frame:"trap"})).toBe("");
    expect(supportsStats("xyz")).toBe(true);
    expect(supportsStats("spell")).toBe(false);
  });
  it("효과문·종족·스탯 자원은 실제 표시할 경우에만 요구한다", () => {
    expect(panelFontRequirements({ ...settings,showEffectText:false,showStats:false,
      showTypeLine:false },"xyz")).toEqual([]);
    expect(panelFontRequirements({ ...settings,showEffectText:true,showStats:true,
      showTypeLine:true },"xyz")).toEqual(["font:body","font:type"]);
    expect(panelFontRequirements({ ...settings,showEffectText:false,showStats:true,
      showTypeLine:false },"spell")).toEqual([]);
  });
  it("효과창 공간이 종족 표기·공수란에 따라 계산되고 본문 영역이 줄어든다", () => {
    const full = effectPanelTextArea(rect,settings,{effect:"",frame:"xyz"});
    const decorated = effectPanelTextArea(rect,{ ...settings,showTypeLine:true,showStats:true },
      {effect:"",frame:"xyz"});
    expect(full.h).toBe(232);
    expect(decorated.h).toBe(152);
    expect(decorated.x).toBeGreaterThan(rect.x);
    expect(decorated.w).toBeLessThan(rect.w);
  });
  it("효과창 추가 옵션·공격력·종족·V3.3 위치 정보가 JSON과 갱신을 통과한다", () => {
    const card = { ...newCard(),race:"드래곤족",atk:"3000",def:"2500",
      simpleOverframe:{ ...settings, showStats:true,showTypeLine:true,panelTint:"charcoal" as const,
        panelBorder:"double" as const,borderThickness:2,panelTexture:35,
        layout:{ effect:{x:40,y:900,w:820,h:265} } } };
    expect(validSimpleOverframe(card.simpleOverframe)).toBe(true);
    const imported = parseImport([card])[0];
    expect(imported.race).toBe("드래곤족");
    expect(imported.atk).toBe("3000");
    expect(imported.simpleOverframe).toEqual(card.simpleOverframe);
    expect(mergeCards([card],[{ ...newCard(),name:"갱신" }])[0].simpleOverframe)
      .toEqual(card.simpleOverframe);
  });
});
