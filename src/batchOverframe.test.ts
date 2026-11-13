import { describe, expect, it } from "vitest";
import { newCard } from "./model";
import { DEFAULT_SIMPLE_OVERFRAME } from "./simpleOverframe";
import {
  BATCH_MAX_CARDS, DEFAULT_BATCH_SETTINGS, batchCardConfig,
  batchCardIssues, edoRects, ensureValidBatchSelection,
  filenameCardId,
} from "./batchOverframe";
const cards = [
  {...newCard(918760001,"아칠리쉬"),name:"첫 번째"},
  {...newCard(918760002,"아칠리쉬"),name:"두 번째",frame:"xyz" as const},
];
const data = "data:image/png;base64,AA==";
describe("오버프레임 V3.6 이미지 자동 매칭과 일괄 출력",()=>{
  it("카드 ID 파일명만 자동 연결하고 경로·접미사·확장자를 안전하게 해석한다",()=>{
    expect(filenameCardId("918760001.png")).toBe(918760001);
    expect(filenameCardId("원화/918760002_오버프레임.JPG")).toBe(918760002);
    expect(filenameCardId("images\\918760001-원본.webp")).toBe(918760001);
    expect(filenameCardId("918760001(1).png")).toBe(918760001);
    for (const name of ["배경.png","abc918760001.png","0.png","4294967296.png",
      "918760001.png.exe","918760001.txt","card_918760001.png"])
      expect(filenameCardId(name)).toBe(null);
  });
  it("3:4 이미지를 EDOPro 규격으로 무왜곡 자르기/여백을 계산한다",()=>{
    const crop=edoRects(1500,2000,"crop");
    expect(crop.sw/crop.sh).toBeCloseTo(421/614,8);
    expect(crop.dw).toBe(421);
    expect(crop.dh).toBe(614);
    expect(crop.sx).toBeGreaterThan(0);
    const pad=edoRects(1500,2000,"pad");
    expect(pad.sw).toBe(1500);
    expect(pad.sh).toBe(2000);
    expect(pad.dw/pad.dh).toBeCloseTo(1500/2000,8);
    expect(pad.dy).toBeGreaterThan(0);
    expect(pad.dx).toBe(0);
    expect(edoRects(600,1200,"crop").sh).toBeLessThan(1200);
    expect(edoRects(600,1200,"pad").dx).toBeGreaterThan(0);
    expect(()=>edoRects(0,1200,"crop")).toThrow();
  });
  it("선택 카드 범위를 1~100장과 존재하는 ID로 한정한다",()=>{
    expect(ensureValidBatchSelection([918760001,918760001,918760002],cards))
      .toEqual([918760001,918760002]);
    expect(()=>ensureValidBatchSelection([],cards)).toThrow();
    expect(()=>ensureValidBatchSelection([888888888],cards)).toThrow();
    const many=Array.from({length:BATCH_MAX_CARDS+1},(_,i)=>newCard(100+i));
    expect(()=>ensureValidBatchSelection(many.map(c=>c.id),many)).toThrow();
  });
  it("개별 설정 유지 모드가 기존 카드와 원화 데이터를 변경하지 않는다",()=>{
    const card={...cards[0],simpleOverframe:{...DEFAULT_SIMPLE_OVERFRAME,
      image:data,layout:{effect:{x:40,y:940,w:810,h:200}},
      panelTint:"charcoal" as const,finishEnabled:true,finishStyle:"xyz" as const,
    }};
    const before=JSON.stringify(card);
    const keep=batchCardConfig(card,{},DEFAULT_BATCH_SETTINGS);
    expect(keep.layout).toEqual(card.simpleOverframe.layout);
    expect(keep.finishEnabled).toBe(true);
    expect(keep.panelTint).toBe("charcoal");
    expect(JSON.stringify(card)).toBe(before);
    const matched=batchCardConfig(card,{[card.id]:"data:image/png;base64,BB=="},DEFAULT_BATCH_SETTINGS);
    expect(matched.image).toContain("BB==");
    expect(card.simpleOverframe.image).toBe(data);
  });
  it("레이아웃·광택 공통 프리셋은 배치 설정에만 적용한다",()=>{
    const orig=JSON.stringify(cards[1]);
    const cfg=batchCardConfig(cards[1],{[cards[1].id]:data},
      {...DEFAULT_BATCH_SETTINGS,layout:"bottom",finish:"auto"});
    expect(cfg.layout?.effect?.y).toBe(1010);
    expect(cfg.finishEnabled).toBe(true);
    expect(cfg.finishStyle).toBe("xyz");
    expect(JSON.stringify(cards[1])).toBe(orig);
    const off=batchCardConfig({...cards[1],simpleOverframe:cfg},{},
      {...DEFAULT_BATCH_SETTINGS,finish:"off"});
    expect(off.finishEnabled).toBe(false);
    expect(off.layout).toEqual(cfg.layout);
  });
  it("원화 누락을 판정하고 일반 카드 원화 대체는 명시적으로만 허용한다",()=>{
    const empty=batchCardConfig(cards[0],{},DEFAULT_BATCH_SETTINGS);
    expect(batchCardIssues(cards[0],empty)).toContain("3:4 원화 없음");
    const fallback=batchCardConfig({...cards[0],artwork:data},{},
      {...DEFAULT_BATCH_SETTINGS,fallbackArtwork:true});
    expect(fallback.image).toBe(data);
    const noFallback=batchCardConfig({...cards[0],artwork:data},{},DEFAULT_BATCH_SETTINGS);
    expect(noFallback.image).toBe("");
  });
});
