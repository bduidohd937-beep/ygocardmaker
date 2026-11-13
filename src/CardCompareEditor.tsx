import { useEffect, useState } from "react";
import { Check, Download, Images, RotateCcw, X } from "lucide-react";
import type { Card, CardPreviewMode } from "./model";
import {
  compareAvailability, currentPreviewMode, makeCompareZip, renderCardVariant,
  renderCompareExport, type CompareExportChoice, type CompareExportSize,
  type CompareExportSettings, DEFAULT_COMPARE_EXPORT,
} from "./cardCompare";
import { download } from "./export";

interface Props {
  card: Card;
  onClose: () => void;
  onPrefer: (mode: CardPreviewMode) => void;
  onEditFullArt: () => void;
}
const modes: {mode:CardPreviewMode;title:string;caption:string;size:string}[]=[
  {mode:"normal",title:"일반 OCG 카드",caption:"일반 프레임·기존 일러스트·정밀 오버프레임",size:"1263 × 1842"},
  {mode:"overframe",title:"3:4 오버프레임",caption:"원화 한 장·정식 속성/레벨 에셋·효과창",size:"1500 × 2000"},
];
export function CardCompareEditor({card,onClose,onPrefer,onEditFullArt}: Props){
  const [focused,setFocused]=useState<CardPreviewMode>(currentPreviewMode(card));
  const [exportSettings,setExportSettings]=useState<CompareExportSettings>(DEFAULT_COMPARE_EXPORT);
  const [previews,setPreviews]=useState<Partial<Record<CardPreviewMode,string>>>({});
  const [errors,setErrors]=useState<Partial<Record<CardPreviewMode,string>>>({});
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  const available=compareAvailability(card);
  useEffect(()=>{
    let live=true;
    setPreviews({});setErrors({});
    void Promise.all(modes.map(async({mode})=>{
      if(available[mode].length){
        if(live)setErrors(s=>({...s,[mode]:available[mode].join(" / ")}));
        return;
      }
      try {
        const canvas=document.createElement("canvas");
        await renderCardVariant(card,canvas,mode,mode==="normal"?421:450);
        if(live)setPreviews(s=>({...s,[mode]:canvas.toDataURL("image/png")}));
      }catch(e){
        if(live)setErrors(s=>({...s,[mode]:e instanceof Error?e.message:"렌더링 오류"}));
      }
    }));
    return()=>{live=false};
  },[card]);
  const switchChoice=(choice:CompareExportChoice)=>{
    setExportSettings(s=>({...s,choice}));
    if(choice!=="both")setFocused(choice);
    setError("");
  };
  const savePreference=()=>{
    if(available[focused].length || errors[focused]){
      setError("선택한 미리보기의 원화·자산팩을 먼저 확인하세요.");
      return;
    }
    onPrefer(focused);
    setStatus("카드 작업실 기본 미리보기를 '"+(focused==="normal"?"일반 카드":"3:4 오버프레임")+"'로 저장했습니다.");
    setError("");
  };
  const runDownload=async()=>{
    if(busy)return;
    setBusy(true);setError("");setStatus("");
    try{
      const {choice,size,edoFit}=exportSettings;
      if(choice==="both"){
        const zip=await makeCompareZip(card,exportSettings);
        download(zip,`카드비교_${card.id}.zip`);
      }else{
        const blob=await renderCompareExport(card,choice,size,edoFit);
        download(blob,`${card.id}_${choice==="normal"?"일반":"오버프레임"}_${size==="original"?"고화질":"EDOPro"}.png`);
      }
      setStatus("선택한 카드 이미지 다운로드를 시작했습니다.");
    }catch(e){setError(e instanceof Error?e.message:"다운로드에 실패했습니다.");}
    finally{setBusy(false);}
  };
  return <div className="modal-backdrop compare-card-backdrop">
    <section role="dialog" aria-modal="true" aria-labelledby="card-compare-title" className="compare-card-modal">
      <header className="simple-of-header">
        <div>
          <span className="eyebrow">YGO STUDIO · COMPARE V3.8</span>
          <h2 id="card-compare-title">일반 카드 ↔ 오버프레임 비교·전환</h2>
          <p>{card.name} · {card.id} · 원화와 카드 정보는 서로 덮어쓰지 않습니다.</p>
        </div>
        <button type="button" aria-label="비교 화면 닫기" disabled={busy} onClick={onClose}><X size={18}/></button>
      </header>
      <div className="compare-card-body">
        <div className="compare-card-panels">
          {modes.map(({mode,title,caption,size})=>{
            const selected=focused===mode,problem=errors[mode];
            return <section className={"compare-card-side"+(selected?" selected":"")} key={mode}>
              <div className="compare-card-side-title">
                <div><strong>{title}</strong><small>{caption}</small></div>
                <span>{size}</span>
              </div>
              <div className="compare-card-art">
                {previews[mode]?<img alt={title+" 비교 미리보기"} src={previews[mode]}/>:
                  <div className="compare-card-placeholder">{problem||"카드 렌더링 중…"}</div>}
              </div>
              <button type="button" aria-label={title+" 미리보기 선택"} className={selected?"compare-card-choose active":"compare-card-choose"}
                disabled={!!problem} onClick={()=>setFocused(mode)}>
                {selected?<Check size={14}/>:<Images size={14}/>}
                {selected?"선택된 미리보기":"이 미리보기 선택"}
              </button>
            </section>;
          })}
        </div>
        <aside className="compare-card-actions">
          <div className="simple-of-group">
            <strong>01 · 기본 미리보기 전환</strong>
            <small>현재 카드의 작업실 기본 보기: {currentPreviewMode(card)==="normal"?"일반 카드":"3:4 오버프레임"}</small>
            <p>위 두 미리보기 중 하나를 선택한 후 저장하면 다음에도 그 방식으로 카드를 보여줍니다. 원화와 프레임은 바뀌지 않습니다.</p>
            <button type="button" disabled={!previews[focused]} onClick={savePreference}>
              <Check size={15}/> 선택한 형태를 기본 미리보기로 저장
            </button>
            <button type="button" className="simple-of-subtle" onClick={onEditFullArt}>3:4 오버프레임 편집 열기</button>
          </div>
          <div className="simple-of-group">
            <strong>02 · PNG/ZIP 출력</strong>
            <label>출력할 형태
              <select aria-label="비교 출력할 형태" value={exportSettings.choice}
                onChange={e=>switchChoice(e.target.value as CompareExportChoice)}>
                <option value="both">일반 + 3:4 오버프레임 (ZIP)</option>
                <option value="normal">일반 카드만 PNG</option>
                <option value="overframe">3:4 오버프레임만 PNG</option>
              </select>
            </label>
            <label>출력 해상도
              <select aria-label="비교 출력 해상도" value={exportSettings.size}
                onChange={e=>setExportSettings(s=>({...s,size:e.target.value as CompareExportSize}))}>
                <option value="original">고화질 (1263×1842 / 1500×2000)</option>
                <option value="edopro">EDOPro (421×614)</option>
              </select>
            </label>
            {exportSettings.size==="edopro" && exportSettings.choice!=="normal" &&
              <label>오버프레임 EDOPro 비율
                <select aria-label="비교 EDOPro 비율 방식" value={exportSettings.edoFit}
                  onChange={e=>setExportSettings(s=>({...s,edoFit:e.target.value as CompareExportSettings["edoFit"]}))}>
                  <option value="crop">중앙 자르기</option>
                  <option value="pad">여백 추가 (원화 전체 보존)</option>
                </select>
              </label>}
            <small>고화질 일반 카드는 1263×1842, 오버프레임은 1500×2000입니다. EDOPro는 둘 다 421×614로 출력하되 오버프레임은 자르기/여백 추가로 비율을 맞춥니다.</small>
            <button type="button" className="simple-of-primary" disabled={busy || (
              exportSettings.choice==="both" ? !!(available.normal.length||available.overframe.length||errors.normal||errors.overframe) :
              !!(available[exportSettings.choice].length||errors[exportSettings.choice])
            )} onClick={()=>void runDownload()}>
              <Download size={15}/> {busy?"렌더링 중…":exportSettings.choice==="both"?"두 형태 비교 ZIP 다운로드":"선택한 PNG 다운로드"}
            </button>
          </div>
          <div className="simple-of-group">
            <strong>03 · 원화·자산 진단</strong>
            {modes.map(({mode,title})=><small key={mode}>
              {title}: {errors[mode]??(previews[mode]?"렌더링 준비 완료":"이미지·에셋 확인 중")}
            </small>)}
            <small>리소스 ZIP 원본 폰트와 속성·별 에셋은 변경하거나 새로 만들지 않습니다.</small>
          </div>
        </aside>
      </div>
      {!!status && <p className="simple-of-status" role="status">{status}</p>}
      {!!error && <p className="simple-of-error" role="alert">{error}</p>}
      <footer className="simple-of-footer">
        <button type="button" disabled={busy} onClick={onClose}>닫기</button>
      </footer>
    </section>
  </div>;
}
