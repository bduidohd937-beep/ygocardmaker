import { describe, expect, it } from "vitest";
import { newCard, parseImport, mergeCards, validateCards } from "./model";
import { DEFAULT_SIMPLE_OVERFRAME } from "./simpleOverframe";
import {
  compareAvailability, availableComparisonModes, currentPreviewMode,
  compareFilename, DEFAULT_COMPARE_EXPORT,
} from "./cardCompare";

const png="data:image/png;base64,AA==";
describe("V3.8 일반 카드 ↔ 3:4 오버프레임 비교·전환",()=>{
  it("일반 카드 기본 보기 유지 및 레거시 카드 JSON/프로젝트 가져오기 호환",()=>{
    const legacy={...newCard(91008601),artwork:png};
    delete (legacy as {previewMode?: string}).previewMode;
    expect(currentPreviewMode(legacy)).toBe("normal");
    expect(parseImport([legacy])[0].previewMode).toBeUndefined();
    expect(validateCards([legacy])).toEqual([]);
  });
  it("일반 카드 원화와 3:4 오버프레임 원화를 서로 덮어쓰지 않는다",()=>{
    const card={...newCard(918760001),artwork:png,
      simpleOverframe:{...DEFAULT_SIMPLE_OVERFRAME,image:png,
        showName:false,showAttribute:false,showLevel:false,
        showEffectText:false,showEffectBox:false}};
    const original=JSON.stringify(card);
    expect(compareAvailability(card)).toEqual({normal:[],overframe:[]});
    expect(availableComparisonModes(card)).toEqual({normal:true,overframe:true});
    const swapped={...card,previewMode:"overframe" as const};
    expect(currentPreviewMode(swapped)).toBe("overframe");
    expect(swapped.artwork).toBe(card.artwork);
    expect(swapped.simpleOverframe.image).toBe(card.simpleOverframe.image);
    expect(JSON.stringify(card)).toBe(original);
    const imported=parseImport([swapped])[0];
    expect(imported.previewMode).toBe("overframe");
    expect(imported.simpleOverframe).toEqual(swapped.simpleOverframe);
    expect(imported.artwork).toBe(swapped.artwork);
    const merged=mergeCards([swapped],[newCard(918760001)])[0];
    expect(merged.previewMode).toBe("overframe");
    expect(merged.simpleOverframe).toEqual(swapped.simpleOverframe);
    expect(merged.artwork).toBe(swapped.artwork);
  });
  it("오버프레임 미저장 카드는 전환 시 안전하게 일반 카드 미리보기로 복귀",()=>{
    const card={...newCard(),artwork:png,previewMode:"overframe" as const};
    expect(currentPreviewMode(card)).toBe("normal");
    expect(compareAvailability(card).overframe).toContain("3:4 오버프레임 원화를 먼저 저장하세요.");
    expect(availableComparisonModes(card).overframe).toBe(false);
    expect(availableComparisonModes(card).normal).toBe(true);
  });
  it("일반 일러스트 누락은 개별 진단하고 오버프레임 출력은 별도 허용",()=>{
    const card={...newCard(),artwork:"",
      simpleOverframe:{...DEFAULT_SIMPLE_OVERFRAME,image:png,
        showName:false,showAttribute:false,showLevel:false,
        showEffectText:false,showEffectBox:false}};
    expect(compareAvailability(card).normal).toContain("일반 카드 일러스트가 없습니다.");
    expect(compareAvailability(card).overframe).toEqual([]);
    expect(availableComparisonModes(card)).toEqual({normal:false,overframe:true});
  });
  it("출력 ZIP 경로·고화질·EDOPro 단독 출력 파일명이 충돌하지 않는다",()=>{
    const card=newCard(918760004);
    expect(compareFilename(card,"normal","original")).toBe("고화질/일반카드/918760004.png");
    expect(compareFilename(card,"overframe","original")).toBe("고화질/오버프레임_3대4/918760004.png");
    expect(compareFilename(card,"normal","edopro")).toBe("pics/918760004_일반.png");
    expect(compareFilename(card,"overframe","edopro")).toBe("pics/918760004_오버프레임.png");
    expect(DEFAULT_COMPARE_EXPORT).toEqual({
      choice:"both",size:"original",edoFit:"crop",
    });
  });
  it("비정상 미리보기 모드 JSON 값은 차단하며 기존 CDB 병합 시 보존한다",()=>{
    const card={...newCard(),artwork:png};
    for(const previewMode of ["abc",null,42]) {
      const bad={...card,previewMode};
      expect(validateCards([bad as typeof card])).not.toEqual([]);
      expect(()=>parseImport([bad])).toThrow();
    }
    expect(validateCards([{...card,previewMode:"normal"}])).toEqual([]);
  });
});
