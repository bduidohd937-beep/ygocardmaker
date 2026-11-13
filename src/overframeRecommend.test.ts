import { describe, expect, it } from "vitest";
import { DEFAULT_SIMPLE_OVERFRAME, validSimpleOverframe } from "./simpleOverframe";
import { newCard, parseImport, mergeCards } from "./model";
import { batchCardConfig, DEFAULT_BATCH_SETTINGS } from "./batchOverframe";
import { regionReadability, recommendLayoutChoices,
  type ArtPixelSample } from "./overframeRecommend";
import { validOverframeLayout } from "./overframeLayout";

const basic={...DEFAULT_SIMPLE_OVERFRAME};
const makeArt=(fn:(x:number,y:number)=>number):ArtPixelSample=>{
  const width=180,height=240;
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const value=fn(x,y);
    const p=(y*width+x)*4;
    data[p]=data[p+1]=data[p+2]=value;data[p+3]=255;
  }
  return {width,height,data};
};
describe("V3.7 원화 구도·카드 정보별 레이아웃 추천",()=>{
  const info={frame:"xyz" as const,level:8,name:"장엄한 엑시즈 군주",effect:"① 상대 효과를 무효로 한다."};
  it("기본형/중앙형/하단형 세 가지 유효한 레이아웃을 순위로 보여준다",()=>{
    const output=recommendLayoutChoices(info,basic);
    expect(output).toHaveLength(3);
    expect(new Set(output.map(x=>x.key)).size).toBe(3);
    expect(output.map(x=>x.score)).toEqual([...output.map(x=>x.score)].sort((a,b)=>b-a));
    output.forEach(item=>{
      expect(validOverframeLayout(item.layout)).toBe(true);
      expect(item.reason).toContain("카드 정보 기준 추천");
    });
  });
  it("원화의 밝기와 윤곽선 밀도를 실제로 평가한다",()=>{
    const black=makeArt(()=>16);
    const white=makeArt(()=>235);
    const striped=makeArt((x,y)=>(x%4<2 || y%4<2)?0:255);
    const rect={x:36,y:36,w:400,h:70};
    const darkScore=regionReadability(black,rect);
    const lightScore=regionReadability(white,rect);
    const patterned=regionReadability(striped,rect);
    expect(darkScore.brightness).toBeLessThan(lightScore.brightness);
    expect(patterned.detail).toBeGreaterThan(darkScore.detail);
    const rec=recommendLayoutChoices(info,basic,striped);
    expect(rec).toHaveLength(3);
    expect(rec[0].reason).toContain("원화의 밝기·윤곽선 밀도 분석 반영");
    expect(rec.map(x=>x.score)).toEqual([...rec.map(x=>x.score)].sort((a,b)=>b-a));
  });
  it("효과문이 길면 효과창 공간이 부족한 후보의 우선순위가 내려간다",()=>{
    const long="이 카드가 특수 소환되었을 경우에 발동할 수 있다. 상대 필드의 카드를 전부 제외한다.".repeat(10);
    const rec=recommendLayoutChoices({...info,effect:long},{
      ...basic,showEffectText:true,showEffectBox:true,
    });
    const base=rec.find(x=>x.key==="기본")!;
    const bottom=rec.find(x=>x.key==="상단 여백형")!;
    expect(base.score).toBeGreaterThan(bottom.score);
  });
  it("분석 결과와 다른 카드 정보에 따라 순위는 결정적이다",()=>{
    const art=makeArt((x,y)=>y>180?(x%6<3?230:15):25);
    const a=recommendLayoutChoices(info,basic,art);
    const b=recommendLayoutChoices(info,basic,art);
    expect(a).toEqual(b);
    expect(a).not.toBe(recommendLayoutChoices(info,basic));
  });
  it("기존 카드의 레이아웃·프리셋을 자동으로 덮어쓰지 않는다",()=>{
    const card={...newCard(918760001),simpleOverframe:{
      ...basic,image:"data:image/png;base64,AA==",
      layout:{effect:{x:40,y:950,w:810,h:202}},
      savedPresets:[{name:"내 레이아웃",layout:{effect:{x:40,y:950,w:810,h:202}}}],
    }};
    const before=JSON.stringify(card);
    const choices=recommendLayoutChoices(card,card.simpleOverframe);
    expect(choices.length).toBe(3);
    expect(JSON.stringify(card)).toBe(before);
    expect(validSimpleOverframe(card.simpleOverframe)).toBe(true);
    expect(parseImport([card])[0].simpleOverframe).toEqual(card.simpleOverframe);
    expect(mergeCards([card],[{...newCard(card.id),name:"업데이트"}])[0].simpleOverframe)
      .toEqual(card.simpleOverframe);
  });
  it("일괄 제작 추천은 별도 저장 전에는 원본 레이아웃을 바꾸지 않는다",()=>{
    const card={...newCard(918760002),frame:"fusion" as const,
      effect:"효과문",
      simpleOverframe:{...basic,image:"data:image/png;base64,AA==",
        layout:{effect:{x:38,y:905,w:820,h:260}}}};
    const before=JSON.stringify(card);
    const result=batchCardConfig(card,{}, {...DEFAULT_BATCH_SETTINGS,layout:"recommend"});
    expect(validOverframeLayout(result.layout)).toBe(true);
    expect(JSON.stringify(card)).toBe(before);
    expect(result.image).toBe(card.simpleOverframe.image);
    expect(result.effectStyle).toBe(card.simpleOverframe.effectStyle);
  });
  it("잘못된 픽셀 길이는 분석 전에 검증한다",()=>{
    const invalid:ArtPixelSample={width:180,height:240,data:new Uint8ClampedArray(4)};
    expect(()=>regionReadability(invalid,{x:0,y:0,w:100,h:100})).toThrow();
  });
});
