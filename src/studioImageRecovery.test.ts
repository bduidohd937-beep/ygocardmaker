import {describe,it,expect} from "vitest";
import {newCard} from "./model";
import {DEFAULT_SIMPLE_OVERFRAME} from "./simpleOverframe";
import {applyHubImageAssignments,planHubImageAssignments} from "./studioHub";
import {captureHubImageUndo,restoreHubImages,selectImageCards} from "./studioImageRecovery";

const artA="data:image/png;base64,AA==",artB="data:image/png;base64,BB==";
const cards=[
  {...newCard(918760001,"테마"),artwork:artA},
  {...newCard(918760002,"테마"),simpleOverframe:{...DEFAULT_SIMPLE_OVERFRAME,image:artA}},
  {...newCard(918760003,"테마")},
];
describe("V4.3 누락 원화·ID 매칭 대상 선택",()=>{
  it("일반/3:4 원화 누락은 서로 독립적으로 검사한다",()=>{
    expect(selectImageCards(cards,"normal","missing")).toEqual({
      ids:[918760002,918760003],total:2,
    });
    expect(selectImageCards(cards,"overframe","missing")).toEqual({
      ids:[918760001,918760003],total:2,
    });
  });
  it("ZIP 매칭된 ID만 선택하고 목록 순서와 100장 제한을 지킨다",()=>{
    const ids=selectImageCards(cards,"normal","matched",
      {918760003:artA,918760001:artB,999999:artA});
    expect(ids).toEqual({ids:[918760001,918760003],total:2});
    const many=Array.from({length:115},(_,i)=>newCard(918770001+i));
    const result=selectImageCards(many,"normal","missing");
    expect(result.ids).toHaveLength(100);
    expect(result.total).toBe(115);
  });
});
describe("V4.3 적용한 원화 되돌리기",()=>{
  it("일반 카드 덮어쓰기 후 이전 원화·크롭·위치 설정을 복원한다",()=>{
    const start={...cards[0],zoom:1.7,offsetX:5,offsetY:-3,
      artCrop:{x:0.1,y:0.15,w:0.7,h:0.7}};
    const plan=planHubImageAssignments([start],{[start.id]:artB},[start.id],"normal",true);
    const undo=captureHubImageUndo([start],plan);
    const changed=applyHubImageAssignments([start],plan);
    expect(changed[0].artCrop).toBeUndefined();
    expect(changed[0].artwork).toBe(artB);
    const restored=restoreHubImages(changed,undo);
    expect(restored.restored).toEqual([start.id]);
    expect(restored.cards[0]).toEqual(start);
    expect(start.artwork).toBe(artA);
  });
  it("3:4를 신규 추가했다가 되돌리면 원본 슬롯을 삭제한다",()=>{
    const c=cards[0];
    const plan=planHubImageAssignments([c],{[c.id]:artB},[c.id],"overframe");
    const undo=captureHubImageUndo([c],plan);
    const applied=applyHubImageAssignments([c],plan);
    expect(applied[0].simpleOverframe?.image).toBe(artB);
    const restored=restoreHubImages(applied,undo);
    expect(restored.cards[0]).toEqual(c);
    expect(restored.restored).toEqual([c.id]);
    expect(restored.cards[0].artwork).toBe(artA);
  });
  it("기존 오버프레임 교체 후 레이아웃·광택까지 원상 복원한다",()=>{
    const c=cards[1];
    const plan=planHubImageAssignments([c],{[c.id]:artB},[c.id],"overframe",true);
    const undo=captureHubImageUndo([c],plan);
    const restored=restoreHubImages(applyHubImageAssignments([c],plan),undo);
    expect(restored.cards[0]).toEqual(c);
    expect(restored.skipped).toEqual([]);
  });
  it("적용 뒤 사용자가 수정한 원화·크롭은 절대 덮어쓰지 않는다",()=>{
    const c=cards[0];
    const plan=planHubImageAssignments([c],{[c.id]:artB},[c.id],"normal",true);
    const undo=captureHubImageUndo([c],plan);
    const applied=applyHubImageAssignments([c],plan);
    const later={...applied[0],offsetX:0.3};
    const result=restoreHubImages([later],undo);
    expect(result.skipped).toEqual([c.id]);
    expect(result.cards[0]).toBe(later);
    const changedImage={...applied[0],artwork:artA};
    expect(restoreHubImages([changedImage],undo).skipped).toEqual([c.id]);
  });
  it("무관한 정보·다른 카드는 보존하며 이전 원화 없는 경우 빈 슬롯으로 되돌린다",()=>{
    const c=cards[2];
    const plan=planHubImageAssignments([c],{[c.id]:artA},[c.id],"normal");
    const undo=captureHubImageUndo([c],plan);
    const applied=applyHubImageAssignments(cards,plan);
    const after=applied.map(x=>x.id===c.id?{...x,name:"새 이름"}:x);
    const result=restoreHubImages(after,undo);
    expect(result.cards[2].artwork).toBe("");
    expect(result.cards[2].name).toBe("새 이름");
    expect(result.cards[0]).toBe(cards[0]);
    expect(result.cards[1]).toBe(cards[1]);
  });
  it("삭제된 카드 복원은 건너뛰고 새로운 카드를 만들어내지 않는다",()=>{
    const c=cards[2];
    const plan=planHubImageAssignments([c],{[c.id]:artA},[c.id],"normal");
    const undo=captureHubImageUndo([c],plan);
    const result=restoreHubImages([],undo);
    expect(result).toEqual({cards:[],restored:[],skipped:[c.id]});
  });
});
