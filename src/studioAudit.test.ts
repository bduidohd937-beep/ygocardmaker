import { describe, expect, it } from "vitest";
import { newCard } from "./model";
import { setActivePack } from "./assetPack";
import { DEFAULT_SIMPLE_OVERFRAME } from "./simpleOverframe";
import { auditCardProduction, auditStudioProduction } from "./studioAudit";

const art="data:image/png;base64,AA==";
function artCard(id:number){
  return {...newCard(id,"오션테일"), artwork:art};
}
function fullCard(id:number){
  return {...artCard(id),simpleOverframe:{
    ...DEFAULT_SIMPLE_OVERFRAME,image:art,showName:false,showAttribute:false,
    showLevel:false,showEffectBox:false,showEffectText:false,
    showStats:false,showTypeLine:false,
  }};
}
describe("V4.1 출력 전 자동 검수",()=>{
  it("일반 카드만 보유한 카드는 단독 출력 준비, 양쪽 출력 미완성",()=>{
    setActivePack(null);
    const card=artCard(91008601);
    const normal=auditCardProduction(card,"normal");
    expect(normal.ready).toBe(true);
    expect(normal.complete).toBe(true);
    const both=auditCardProduction(card,"both");
    expect(both.ready).toBe(true);
    expect(both.complete).toBe(false);
    expect(both.variants[1].issues.join("/")).toContain("오버프레임 원화");
  });
  it("오버프레임만 있는 카드는 원본 카드 출력 누락을 별도 보고",()=>{
    setActivePack(null);
    const card={...fullCard(91008602),artwork:""};
    const both=auditCardProduction(card,"both");
    expect(both.ready).toBe(true);
    expect(both.complete).toBe(false);
    expect(both.variants[0].ready).toBe(false);
    expect(both.variants[1].ready).toBe(true);
  });
  it("검수 모드는 필요한 출력 형태만 검사한다",()=>{
    setActivePack(null);
    const mixed=fullCard(91008603);
    const both=auditStudioProduction([mixed],[mixed.id,mixed.id],"both");
    expect(both.cards).toHaveLength(1);
    expect(both.outputsReady).toBe(2);
    expect(both.outputsMissing).toBe(0);
    expect(both.readyCards).toEqual([mixed.id]);
    expect(both.incompleteCards).toEqual([]);
  });
  it("아무 원화도 없는 카드는 출력 가능 목록에서 제외된다",()=>{
    setActivePack(null);
    const card=newCard(91008604,"테마");
    const audit=auditStudioProduction([card],[card.id,999999999],"both");
    expect(audit.readyCards).toEqual([]);
    expect(audit.incompleteCards).toEqual([card.id]);
    expect(audit.blockedCards).toEqual([card.id]);
    expect(audit.outputsReady).toBe(0);
    expect(audit.outputsMissing).toBe(2);
  });
  it("원화·에셋 누락 및 카드 메타데이터 오류를 구분한다",()=>{
    setActivePack(null);
    const card={...fullCard(91008605),name:""};
    const result=auditCardProduction(card,"both");
    expect(result.complete).toBe(false);
    expect(result.ready).toBe(false);
    expect(result.variants[0].issues.some(x=>x.includes("카드명 누락"))).toBe(true);
    expect(result.variants[1].issues.some(x=>x.includes("카드명 누락"))).toBe(true);
    const withAssets={...fullCard(91008606),simpleOverframe:{
      ...DEFAULT_SIMPLE_OVERFRAME,image:art,showName:true,
    }};
    const asset=auditCardProduction(withAssets,"overframe");
    expect(asset.variants[0].issues.join("")).toContain("자산팩 누락");
    expect(asset.variants[0].primaryAction).toBe("assets");
  });
  it("정상 출력과 누락 출력을 카드/이미지 유형별로 정확하게 집계한다",()=>{
    setActivePack(null);
    const list=[artCard(91008607),fullCard(91008608),newCard(91008609)];
    const audit=auditStudioProduction(list,list.map(c=>c.id),"both");
    expect(audit.readyCards).toEqual([91008607,91008608]);
    expect(audit.incompleteCards).toEqual([91008607,91008609]);
    expect(audit.blockedCards).toEqual([91008609]);
    expect(audit.outputsReady).toBe(3);
    expect(audit.outputsMissing).toBe(3);
  });
});
