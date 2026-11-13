import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SIMPLE_OVERFRAME, validSimpleOverframe } from "./simpleOverframe";
import { newCard, parseImport, mergeCards } from "./model";
import {
  DEFAULT_FINISH, BUILT_IN_FINISH, applyFinishPreset,
  recommendedFinish, paintFinish, validFinishSettings,
} from "./overframeFinish";

const config = { ...DEFAULT_SIMPLE_OVERFRAME, image: "data:image/png;base64,AA==" };
describe("3:4 오버프레임 V3.5 절제된 광택 연출", () => {
  it("기존 카드의 원화·폰트·표기를 변형하지 않도록 기본값은 연출 OFF", () => {
    expect(DEFAULT_FINISH).toEqual({
      finishEnabled: false, finishStyle: "none", finishStrength: 28,
    });
    const old = { ...config };
    delete (old as {finishEnabled?:boolean}).finishEnabled;
    delete (old as {finishStyle?:string}).finishStyle;
    delete (old as {finishStrength?:number}).finishStrength;
    expect(validSimpleOverframe(old)).toBe(true);
    expect(parseImport([{...newCard(),simpleOverframe:old}])[0].simpleOverframe).toEqual(old);
  });
  it("엑시즈·융합·싱크로·링크에 서로 다른 스타일을 추천한다", () => {
    expect(recommendedFinish("xyz")).toBe("xyz");
    expect(recommendedFinish("fusion")).toBe("fusion");
    expect(recommendedFinish("synchro")).toBe("synchro");
    expect(recommendedFinish("link")).toBe("link");
    expect(recommendedFinish("effect")).toBe("prism");
  });
  it("ON/OFF와 강도 0, 프리셋 불러오기·초기화 값이 일관된다", () => {
    const preset = BUILT_IN_FINISH[0];
    expect(applyFinishPreset(preset)).toEqual({finishEnabled:true,finishStyle:"xyz",finishStrength:30});
    expect(validFinishSettings({...config,finishEnabled:true,finishStyle:"xyz",finishStrength:0})).toBe(true);
    const calls = { paint: vi.fn() };
    paintFinish(calls as unknown as CanvasRenderingContext2D,config);
    paintFinish(calls as unknown as CanvasRenderingContext2D,
      {...config,finishEnabled:true,finishStyle:"xyz",finishStrength:0});
    expect(calls.paint).not.toHaveBeenCalled();
  });
  it("스타일·강도·저장 프리셋 이름 및 개수 검증으로 잘못된 설정을 차단한다", () => {
    const valid = {...config,finishEnabled:true,finishStyle:"fusion" as const,
      finishStrength:35,finishPresets:[{name:"융합 전용",style:"fusion" as const,strength:35}]};
    expect(validSimpleOverframe(valid)).toBe(true);
    const invalid = [
      {finishEnabled:"yes"}, {finishStyle:"neon"}, {finishStrength:-1}, {finishStrength:101},
      {finishStrength:NaN}, {finishStrength:Infinity}, {finishPresets:[{name:"X",style:"none",strength:20}]},
      {finishPresets:[{name:"X",style:"xyz",strength:20},{name:"X",style:"fusion",strength:20}]},
      {finishPresets:Array.from({length:6},(_,i)=>({name:String(i),style:"xyz",strength:20}))},
    ];
    invalid.forEach(p => {
      expect(validSimpleOverframe({...config,...p})).toBe(false);
      expect(() => parseImport([{...newCard(),simpleOverframe:{...config,...p}}])).toThrow();
    });
  });
  it("V3.3 레이아웃·V3.4 효과창과 함께 프로젝트 저장·CDB 병합 시 보존", () => {
    const old = {...newCard(),simpleOverframe:{
      ...config,layout:{effect:{x:40,y:912,w:820,h:250}},effectStyle:"ocg" as const,
      panelTint:"charcoal" as const,
      finishEnabled:true,finishStyle:"xyz" as const,finishStrength:34,
      finishPresets:[{name:"내 마감",style:"xyz" as const,strength:34}],
    }};
    expect(validSimpleOverframe(old.simpleOverframe)).toBe(true);
    expect(parseImport([old])[0].simpleOverframe).toEqual(old.simpleOverframe);
    expect(mergeCards([old],[{...newCard(),name:"갱신"}])[0].simpleOverframe).toEqual(old.simpleOverframe);
  });
  it("연출은 원화 레이어에만 적용하고 효과강도와 무관하게 저장된 자산을 변경하지 않는다", () => {
    const original = config.image;
    const updated = {...config,finishEnabled:true,finishStyle:"prism" as const,finishStrength:100};
    expect(updated.image).toBe(original);
    expect(updated.showName).toBe(config.showName);
    expect(updated.layout).toBe(config.layout);
  });
});
