import { describe,expect,it } from "vitest";
import { newCard,mergeCards,parseImport,validateCards } from "./model";
import { DEFAULT_SIMPLE_OVERFRAME } from "./simpleOverframe";
import {
  HUB_MAX_SELECTED, DEFAULT_HUB_OUTPUT, applyHubImageAssignments,
  hubCardStates, hubOutputPath, hubSelected, planHubImageAssignments,
} from "./studioHub";
const imageA="data:image/png;base64,AA==";
const imageB="data:image/png;base64,BB==";
const cards=[
  {...newCard(918760001,"아칠리쉬"),artwork:imageA},
  {...newCard(918760002,"아칠리쉬"),simpleOverframe:{
    ...DEFAULT_SIMPLE_OVERFRAME,image:imageB,
    finishEnabled:true,finishStyle:"xyz" as const,
    layout:{effect:{x:42,y:950,w:804,h:210}},
  }},
  {...newCard(918760003,"아칠리쉬")},
];
describe("YGO STUDIO V4.0 통합 원화 관리·출력",()=>{
  it("현황 집계로 일반/오버프레임/양쪽/누락 구별",()=>{
    expect(hubCardStates(cards[0])).toEqual({normal:true,overframe:false,dual:false});
    expect(hubCardStates(cards[1])).toEqual({normal:false,overframe:true,dual:false});
    expect(hubCardStates(cards[2])).toEqual({normal:false,overframe:false,dual:false});
  });
  it("기존 일반 일러스트 기본 보호와 덮어쓰기 명시 조건",()=>{
    const before=JSON.stringify(cards);
    const ids=cards.map(c=>c.id);
    const proposed={[ids[0]]:imageB,[ids[2]]:imageA};
    const safe=planHubImageAssignments(cards,proposed,ids,"normal",false);
    expect(safe.patches.map(p=>p.id)).toEqual([ids[2]]);
    expect(safe.skippedExisting).toEqual([ids[0]]);
    const after=applyHubImageAssignments(cards,safe);
    expect(after[0].artwork).toBe(imageA);
    expect(after[2].artwork).toBe(imageA);
    expect(after[2].zoom).toBe(1);
    const overwrite=planHubImageAssignments(cards,proposed,ids,"normal",true);
    const replaced=applyHubImageAssignments(cards,overwrite);
    expect(replaced[0].artwork).toBe(imageB);
    expect(JSON.stringify(cards)).toBe(before);
  });
  it("3:4 원화 교체는 레이아웃·광택·일반 카드 데이터 보존",()=>{
    const plan=planHubImageAssignments(cards,{
      [cards[0].id]:imageB,[cards[1].id]:imageA,
    },[cards[0].id,cards[1].id],"overframe",true);
    const result=applyHubImageAssignments(cards,plan);
    expect(result[0].artwork).toBe(imageA);
    expect(result[0].simpleOverframe?.image).toBe(imageB);
    expect(result[1].simpleOverframe?.image).toBe(imageA);
    expect(result[1].simpleOverframe?.layout).toEqual(cards[1].simpleOverframe!.layout);
    expect(result[1].simpleOverframe?.finishEnabled).toBe(true);
    expect(result[1].simpleOverframe?.finishStyle).toBe("xyz");
    expect(result[1].artwork).toBe("");
    expect(validateCards(result,false)).toEqual([]);
  });
  it("미선택 카드·없는 ID는 적용하지 않으며 원화 슬롯을 격리",()=>{
    const plan=planHubImageAssignments(cards,{
      [cards[0].id]:imageB,[cards[1].id]:imageA,[999999999]:imageA,
    },[cards[1].id],"normal",true);
    expect(plan.patches).toEqual([{id:cards[1].id,artwork:imageA}]);
    expect(plan.skippedNotSelected).toEqual([cards[0].id]);
    expect(plan.unknownIds).toEqual([999999999]);
    expect(applyHubImageAssignments(cards,plan)[0]).toEqual(cards[0]);
  });
  it("매칭 데이터가 손상된 경우 오류 내고 기존 프로젝트 유지",()=>{
    expect(()=>planHubImageAssignments(cards,{[cards[0].id]:"http://bad.example/image"},
      [cards[0].id],"normal",true)).toThrow("형식이 올바르지");
    expect(cards[0].artwork).toBe(imageA);
  });
  it("일괄 선택 최대100·중복/없는 카드 ID 정리",()=>{
    expect(hubSelected([918760001,918760001,99999,918760003],cards))
      .toEqual([918760001,918760003]);
    const many=Array.from({length:HUB_MAX_SELECTED+1},(_,i)=>newCard(i+1));
    expect(()=>hubSelected(many.map(c=>c.id),many)).toThrow();
    expect(hubSelected([],cards)).toEqual([]);
  });
  it("고화질과 EDOPro 단독/양쪽 ZIP 경로가 서로 충돌하지 않음",()=>{
    const id=91008601;
    expect(hubOutputPath(id,"normal","original","both"))
      .toBe("고화질_일반/91008601.png");
    expect(hubOutputPath(id,"overframe","original","both"))
      .toBe("고화질_오버프레임/91008601.png");
    expect(hubOutputPath(id,"normal","edopro","normal")).toBe("pics/91008601.png");
    expect(hubOutputPath(id,"overframe","edopro","overframe")).toBe("pics/91008601.png");
    expect(hubOutputPath(id,"normal","edopro","both"))
      .toBe("EDOPro_일반/pics/91008601.png");
    expect(hubOutputPath(id,"overframe","edopro","both"))
      .toBe("EDOPro_오버프레임/pics/91008601.png");
    expect(DEFAULT_HUB_OUTPUT).toEqual({mode:"both",resolution:"original",fit:"crop"});
  });
  it("CDB·JSON 재가져오기 시 3:4 편집본·일반 원화 보존",()=>{
    const hybrid={...cards[0],simpleOverframe:{...DEFAULT_SIMPLE_OVERFRAME,image:imageB},
      previewMode:"overframe" as const};
    const imported=parseImport([hybrid])[0];
    expect(imported.artwork).toBe(imageA);
    const cdbUpdated={...newCard(hybrid.id),name:"카드 정보 수정",theme:"가져온 테마"};
    const merged=mergeCards([hybrid],[cdbUpdated])[0];
    expect(merged.name).toBe("카드 정보 수정");
    expect(merged.artwork).toBe(imageA);
    expect(merged.simpleOverframe).toEqual(hybrid.simpleOverframe);
    expect(merged.previewMode).toBe("overframe");
  });
});
