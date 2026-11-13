import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, FileArchive, ImagePlus, Layers, Search, X } from "lucide-react";
import type { Card } from "./model";
import {
  BATCH_MAX_CARDS, DEFAULT_BATCH_SETTINGS, batchCardConfig, batchCardIssues,
  ensureValidBatchSelection, exportBatchOverframes, matchBatchImages,
  type BatchSettings, type ImageMap, type BatchLayoutMode, type BatchFinishMode,
  type BatchOutputReport,
} from "./batchOverframe";
import { renderSimpleOverframe } from "./simpleOverframe";
import { download } from "./export";

interface Props {
  cards: Card[];
  initialSelected: number[];
  onClose: () => void;
  onApply: (updates: { id: number; config: NonNullable<Card["simpleOverframe"]> }[]) => void;
  onEditCard: (id: number) => void;
}
const layoutOptions: {value: BatchLayoutMode;label: string}[] = [
  {value:"keep",label:"각 카드별 기존 배치 유지 (기본)"},
  {value:"recommend",label:"V3.7 카드 정보 기준 자동 추천 배치"},
  {value:"default",label:"기본 OCG형으로 일괄 변경"},
  {value:"center",label:"중앙 일러스트형으로 일괄 변경"},
  {value:"bottom",label:"하단 효과창형으로 일괄 변경"},
];
const finishOptions: {value: BatchFinishMode;label: string}[] = [
  {value:"keep",label:"각 카드별 기존 광택 유지"},
  {value:"off",label:"광택 전체 OFF"},
  {value:"auto",label:"카드 종류별 광택 추천"},
];

