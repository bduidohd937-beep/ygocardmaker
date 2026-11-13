import { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Download,
  FileArchive, FileJson, ImagePlus, Layers, Search, Settings2, X } from "lucide-react";
import type { Card, Project } from "./model";
import { auditStudioProduction, type AuditCardResult, type AuditVariantResult } from "./studioAudit";
import { planStudioSafeRepairs, type SafeRepairPatch } from "./studioRepair";
import { download } from "./export";
import { matchBatchImages, type ImageMap } from "./batchOverframe";
import {
  DEFAULT_HUB_OUTPUT, exportStudioHubZip, hubCardStates,
  planHubImageAssignments, type HubImageType, type HubOutputOptions,
  type HubExportReport,
} from "./studioHub";

type Stage = "data"|"images"|"design"|"export";
interface Props {
  project: Project;
  activeId: number;
  selectedIds: number[];
  assetName: string;
  assetCount: number;
  onClose: () => void;
  onImportCards: (file:File)=>Promise<{ok:true;ids:number[]} | {ok:false;error:string}>;
  onImportAssets: (file:File)=>Promise<{ok:true;count:number} | {ok:false;error:string}>;
  onApplyImages: (plan:ReturnType<typeof planHubImageAssignments>)=>void;
  onApplyRepairs: (patches:SafeRepairPatch[])=>void;
  onOpenCard: (id:number)=>void;
  onOpenFullArt: (id:number)=>void;
  onCompare: (id:number)=>void;
  onOpenBatch: (ids:number[])=>void;
}
const STAGES:{key:Stage;name:string;sub:string}[]=[
  {key:"data",name:"01 카드·CDB",sub:"카드 선택과 데이터 관리"},
  {key:"images",name:"02 이미지",sub:"ID 원화 자동 매칭"},
  {key:"design",name:"03 디자인",sub:"일반·3:4 비교/편집"},
  {key:"export",name:"04 출력",sub:"EDOPro·ZIP 자동 제작"},
];
const productionLabel=(card:Card)=>{
  const state=hubCardStates(card);
  return state.dual?"일반 + 3:4":state.normal?"일반 카드":state.overframe?"3:4 원화":"원화 없음";
};
export function StudioHub({project,activeId,selectedIds,assetName,assetCount,
  onClose,onImportCards,onImportAssets,onApplyImages,onApplyRepairs,onOpenCard,
  onOpenFullArt,onCompare,onOpenBatch}:Props){
  const [stage,setStage]=useState<Stage>("data");
  const [query,setQuery]=useState("");
  const [chosen,setChosen]=useState<number[]>(()=>
    [...new Set(selectedIds.filter(id=>project.cards.some(c=>c.id===id)))].slice(0,100));
  const [imageType,setImageType]=useState<HubImageType>("normal");
  const [imageMap,setImageMap]=useState<ImageMap>({});
  const [imageWarnings,setImageWarnings]=useState<string[]>([]);
  const [overwrite,setOverwrite]=useState(false);
  const [output,setOutput]=useState<HubOutputOptions>(DEFAULT_HUB_OUTPUT);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  const [progress,setProgress]=useState("");
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<HubExportReport|null>(null);
  const abort=useRef<AbortController|null>(null);
  const dataFile=useRef<HTMLInputElement>(null),assetFile=useRef<HTMLInputElement>(null),
    imagesFile=useRef<HTMLInputElement>(null);
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return project.cards.filter(c=>!q || (c.name+" "+c.id+" "+c.theme)
      .toLowerCase().includes(q));
  },[project.cards,query]);
  const selected=new Set(chosen);
  const cardsById=new Map(project.cards.map(c=>[c.id,c]));
  const activeCard=cardsById.get(activeId)??project.cards[0];
  const counts=useMemo(()=>{
    let ordinary=0,full=0,dual=0;
    for(const card of project.cards){
      const flags=hubCardStates(card);
      if(flags.normal)ordinary++;
      if(flags.overframe)full++;
      if(flags.dual)dual++;
    }
    return {total:project.cards.length,ordinary,full,dual,
      unassigned:project.cards.length-ordinary};
  },[project.cards]);
  const assignment=useMemo(()=>planHubImageAssignments(
    project.cards,imageMap,chosen,imageType,overwrite),
  [project.cards,imageMap,chosen,imageType,overwrite]);
  const audit=useMemo(
    ()=>auditStudioProduction(project.cards,chosen,output.mode),
    [project.cards,chosen,output.mode,assetCount],
  );
  const safeRepairs=useMemo(()=>planStudioSafeRepairs(project.cards,chosen),
    [project.cards,chosen]);
  const outputCheck={ready:audit.outputsReady,missing:audit.outputsMissing};
  const switchStage=(key:Stage)=>{setStage(key);setError("");setStatus("");};
  const choose=(id:number)=>{
    setReport(null);
    setChosen(current=>{
      if(current.includes(id))return current.filter(x=>x!==id);
      if(current.length>=100){setError("한 번에 최대 100장까지 선택할 수 있습니다.");return current;}
      setError("");
      return [...current,id];
    });
  };
  const selectVisible=()=>{
    setChosen(ids=>[...new Set([...ids,...filtered.map(c=>c.id)])].slice(0,100));
    setError("");
  };
  const handleDataFile=async(file:File|undefined)=>{
    if(!file)return;
    setBusy(true);setError("");
    try{
      const result=await onImportCards(file);
      if(!result.ok){setError(result.error);return;}
      setChosen([...new Set(result.ids)].slice(0,100));
      setStage("images");
      setStatus(result.ids.length+"장의 카드 데이터를 가져왔습니다. 작업 대상 "+
        Math.min(100,new Set(result.ids).size)+"장을 선택하고 이미지 연결을 진행하세요.");
    }catch(e){setError(e instanceof Error?e.message:"카드 데이터 가져오기 실패");}
    finally{setBusy(false);}
  };
  const handleAssetFile=async(file:File|undefined)=>{
    if(!file)return;
    setBusy(true);setError("");
    try{
      const result=await onImportAssets(file);
      if(!result.ok){setError(result.error);return;}
      setStatus("카드 에셋 "+result.count+"종을 불러왔습니다.");
    }catch(e){setError(e instanceof Error?e.message:"리소스 에셋 가져오기 실패");}
    finally{setBusy(false);}
  };
  const handleImages=async(files:FileList|null)=>{
    if(!files?.length)return;
    setBusy(true);setError("");setImageMap({});setReport(null);
    try{
      const matched=await matchBatchImages(Array.from(files),project.cards);
      setImageMap(matched.images);
      setImageWarnings(matched.warnings);
      setStatus(matched.matched+"장 이미지 ID 매칭 · "+matched.ignored+
        "건 제외. '선택 카드에 이미지 적용'을 눌러야 프로젝트에 저장됩니다.");
    }catch(e){setError(e instanceof Error?e.message:"원화 매칭 실패");}
    finally{setBusy(false);}
  };
  const applyImages=()=>{
    if(!assignment.patches.length){setError("적용 가능한 원화가 없습니다. 선택 상태와 기존 이미지 덮어쓰기 설정을 확인하세요.");return;}
    onApplyImages(assignment);
    setStatus(assignment.patches.length+"장의 "+(imageType==="normal"?"일반 카드":"3:4 오버프레임")+
      " 원화를 프로젝트에 저장했습니다.");
    setImageMap({});setImageWarnings([]);setError("");
  };
  const applySafeRepairs=()=>{
    if(busy||!safeRepairs.length)return;
    onApplyRepairs(safeRepairs);
    setReport(null);
    setError("");
    setStatus(safeRepairs.length+
      "장의 중복 특성·마커 또는 기본 미리보기 설정을 안전하게 수정했습니다. 원화·효과·수치는 유지했습니다.");
  };
  const startExport=async()=>{
    if(busy)return;
    setBusy(true);setReport(null);setError("");setProgress("출력 준비 중");
    const controller=new AbortController();
    abort.current=controller;
    try{
      const result=await exportStudioHubZip(project.cards,chosen,output,setProgress,controller.signal);
      if(controller.signal.aborted)throw Error("출력을 취소했습니다.");
      download(result.blob,"카드_통합출력_V4.2.zip");
      setReport(result.report);
      setStatus("이미지 "+result.report.produced.length+"장 ZIP 다운로드 · 누락 "+
        result.report.omitted.length+"건. 제작 검수보고서 포함.");
    }catch(e){setError(e instanceof Error?e.message:"통합 ZIP 출력 실패");}
    finally{setBusy(false);setProgress("");abort.current=null;}
  };
  const setOutputField=<K extends keyof HubOutputOptions>(key:K,value:HubOutputOptions[K])=>
    setOutput(prev=>({...prev,[key]:value}));
  const downloadAudit=()=>{
    const payload={version:"4.2",source:"YGO STUDIO 통합 작업실",
      mode:output.mode,selected:chosen.length,
      outputsReady:audit.outputsReady,outputsMissing:audit.outputsMissing,
      cards:audit.cards};
    download(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),
      "카드_출력전_검수표_V4.2.json");
  };
  const routeAuditIssue=(card:AuditCardResult,item:AuditVariantResult)=>{
    if(item.issues.some(issue=>issue.includes("설정이 올바르지")||
      issue.includes("잘못된")||issue.includes("지원하지 않는")||
      issue.includes("카드명 누락"))){
      openEdit(card.id,item.mode==="overframe"?"full":"normal");
    } else if(item.primaryAction==="assets"){
      setStage("data");setStatus("누락된 원본 에셋을 확인하고 카드 에셋 ZIP을 불러오세요.");
    } else {
      setImageType(item.mode);
      setImageMap({});setImageWarnings([]);
      setStage("images");
      setStatus(card.id+"번 카드의 "+(item.mode==="normal"?"일반":"3:4")+
        " 원화를 확인하세요. 카드 ID 파일명을 맞춰 업로드하면 연결됩니다.");
    }
  };
  const openEdit=(id:number,kind:"normal"|"full"|"compare")=>{
    if(kind==="normal")onOpenCard(id);
    else if(kind==="full")onOpenFullArt(id);
    else onCompare(id);
  };
  return <div className="modal-backdrop studio-hub-backdrop">
    <section className="studio-hub-modal" role="dialog" aria-modal="true" aria-labelledby="studio-hub-title">
      <header className="simple-of-header">
        <div><span className="eyebrow">YGO STUDIO · INTEGRATED WORKSPACE V4.0</span>
          <h2 id="studio-hub-title">카드 제작 통합 작업실</h2>
          <p>카드 데이터 → 이미지 ID 연결 → 디자인 편집 → EDOPro 출력 · 같은 프로젝트에서 관리</p>
        </div>
        <button type="button" aria-label="통합 작업실 닫기" disabled={busy} onClick={onClose}><X size={18}/></button>
      </header>
      <div className="studio-hub-stats">
        <span><strong>{counts.total}</strong> 전체 카드</span>
        <span><strong>{counts.ordinary}</strong> 일반 원화</span>
        <span><strong>{counts.full}</strong> 3:4 원화</span>
        <span><strong>{counts.dual}</strong> 두 형태 보유</span>
        <span><strong>{chosen.length}</strong> 작업 선택</span>
      </div>
      <nav className="studio-hub-steps" aria-label="통합 제작 단계">
        {STAGES.map(item=><button key={item.key} type="button"
          aria-current={stage===item.key?"step":undefined}
          className={stage===item.key?"active":""}
          disabled={busy}
          onClick={()=>switchStage(item.key)}>
          <strong>{item.name}</strong><small>{item.sub}</small>
        </button>)}
      </nav>
      <div className="studio-hub-body">
        <aside className="studio-hub-list-pane">
          <div className="studio-hub-pane-title"><strong>카드 목록</strong><small>선택 {chosen.length} / 최대 100장</small></div>
          <label className="batch-of-search"><Search size={15}/>
            <input aria-label="통합 카드 검색" placeholder="카드명 / ID / 테마" value={query}
              onChange={e=>setQuery(e.target.value)}/>
          </label>
          <div className="studio-hub-list-actions">
            <button type="button" onClick={selectVisible}>검색 결과 선택</button>
            <button type="button" onClick={()=>setChosen([])}>선택 해제</button>
          </div>
          <div className="studio-hub-card-list">
            {filtered.slice(0,200).map(card=><div key={card.id}
              className={"studio-hub-card-row"+(card.id===activeId?" current":"")}>
              <input type="checkbox" aria-label={card.id+" 통합 작업 선택"}
                checked={selected.has(card.id)} disabled={busy} onChange={()=>choose(card.id)}/>
              <button type="button" className="studio-hub-card-pick" onClick={()=>openEdit(card.id,"normal")}>
                <strong>{card.name}</strong>
                <small>{card.id} · {productionLabel(card)}</small>
              </button>
              <button type="button" title="카드 바로 비교" aria-label={card.id+" 바로 비교"}
                onClick={()=>openEdit(card.id,"compare")}>비교</button>
            </div>)}
            {filtered.length>200&&<small>검색 결과가 많아 200장만 표시합니다. ID나 카드명으로 좁혀 주세요.</small>}
            {!filtered.length&&<p>검색 결과가 없습니다.</p>}
          </div>
          <small className="studio-hub-hint">목록의 카드명을 누르면 일반 카드 편집으로 이동합니다. 좌측 체크박스는 일괄 작업 대상입니다.</small>
        </aside>
        <main className="studio-hub-content">
          {stage==="data"&&<>
            <div className="studio-hub-section-title"><FileArchive size={19}/>
              <div><h3>01 카드·CDB 데이터</h3><p>현재 프로젝트에 CDB/JSON 카드를 합치고 목록에서 편집 대상을 선택합니다.</p></div>
            </div>
            <div className="studio-hub-grid-two">
              <div className="studio-hub-tile">
                <strong>CDB / JSON 카드 불러오기</strong>
                <p>카드 ID가 같으면 기존 원화와 오버프레임 설정을 보존하며 카드 정보를 갱신합니다.</p>
                <button type="button" disabled={busy} onClick={()=>dataFile.current?.click()}>
                  <ArrowUpFromLine size={15}/> 카드 CDB·JSON 가져오기
                </button>
                <input ref={dataFile} type="file" hidden accept=".cdb,.json" aria-label="통합 카드 데이터 파일"
                  onChange={e=>{void handleDataFile(e.target.files?.[0]);e.target.value="";}}/>
              </div>
              <div className="studio-hub-tile">
                <strong>원본 카드 렌더러 자산팩</strong>
                <p>{assetCount?assetName+" · "+assetCount+"종 로드됨":"현재 원본 카드 에셋 ZIP 미적용"}.</p>
                <button type="button" disabled={busy} onClick={()=>assetFile.current?.click()}>
                  <Layers size={15}/> 기존 카드 에셋 ZIP 불러오기
                </button>
                <input ref={assetFile} type="file" hidden accept=".zip" aria-label="통합 카드 에셋 ZIP"
                  onChange={e=>{void handleAssetFile(e.target.files?.[0]);e.target.value="";}}/>
              </div>
            </div>
            <div className="studio-hub-grid-two">
              <div className="studio-hub-tile">
                <strong>데이터 백업</strong>
                <p>현재 카드 정보·일반/3:4 원화·배치 설정을 JSON으로 저장합니다.</p>
                <button type="button" onClick={()=>download(
                  new Blob([JSON.stringify(project,null,2)],{type:"application/json"}),
                  "YGO_STUDIO_프로젝트_백업.json")}>
                  <FileJson size={15}/> 프로젝트 JSON 백업
                </button>
              </div>
              <div className="studio-hub-tile">
                <strong>제작 현황</strong>
                <p>카드 {counts.total}장 중 일반 원화 없는 카드 {counts.unassigned}장,
                  두 형태 원화를 모두 보유한 카드 {counts.dual}장.</p>
                <button type="button" onClick={()=>switchStage("images")}>
                  <ImagePlus size={15}/> 이미지 연결 단계로
                </button>
              </div>
            </div>
          </>}
          {stage==="images"&&<>
            <div className="studio-hub-section-title"><ImagePlus size={19}/>
              <div><h3>02 이미지 관리 · 카드 ID 자동 연결</h3><p>일반 일러스트와 3:4 오버프레임 원화를 서로 다른 슬롯에 저장합니다.</p></div>
            </div>
            <div className="studio-hub-tile">
              <strong>어느 이미지에 연결할까?</strong>
              <div className="studio-hub-radio">
                <label><input type="radio" name="hub-image-type" checked={imageType==="normal"}
                  onChange={()=>{setImageType("normal");setImageMap({});}}/> 일반 카드 일러스트</label>
                <label><input type="radio" name="hub-image-type" checked={imageType==="overframe"}
                  onChange={()=>{setImageType("overframe");setImageMap({});}}/> 3:4 오버프레임 원화</label>
              </div>
              <p>파일명 예시: 918760001.png, 918760002_원화.png. PNG·JPG·WebP 또는 ZIP 묶음을 최대 100장 가져올 수 있어.</p>
              <button type="button" disabled={busy} onClick={()=>imagesFile.current?.click()}>
                <ImagePlus size={15}/> ID별 원화 파일·ZIP 선택
              </button>
              <input ref={imagesFile} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,.zip"
                aria-label="통합 이미지 묶음 파일" onChange={e=>{void handleImages(e.target.files);e.target.value="";}}/>
              <label className="studio-hub-checkbox">
                <input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}/>
                기존에 연결된 해당 종류의 이미지도 덮어쓰기
              </label>
              <small>기본값은 기존 이미지 보호. 3:4 원화가 교체돼도 카드별 효과창·레이아웃·광택은 그대로 유지합니다.</small>
            </div>
            <div className="studio-hub-image-report">
              <span>매칭 {Object.keys(imageMap).length}장</span>
              <span>적용 예정 {assignment.patches.length}장</span>
              <span>기존 이미지 보호 {assignment.skippedExisting.length}장</span>
              <span>미선택 카드 {assignment.skippedNotSelected.length}장</span>
            </div>
            {!!Object.keys(imageMap).length&&<div className="studio-hub-image-strip">
              {Object.entries(imageMap).slice(0,12).map(([id,url])=>
                <div key={id}><img src={url} alt={id+" 매칭 원화"}/><small>{id}</small></div>)}
            </div>}
            {!!imageWarnings.length&&<details className="batch-of-warnings">
              <summary>이미지 매칭 주의사항 {imageWarnings.length}건</summary>
              {imageWarnings.slice(0,50).map((warning,i)=><p key={i}>{warning}</p>)}
            </details>}
            <div className="studio-hub-tile studio-hub-apply">
              <button type="button" className="simple-of-primary"
                disabled={busy||!assignment.patches.length} onClick={applyImages}>
                <Check size={15}/> 선택한 카드 {assignment.patches.length}장에 이미지 적용
              </button>
              <button type="button" onClick={()=>switchStage("design")}>디자인 검수 단계로</button>
            </div>
          </>}
          {stage==="design"&&<>
            <div className="studio-hub-section-title"><Settings2 size={19}/>
              <div><h3>03 디자인 검수·편집</h3><p>기존 일반 카드/오버프레임 렌더러를 한곳에서 열어 실제 결과를 비교합니다.</p></div>
            </div>
            <div className="studio-hub-tile">
              <strong>{activeCard?.name||"카드를 선택하세요"}</strong>
              <p>현재 카드 ID {activeCard?.id} · {activeCard?productionLabel(activeCard):"없음"}</p>
              <div className="studio-hub-design-actions">
                <button type="button" onClick={()=>openEdit(activeCard.id,"normal")}>
                  일반 카드 정보·일러스트 편집
                </button>
                <button type="button" onClick={()=>openEdit(activeCard.id,"full")}>
                  3:4 오버프레임 편집
                </button>
                <button type="button" onClick={()=>openEdit(activeCard.id,"compare")}>
                  일반·3:4 나란히 비교
                </button>
              </div>
              <small>오버프레임에 사용되는 카드명·속성·레벨/랭크는 기존 에셋을 그대로 재사용합니다.</small>
            </div>
            <div className="studio-hub-grid-two">
              <div className="studio-hub-tile">
                <strong>대량 카드 제작</strong>
                <p>V3.6의 ID 매칭·일괄 프리셋·미리보기·ZIP 기능을 유지합니다.</p>
                <button type="button" onClick={()=>onOpenBatch(chosen)}>일괄 오버프레임 제작 열기</button>
              </div>
              <div className="studio-hub-tile">
                <strong>출력 전 확인</strong>
                <p>선택 카드 {chosen.length}장 · 일반/3:4 원화를 따로 관리하고, 출력 중 누락된 디자인을 보고합니다.</p>
                <button type="button" onClick={()=>switchStage("export")}>출력·EDOPro 단계로</button>
              </div>
            </div>
          </>}
          {stage==="export"&&<>
            <div className="studio-hub-section-title"><Download size={19}/>
              <div><h3>04 고화질·EDOPro 통합 출력</h3><p>왼쪽에서 선택한 카드만 출력하며 누락된 형태는 보고서에 남깁니다.</p></div>
            </div>
            <div className="studio-hub-grid-two">
              <label className="studio-hub-field">출력할 카드 형태
                <select aria-label="통합 출력 형태" value={output.mode}
                  onChange={e=>setOutputField("mode",e.target.value as HubOutputOptions["mode"])}>
                  <option value="both">일반 카드 + 3:4 오버프레임</option>
                  <option value="normal">일반 카드만</option>
                  <option value="overframe">오버프레임만</option>
                </select>
              </label>
              <label className="studio-hub-field">출력 규격
                <select aria-label="통합 출력 규격" value={output.resolution}
                  onChange={e=>setOutputField("resolution",e.target.value as HubOutputOptions["resolution"])}>
                  <option value="original">고화질 PNG (1263×1842 / 1500×2000)</option>
                  <option value="edopro">EDOPro PNG (421×614)</option>
                </select>
              </label>
            </div>
            {output.resolution==="edopro"&&output.mode!=="normal"&&
              <label className="studio-hub-field">3:4 → EDOPro 비율 맞춤
                <select aria-label="통합 EDOPro 비율" value={output.fit}
                  onChange={e=>setOutputField("fit",e.target.value as HubOutputOptions["fit"])}>
                  <option value="crop">중앙 잘라내기 · 화면 채우기</option>
                  <option value="pad">여백 추가 · 원화 전체 유지</option>
                </select>
              </label>}
            <div className="studio-hub-image-report">
              <span>선택 {chosen.length}장</span>
              <span>출력 가능 {outputCheck.ready}건</span>
              <span>누락 예상 {outputCheck.missing}건</span>
            </div>
            <section className="studio-hub-tile studio-hub-audit" aria-label="V4.2 출력 전 자동 검수">
              <div className="studio-hub-pane-title">
                <strong>V4.2 출력 전 자동 검수·안전 수정</strong>
                <small>카드 {audit.cards.length}장 · 완전 준비 {audit.cards.length-audit.incompleteCards.length}장
                  · 보완 필요 {audit.incompleteCards.length}장</small>
              </div>
              <p>출력 형태별 원화·설정·메타데이터·필수 에셋을 독립적으로 검사합니다. 안전 오류 수정은 누른 뒤에만 적용되며 원화·효과는 그대로 둡니다. 실제 PNG 렌더링 오류는 ZIP 보고서에서 별도 확인합니다.</p>
              <div className="studio-hub-audit-actions">
                <button type="button" disabled={busy||!audit.incompleteCards.length}
                  onClick={()=>setChosen([...audit.incompleteCards])}>
                  미완성 카드만 선택 ({audit.incompleteCards.length})
                </button>
                <button type="button" disabled={busy||!audit.readyCards.length}
                  onClick={()=>setChosen([...audit.readyCards])}>
                  출력 가능 카드만 선택 ({audit.readyCards.length})
                </button>
                <button type="button" disabled={busy||!safeRepairs.length}
                  onClick={applySafeRepairs}
                  title="중복 특성·마커 및 기본 미리보기 설정만 수정합니다. 원화와 효과는 유지됩니다.">
                  <Check size={14}/> 안전 오류 수정 적용 ({safeRepairs.length})
                </button>
                <button type="button" disabled={!chosen.length}
                  onClick={downloadAudit}>
                  <FileJson size={14}/> 검수표 JSON 다운로드
                </button>
              </div>
              {!!safeRepairs.length&&<details className="batch-of-warnings">
                <summary>안전 수정 가능 카드 {safeRepairs.length}장 · 수정 내용 확인</summary>
                {safeRepairs.map(item=><p key={item.id}>
                  {item.id}: {item.reasons.join(" / ")}
                </p>)}
              </details>}
              <div className="studio-hub-audit-list">
                {audit.cards.length===0&&<p>왼쪽 카드 목록에서 검수할 카드를 먼저 선택하세요.</p>}
                {audit.cards.map(row=><div key={row.id}
                    className={"studio-hub-audit-row"+(row.complete?" complete":" incomplete")}>
                  <div className="studio-hub-audit-card-title">
                    <strong>{row.id} · {row.name}</strong>
                    <small>{row.complete?"선택 출력 전부 준비":row.ready?"일부 준비 · 보완 필요":"출력 불가 · 보완 필요"}</small>
                  </div>
                  {row.variants.map(item=><div key={item.mode} className="studio-hub-audit-variant">
                    <span>{item.mode==="normal"?"일반 카드":"3:4 오버프레임"} · {item.ready?"준비 완료":item.issues.join(" / ")}</span>
                    {!item.ready&&<button type="button" disabled={busy} 
                      aria-label={row.id+" "+(item.mode==="normal"?"일반":"오버프레임")+" 문제 수정"}
                      onClick={()=>routeAuditIssue(row,item)}>문제 수정</button>}
                  </div>)}
                </div>)}
              </div>
            </section>
            <div className="studio-hub-tile">
              <strong>ZIP 폴더 구성</strong>
              <p>{output.resolution==="original"
                ?"고화질_일반/ID.png · 고화질_오버프레임/ID.png"
                :output.mode==="both"
                  ?"EDOPro_일반/pics/ID.png · EDOPro_오버프레임/pics/ID.png"
                  :"pics/ID.png"}
              </p>
              <small>공통 제작_검수보고서.json, 누락_및_오류.txt 동봉. EDOPro는 421×614로 출력되며 비율을 늘리지 않습니다. 100장·ZIP 240MB 제한.</small>
              {busy&&progress&&<p role="status">{progress}</p>}
              <div className="studio-hub-design-actions">
                {busy&&<button type="button" onClick={()=>abort.current?.abort()}>출력 취소</button>}
                <button type="button" className="simple-of-primary"
                  disabled={busy||!outputCheck.ready} onClick={()=>void startExport()}>
                  <ArrowDownToLine size={16}/> {busy?"이미지 제작 중…":"선택 카드 통합 ZIP 다운로드"}
                </button>
              </div>
            </div>
            {report&&<details className="studio-hub-tile studio-hub-export-report" open>
              <summary>출력 결과 · 성공 {report.produced.length}건 / 누락 {report.omitted.length}건</summary>
              {report.omitted.slice(0,30).map((item,i)=>
                <p key={i}>{item.id} · {item.mode} · {item.reason}</p>)}
            </details>}
          </>}
        </main>
      </div>
      {!!error&&<p role="alert" className="simple-of-error">{error}</p>}
      {!!status&&<p role="status" className="simple-of-status">{status}</p>}
      <footer className="simple-of-footer studio-hub-footer">
        <span>카드 원화·CDB·Lua 원본 파일은 변경하지 않습니다. 현재 브라우저 프로젝트에만 반영됩니다.</span>
        <button type="button" disabled={busy} onClick={onClose}><X size={14}/> 작업실 닫기</button>
      </footer>
    </section>
  </div>;
}
