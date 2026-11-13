import { describe, expect, it, vi } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import { matchBatchImages } from "./batchOverframe";
import { auditCardProduction, auditStudioProduction } from "./studioAudit";
import { newCard, mergeCards, parseImport, type Card } from "./model";
import { DEFAULT_SIMPLE_OVERFRAME } from "./simpleOverframe";
import { exportStudioHubZip } from "./studioHub";

const art="data:image/png;base64,AA==";
function normal(id:number):Card { return {...newCard(id),artwork:art}; }
function full(id:number):Card { return {...normal(id),simpleOverframe:{
  ...DEFAULT_SIMPLE_OVERFRAME,image:art,showName:false,showAttribute:false,
  showLevel:false,showEffectBox:false,showEffectText:false,
  showTypeLine:false,showStats:false,
}}; }
const fakeRender=vi.fn(async (card:Card, mode:"normal"|"overframe",
  _resolution:"original"|"edopro",_fit:"crop"|"pad"):Promise<Blob> =>
  new Blob([strToU8(card.id+"-"+mode)],{type:"image/png"})
);
const contents=(bytes:Uint8Array)=>new TextDecoder().decode(bytes);

describe("V4.2 실제 ZIP 가져오기 → 병합 → 검수 → ZIP 출력 통합 검증",()=>{
  it("ZIP 이미지 매칭과 JSON 카드 병합이 선택 카드와 기존 원화를 보호한다",async()=>{
    const incoming=parseImport([{id:918760001,name:"시험 카드",frame:"effect"}]);
    const preExisting=normal(918760001);
    const merged=mergeCards([preExisting],incoming);
    expect(merged[0].artwork).toBe(art);
    const zipData=zipSync({
      "원화/918760001_원화.png":strToU8("image-data-1"),
      "원화/918760099.png":strToU8("unknown-card"),
      "메모.txt":strToU8("skip"),
    });
    const zip=new File([new Uint8Array(zipData)],"원화_묶음.zip",{type:"application/zip"});
    const result=await matchBatchImages([zip],merged,async(_bytes,mime)=>{
      expect(mime).toBe("image/png");
      return art;
    });
    expect(result.matched).toBe(1);
    expect(result.images[918760001]).toBe(art);
    expect(result.warnings.join(" ")).toContain("현재 카드 목록에 없는 ID");
    expect(merged[0].artwork).toBe(art);
  });
  it("3:4 설정이 잘못돼도 정상 일반 카드는 독립적으로 출력 가능하다",()=>{
    const card={...full(918760002),simpleOverframe:{
      ...full(918760002).simpleOverframe!,effectHeight:-1,
    }};
    const audit=auditCardProduction(card,"both");
    expect(audit.variants[0].ready).toBe(true);
    expect(audit.variants[1].ready).toBe(false);
    expect(audit.ready).toBe(true);
    expect(audit.complete).toBe(false);
  });
  it("효과·카드명 등 메타데이터 오류는 최종 ZIP에서도 무조건 차단한다",async()=>{
    const card={...normal(918760003),name:""};
    const summary=auditStudioProduction([card],[card.id],"normal");
    expect(summary.blockedCards).toEqual([card.id]);
    fakeRender.mockClear();
    await expect(exportStudioHubZip([card],[card.id],
      {mode:"normal",resolution:"edopro",fit:"crop"},()=>{},undefined,fakeRender,
    )).rejects.toThrow("출력 가능한 카드가 없습니다");
    expect(fakeRender).not.toHaveBeenCalled();
  });
  it("두 형태 중 가능한 파일만 ZIP에 담고 누락 원인을 기록한다",async()=>{
    const first=normal(918760004);
    const second=full(918760005);
    fakeRender.mockClear();
    const output=await exportStudioHubZip([first,second],[first.id,second.id],
      {mode:"both",resolution:"edopro",fit:"crop"},()=>{},undefined,fakeRender);
    expect(output.report.produced).toHaveLength(3);
    expect(output.report.omitted).toHaveLength(1);
    const zipped=unzipSync(new Uint8Array(await output.blob.arrayBuffer()));
    expect(Object.keys(zipped)).toContain("EDOPro_일반/pics/918760004.png");
    expect(Object.keys(zipped)).toContain("EDOPro_오버프레임/pics/918760005.png");
    expect(Object.keys(zipped)).not.toContain("EDOPro_오버프레임/pics/918760004.png");
    const report=JSON.parse(contents(zipped["제작_검수보고서.json"]));
    expect(report.preflight_version).toBe("4.2");
    expect(report.skipped).toHaveLength(1);
    expect(contents(zipped["누락_및_오류.txt"])).toContain("918760004");
  });
  it("100장 대량 출력에서 선택 중복을 제거하고 파일명을 충돌 없이 보존한다",async()=>{
    const cards=Array.from({length:100},(_,i)=>normal(918770001+i));
    const selected=[cards[0].id,...cards.map(c=>c.id)];
    const result=await exportStudioHubZip(cards,selected,
      {mode:"normal",resolution:"edopro",fit:"crop"},()=>{},undefined,fakeRender);
    expect(result.report.produced).toHaveLength(100);
    const files=unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    expect(Object.keys(files).filter(p=>p.startsWith("pics/"))).toHaveLength(100);
    expect(contents(files["pics/918770100.png"])).toBe("918770100-normal");
  },20000);
  it("출력을 취소하면 ZIP을 반환하지 않는다",async()=>{
    const controller=new AbortController();
    controller.abort();
    await expect(exportStudioHubZip([normal(918760006)],[918760006],
      {mode:"normal",resolution:"original",fit:"crop"},()=>{},controller.signal,fakeRender,
    )).rejects.toThrow("취소");
  });
});