export function BatchOverframeEditor({cards,initialSelected,onClose,onApply,onEditCard}: Props) {
  const known = useMemo(()=>new Set(cards.map(c=>c.id)),[cards]);
  const [checked,setChecked] = useState<number[]>(()=>
    [...new Set(initialSelected.filter(id=>known.has(id)))].slice(0,BATCH_MAX_CARDS));
  const [search,setSearch] = useState("");
  const [settings,setSettings] = useState<BatchSettings>({...DEFAULT_BATCH_SETTINGS});
  const [images,setImages] = useState<ImageMap>({});
  const [imageWarnings,setImageWarnings] = useState<string[]>([]);
  const [previews,setPreviews] = useState<Record<number,string>>({});
  const [error,setError] = useState("");
  const [status,setStatus] = useState("");
  const [importing,setImporting] = useState(false);
  const [exporting,setExporting] = useState(false);
  const [report,setReport] = useState<BatchOutputReport | null>(null);
  const [page,setPage] = useState(0);
  const input=useRef<HTMLInputElement>(null);
  const abort=useRef<AbortController | null>(null);
  const selected=new Set(checked);
  const filtered=useMemo(()=>cards.filter(c=>{
    const q=search.trim().toLowerCase();
    return !q || String(c.id).includes(q) ||
      c.name.toLowerCase().includes(q) || c.theme.toLowerCase().includes(q);
  }),[cards,search]);
  const selectedCards=useMemo(()=>checked.map(id=>cards.find(c=>c.id===id))
    .filter((c):c is Card=>!!c),[checked,cards]);
  const cardRows=useMemo(()=>selectedCards.map(card=>{
    const config=batchCardConfig(card,images,settings);
    return {card,config,issues:batchCardIssues(card,config),
      origin:images[card.id] ? "신규 원화" : card.simpleOverframe?.image ?
        "저장된 오버프레임" : settings.fallbackArtwork && card.artwork ?
        "일반 카드 원화 (중앙 자르기)" : "원화 없음"};
  }),[selectedCards,images,settings]);
  const ready=cardRows.filter(x=>!x.issues.length);
  const omitted=cardRows.filter(x=>!!x.issues.length);
  const previewCards=ready.slice(page*8,page*8+8);
  const allPages=Math.max(1,Math.ceil(ready.length/8));

  useEffect(()=>{
    let live=true;
    setPreviews({});
    void Promise.all(previewCards.map(async row=>{
      try {
        const canvas=document.createElement("canvas");
        await renderSimpleOverframe(canvas,row.config,row.card.name,row.card.attribute,
          row.card.effect,225,row.card.frame,row.card.level,
          {race:row.card.race,atk:row.card.atk,def:row.card.def});
        if(live)setPreviews(prev=>({...prev,[row.card.id]:canvas.toDataURL("image/png")}));
      } catch { /* The missing resources are reported in each card's issues. */ }
    }));
    return()=>{live=false;};
    // Page only depends on selected cards and applied settings.
  },[page,selectedCards,images,settings]);

  useEffect(()=>{if(page>=allPages)setPage(0)},[allPages,page]);
  useEffect(()=>()=>{abort.current?.abort()},[]);

  const toggle=(id:number)=>{
    setError("");
    if(selected.has(id))setChecked(ids=>ids.filter(x=>x!==id));
    else if(checked.length>=BATCH_MAX_CARDS)setError("한 번에 최대 100장까지 선택할 수 있습니다.");
    else setChecked(ids=>[...ids,id]);
  };
  const chooseVisible=()=>{
    setChecked(prev=>[...new Set([...prev,...filtered.map(c=>c.id)])].slice(0,BATCH_MAX_CARDS));
  };
  const importImages=async(files:FileList|null)=>{
    if(!files?.length)return;
    setImporting(true);setError("");setStatus("카드 ID와 원화 파일명을 대조 중...");
    try {
      const result=await matchBatchImages(Array.from(files),cards);
      setImages(prev=>({...prev,...result.images}));
      setImageWarnings(result.warnings);
      setReport(null);
      setStatus(result.matched+"장 자동 매칭 · "+result.ignored+"건 제외. 기존 카드 데이터는 변경되지 않았습니다.");
    } catch(e){setError(e instanceof Error?e.message:"원화 가져오기 실패");}
    finally{setImporting(false);}
  };
  const saveSettings=()=>{
    try {
      ensureValidBatchSelection(checked,cards);
      const updates=cardRows.filter(x=>x.config.image).map(row=>({
        id:row.card.id,config:row.config,
      }));
      if(!updates.length)throw Error("원화가 연결된 카드가 없습니다.");
      onApply(updates);
      setStatus(updates.length+"장의 원화·설정을 프로젝트에 저장했습니다. 기존 원본 일러스트는 유지됩니다.");
      setError("");
    }catch(e){setError(e instanceof Error?e.message:"카드 설정 저장 실패");}
  };
  const runExport=async()=>{
    if(exporting)return;
    setExporting(true);setError("");setReport(null);
    const controller=new AbortController();
    abort.current=controller;
    try {
      const result=await exportBatchOverframes(cards,checked,images,settings,
        msg=>setStatus(msg),controller.signal);
      if(controller.signal.aborted)throw Error("일괄 제작이 취소되었습니다.");
      download(result.blob,"오버프레임_일괄제작.zip");
      setReport(result.report);
      setStatus(result.report.successful.length+"장 ZIP 출력 · "+
        result.report.skipped.length+"장 제외. ZIP 안에 제작내역과 누락 보고서를 포함했습니다.");
    }catch(e){setError(e instanceof Error?e.message:"일괄 ZIP 출력 실패");}
    finally{abort.current=null;setExporting(false);}
  };
  const setSetting=<K extends keyof BatchSettings>(key:K,value:BatchSettings[K])=>
    setSettings(prev=>({...prev,[key]:value}));
  return <div className="modal-backdrop batch-of-backdrop">
    <section className="batch-of-modal" role="dialog" aria-modal="true" aria-labelledby="batch-of-title">
      <header className="simple-of-header">
        <div>
          <span className="eyebrow">FULL ART OVERFRAME · BATCH V3.6</span>
          <h2 id="batch-of-title">오버프레임 일괄 제작·ZIP 출력</h2>
          <p>카드 ID로 원화를 자동 연결하고 카드별 기존 설정을 유지한 채 여러 장을 출력합니다.</p>
        </div>
        <button type="button" disabled={exporting} aria-label="일괄 제작 닫기" onClick={onClose}><X size={18}/></button>
      </header>
      <div className="batch-of-body">
        <aside className="batch-of-options">
          <div className="simple-of-group">
            <strong>01 · 원화 ID 자동 연결</strong>
            <button type="button" disabled={importing || exporting} onClick={()=>input.current?.click()}>
              <ImagePlus size={16}/> PNG/JPG/WebP 또는 ZIP 불러오기
            </button>
            <input ref={input} hidden aria-label="오버프레임 일괄 원화 파일" type="file"
              accept="image/png,image/jpeg,image/webp,.zip" multiple onChange={e=>{
                void importImages(e.target.files);
                e.target.value="";
              }}/>
            <small>예: 918760001.png, 918760002_원화.png · 최대 100개 · 이미지당 10MB</small>
            <small>불러온 원화 {Object.keys(images).length}장 · 작업 종료 전까지 임시 보관</small>
            <label className="simple-of-check">
              <input type="checkbox" checked={settings.fallbackArtwork}
                onChange={e=>setSetting("fallbackArtwork",e.target.checked)}/>
              누락 시 일반 카드 일러스트를 중앙 크롭해 사용
            </label>
            {!!imageWarnings.length && <details className="batch-of-warnings">
              <summary>매칭 제외·주의사항 {imageWarnings.length}건</summary>
              <div>{imageWarnings.slice(0,40).map((x,i)=><p key={i}>{x}</p>)}</div>
            </details>}
          </div>
          <div className="simple-of-group">
            <strong>02 · 공통 레이아웃</strong>
            <label>카드 배치 프리셋
              <select aria-label="일괄 배치 프리셋" value={settings.layout}
                onChange={e=>setSetting("layout",e.target.value as BatchLayoutMode)}>
                {layoutOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label>광택 설정
              <select aria-label="일괄 광택 설정" value={settings.finish}
                onChange={e=>setSetting("finish",e.target.value as BatchFinishMode)}>
                {finishOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <small>개별 카드 수정 사항은 기본적으로 유지됩니다. 변경한 설정은 일괄 출력에만 적용되며, 별도 저장할 수 있습니다.</small>
            {settings.layout==="recommend" && <small>일괄 추천은 카드 종류·효과문 길이를 기준으로 선택합니다. 원화 픽셀을 반영하는 상세 추천은 카드별 3:4 간편 모드에서 비교·적용할 수 있습니다.</small>}
          </div>
          <div className="simple-of-group">
            <strong>03 · 출력 규격</strong>
            <label>ZIP에 포함할 이미지
              <select aria-label="일괄 출력 규격" value={settings.output}
                onChange={e=>setSetting("output",e.target.value as BatchSettings["output"])}>
                <option value="both">고화질 1500×2000 + EDOPro 421×614</option>
                <option value="full">3:4 고화질 1500×2000만</option>
                <option value="edopro">EDOPro 421×614만</option>
              </select>
            </label>
            {settings.output!=="full" && <label>EDOPro 비율 맞추기
              <select aria-label="EDOPro 비율 방식" value={settings.edoFit}
                onChange={e=>setSetting("edoFit",e.target.value as BatchSettings["edoFit"])}>
                <option value="crop">중앙 자르기 (화면 꽉 채우기)</option>
                <option value="pad">여백 추가 (원화 전체 유지)</option>
              </select>
            </label>}
            <small>3:4와 EDOPro 비율이 다릅니다. 이미지를 비틀어 늘리지 않습니다. 엔진용 파일은 pics/ID.png에 저장됩니다.</small>
          </div>
        </aside>
        <section className="batch-of-results">
          <div className="batch-of-list-head">
            <div className="batch-of-summary">
              <strong>선택 {checked.length}장</strong>
              <span>출력 가능 {ready.length}장 · 누락/오류 {omitted.length}장</span>
            </div>
            <div className="batch-of-actions">
              <button type="button" onClick={chooseVisible}>검색 결과 선택 (최대 100)</button>
              <button type="button" onClick={()=>setChecked([])}>전체 선택 해제</button>
            </div>
          </div>
          <label className="batch-of-search">
            <Search size={15}/>
            <input aria-label="일괄 카드 검색" placeholder="카드명 · 카드 ID · 테마 검색"
              value={search} onChange={e=>setSearch(e.target.value)}/>
          </label>
          <div className="batch-of-card-list" aria-label="일괄 카드 선택 목록">
            {filtered.map(c=>{
              const row=cardRows.find(r=>r.card.id===c.id);
              const state=row ? (!row.issues.length ? "출력 가능" : row.issues.join(" / ")) :
                images[c.id] ? "원화 연결됨" : c.simpleOverframe?.image ? "설정 있음" : "";
              return <label className="batch-of-card-row" key={c.id}>
                <input type="checkbox" aria-label={c.id+" 일괄 선택"} checked={selected.has(c.id)}
                  onChange={()=>toggle(c.id)} disabled={exporting}/>
                <span className="batch-of-card-name">
                  <strong>{c.name}</strong><small>{c.id} · {c.theme}</small>
                </span>
                <span className={"batch-of-card-state "+(row && row.issues.length ? "bad" : "")}>
                  {state}
                </span>
                <button type="button" className="batch-of-edit-button" onClick={e=>{
                  e.preventDefault();e.stopPropagation();onEditCard(c.id);
                }}>개별 편집</button>
              </label>;
            })}
          </div>
          <div className="batch-of-preview-head">
            <strong>실제 렌더링 미리보기</strong>
            <span>출력 가능 카드 8장씩</span>
          </div>
          <div className="batch-of-thumbnails">
            {previewCards.length===0 && <div className="batch-of-empty">
              연결된 원화 또는 필수 에셋이 없습니다. 원화를 불러오고 누락 항목을 확인하세요.
            </div>}
            {previewCards.map(row=><div className="batch-of-thumb" key={row.card.id}>
              {previews[row.card.id]
                ? <img src={previews[row.card.id]} alt={row.card.name+" 오버프레임 미리보기"}/>
                : <div className="batch-of-thumb-loading">렌더링 중…</div>}
              <span>{row.card.name}</span>
              <small>{row.card.id} · {row.origin}</small>
            </div>)}
          </div>
          {allPages>1 && <div className="batch-of-pagination">
            <button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>이전</button>
            <span>{page+1} / {allPages}</span>
            <button type="button" disabled={page===allPages-1} onClick={()=>setPage(p=>p+1)}>다음</button>
          </div>}
          {!!omitted.length && <details className="batch-of-warnings">
            <summary>누락·에셋 오류 {omitted.length}장 상세 확인</summary>
            <div>{omitted.map(row=><p key={row.card.id}>
              {row.card.id} · {row.card.name}: {row.issues.join(" / ")}
            </p>)}</div>
          </details>}
        </section>
      </div>
      {!!error && <p className="simple-of-error" role="alert">{error}</p>}
      {!!status && <p className="simple-of-status" role="status">{status}</p>}
      {report && <p className="batch-of-report">ZIP 완료: {report.successful.length}장 · 제외 {report.skipped.length}장 · 제작내역.json 포함</p>}
      <footer className="simple-of-footer batch-of-footer">
        <button type="button" disabled={exporting} onClick={onClose}>닫기</button>
        <button type="button" disabled={exporting || !ready.length} onClick={saveSettings}>
          <Check size={15}/> 선택 카드에 원화·설정 저장
        </button>
        {exporting && <button type="button" onClick={()=>abort.current?.abort()}>출력 중지</button>}
        <button type="button" className="simple-of-primary"
          disabled={exporting || importing || !ready.length}
          onClick={()=>void runExport()}>
          <Download size={16}/> {exporting ? "일괄 제작 중…" : "오버프레임 ZIP 다운로드"}
        </button>
      </footer>
    </section>
  </div>;
}
