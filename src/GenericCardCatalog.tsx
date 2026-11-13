import { useMemo, useState } from "react";
import { Archive, Download, FileCode2, ImagePlus, Search, Plus, BookOpen, ExternalLink } from "lucide-react";
import type { Project } from "./model";
import { download } from "./export";
import {
  artworkFor, catalogCsv, catalogZip, effectiveText, filterGenericCards, getGenericCards,
  linkedCard, parseCatalogBackup, type Adoption, type ArtworkSlot, type BuildStatus,
  type DuelStatus, type GenericCard,
} from "./genericCatalog";
import "./genericCatalog.css";

interface Props {
  project: Project;
  onChange: (cards: GenericCard[]) => void;
  onOpenCard: (id: number) => void;
}
const artSlots: { slot: ArtworkSlot; label: string }[] = [
  { slot: "original", label: "원본 일러스트" },
  { slot: "overframe", label: "3:4 오버프레임" },
  { slot: "final", label: "최종본" },
];
const adoptionTypes: Adoption[] = ["채택", "보류", "폐기"];
const buildTypes: BuildStatus[] = ["미확인", "제작 기록", "파일 확인"];
const duelTypes: DuelStatus[] = ["미검증", "검증 중", "통과", "오류"];

export function GenericCardCatalog({ project, onChange, onOpenCard }: Props) {
  const records = getGenericCards(project.genericCatalog);
  const [selectedKey, setSelectedKey] = useState("card-990470201");
  const [query, setQuery] = useState("");
  const [adoptionFilter, setAdoptionFilter] = useState<Adoption | "전체">("전체");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(
    () => filterGenericCards(records, project.cards, query, adoptionFilter),
    [records, project.cards, query, adoptionFilter]);
  const current = records.find(r => r.key === selectedKey) || records[0];
  const studioCard = current && linkedCard(current, project.cards);
  const counts = {
    accepted: records.filter(r => r.adoption === "채택").length,
    held: records.filter(r => r.adoption === "보류").length,
    rejected: records.filter(r => r.adoption === "폐기").length,
    passed: records.filter(r => r.duelStatus === "통과").length,
  };
  const mutate = (key: string, patch: Partial<GenericCard>) => {
    onChange(records.map(r => r.key === key ? { ...r, ...patch } : r));
  };
  const changeId = (value: string) => {
    if (!current) return;
    if (value && !/^\d{1,10}$/.test(value)) return;
    const next = value ? Number(value) : null;
    if (next !== null && (!Number.isSafeInteger(next) || next <= 0 || next > 2147483647)) {
      setMessage("카드 ID는 1~2147483647 범위의 정수여야 합니다."); return;
    }
    if (next !== null && records.some(r => r.key !== current.key && r.id === next)) {
      setMessage("이미 등록된 카드 ID입니다."); return;
    }
    setMessage("");
    mutate(current.key, { id: next });
  };
  const add = () => {
    const key = "draft-" + Date.now() + "-" + records.length;
    const card: GenericCard = {
      key, id: null, name: "신규 범용 카드", role: "", attribute: "", adoption: "보류",
      cdbStatus: "미확인", luaStatus: "미확인", duelStatus: "미검증",
      version: "V0.1", effect: "", luaText: "", issues: "", artwork: {}, history: [],
    };
    onChange([...records, card]);
    setSelectedKey(key);
    setAdoptionFilter("전체");
    setQuery("");
    setMessage("신규 보류 카드를 만들었습니다. ID와 효과는 확인 후 입력하세요.");
  };
  const addHistory = () => {
    if (!current) return;
    if (!note.trim()) { setMessage("수정 내용을 입력해야 버전 이력에 기록됩니다."); return; }
    mutate(current.key, { history: [...current.history, {
      at: new Date().toISOString(), version: current.version, note: note.trim(),
    }] });
    setNote("");
    setMessage("버전 기록을 추가했습니다.");
  };
  const addArtwork = async (slot: ArtworkSlot, file?: File) => {
    if (!current || !file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024) {
      setMessage("10MB 이하의 PNG·JPG·WebP만 등록할 수 있습니다."); return;
    }
    if (artworkFor(current, project.cards, slot) &&
      !window.confirm("이 슬롯에는 이미지가 있습니다. 도감의 별도 이미지를 등록할까요? 기존 작업실 원화는 변경되지 않습니다.")) return;
    try {
      const uri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("이미지 파일을 읽을 수 없습니다."));
        reader.readAsDataURL(file);
      });
      mutate(current.key, { artwork: { ...current.artwork, [slot]: uri } });
      setMessage("도감 이미지가 등록되었습니다. 카드 제작 작업실 원본은 유지됩니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "이미지 읽기 실패"); }
  };
  const attachLua = async (file?: File) => {
    if (!current || !file) return;
    if (!file.name.toLowerCase().endsWith(".lua") || file.size > 1024 * 1024) {
      setMessage("1MB 이하 .lua 텍스트 파일만 첨부할 수 있습니다."); return;
    }
    try {
      mutate(current.key, { luaText: await file.text(), luaStatus: "파일 확인" });
      setMessage("Lua 텍스트를 첨부했습니다. 동작 검증 상태는 변경하지 않았습니다.");
    } catch { setMessage("Lua 읽기 실패"); }
  };
  const exportCsv = () => download(new Blob([catalogCsv(records, project.cards)],
    { type: "text/csv;charset=utf-8" }), "범용카드_마스터목록.csv");
  const exportBackup = () => download(new Blob([JSON.stringify({ version: 1, records }, null, 2)],
    { type: "application/json" }), "범용카드_도감_백업.json");
  const exportZip = () => {
    try {
      const size = JSON.stringify(records).length +
        records.reduce((n, r) => n +
          (artworkFor(r, project.cards, "original").length) +
          (artworkFor(r, project.cards, "overframe").length) +
          (artworkFor(r, project.cards, "final").length), 0);
      if (size > 200 * 1024 * 1024) throw Error("이미지가 너무 많습니다. JSON/CSV로 먼저 백업하고 이미지를 나눠 관리하세요.");
      const bytes = catalogZip(records, project.cards);
      download(new Blob([new Uint8Array(bytes)], { type: "application/zip" }), "범용카드_도감_전체백업.zip");
      setMessage("한글 폴더 구조의 도감 ZIP을 내보냈습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "ZIP 내보내기 실패"); }
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    if (file.size > 60 * 1024 * 1024) { setMessage("60MB 이하 JSON 백업만 불러올 수 있습니다."); return; }
    try {
      const incoming = parseCatalogBackup(await file.text());
      if (!window.confirm("현재 도감 " + records.length + "건을 백업 " + incoming.length +
        "건으로 교체할까요? 작업실 카드·CDB·Lua 원본 파일은 변경되지 않습니다.")) return;
      onChange(incoming);
      setSelectedKey(incoming[0]?.key ?? "");
      setMessage("도감 백업 " + incoming.length + "건을 복원했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "도감 백업 복원 실패"); }
  };

  return <section className="generic-catalog" aria-label="범용 카드 도감">
    <div className="generic-catalog-header">
      <div><span className="eyebrow">GENERIC CARD ENCYCLOPEDIA · V1.0</span>
        <h3><BookOpen size={21}/> 범용 카드 도감</h3>
        <p>이름·ID·효과·역할 검색 / 채택·제작·실전 검증 개별 관리 / 작업실 이미지 자동 참조</p>
      </div>
      <button type="button" onClick={add}><Plus size={15}/> 카드 추가</button>
    </div>
    <div className="generic-catalog-counts" aria-label="도감 현황">
      <span>전체 <strong>{records.length}</strong></span>
      <span>채택 <strong>{counts.accepted}</strong></span>
      <span>보류 <strong>{counts.held}</strong></span>
      <span>폐기 <strong>{counts.rejected}</strong></span>
      <span>실전 통과 <strong>{counts.passed}</strong></span>
    </div>
    <div className="generic-catalog-tools">
      <label><Search size={14}/><input aria-label="범용 카드 검색"
        placeholder="이름 / 카드 ID / 역할 / 속성 / 효과 / 오류"
        value={query} onChange={e => setQuery(e.target.value)}/></label>
      <select aria-label="채택 상태 필터" value={adoptionFilter}
        onChange={e => setAdoptionFilter(e.target.value as Adoption | "전체")}>
        <option value="전체">전체 상태</option>
        {adoptionTypes.map(s => <option value={s} key={s}>{s}</option>)}
      </select>
      <button onClick={exportCsv}><Download size={14}/> CSV</button>
      <button onClick={exportBackup}><Download size={14}/> JSON</button>
      <button onClick={exportZip}><Archive size={14}/> 도감 ZIP</button>
      <label className="generic-catalog-file">JSON 복원
        <input type="file" accept=".json,application/json" aria-label="도감 JSON 백업 복원"
          onChange={e => { void importBackup(e.target.files?.[0]); e.target.value = ""; }}/>
      </label>
    </div>
    <div className="generic-catalog-main">
      <div className="generic-catalog-list">
        <div className="generic-catalog-list-head">검색 결과 {filtered.length}건</div>
        {filtered.map(r => {
          const image = artworkFor(r, project.cards, "original");
          return <button type="button" key={r.key} onClick={() => { setSelectedKey(r.key); setMessage(""); }}
            className={"generic-catalog-item" + (current?.key === r.key ? " active" : "")}>
            <div className="generic-catalog-thumb">
              {image ? <img alt="" src={image}/> : <ImagePlus size={19}/>}
            </div>
            <span className="generic-catalog-item-info"><strong>{r.name}</strong>
              <small>{r.id ?? "ID 미정"} · {r.role || "역할 미정"}</small>
              <small>{r.version} · CDB {r.cdbStatus} · 검증 {r.duelStatus}</small>
            </span>
            <em>{r.adoption}</em>
          </button>;
        })}
        {filtered.length === 0 && <p className="generic-catalog-empty">조건에 맞는 카드가 없습니다.</p>}
      </div>
      {current ? <div className="generic-catalog-detail" key={current.key}>
        <div className="generic-catalog-detail-head">
          <h4>{current.name}</h4>
          <span>{studioCard ? "작업실 카드 ID 연결됨" : "작업실 카드 미등록"}</span>
          {studioCard && <button type="button" onClick={() => onOpenCard(studioCard.id)}>
            <ExternalLink size={13}/> 카드 편집</button>}
        </div>
        <div className="generic-catalog-form-grid">
          <label>카드 ID <input inputMode="numeric" aria-label="도감 카드 ID"
            value={current.id ?? ""} placeholder="ID 미정"
            onChange={e => changeId(e.target.value)}/></label>
          <label>카드명 <input aria-label="도감 카드명" value={current.name}
            onChange={e => mutate(current.key, { name: e.target.value })}/></label>
          <label>역할 <input aria-label="도감 카드 역할" value={current.role}
            onChange={e => mutate(current.key, { role: e.target.value })}/></label>
          <label>속성 <input aria-label="도감 카드 속성" value={current.attribute || studioCard?.attribute || ""}
            placeholder="속성 미확인"
            onChange={e => mutate(current.key, { attribute: e.target.value })}/></label>
          <label>효과 버전 <input aria-label="도감 카드 버전" value={current.version}
            onChange={e => mutate(current.key, { version: e.target.value })}/></label>
          <label>채택 상태 <select aria-label="도감 채택 상태" value={current.adoption}
            onChange={e => mutate(current.key, { adoption: e.target.value as Adoption })}>
            {adoptionTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select></label>
          <label>CDB 구현 <select aria-label="도감 CDB 구현 상태" value={current.cdbStatus}
            onChange={e => mutate(current.key, { cdbStatus: e.target.value as BuildStatus })}>
            {buildTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select></label>
          <label>Lua 구현 <select aria-label="도감 Lua 구현 상태" value={current.luaStatus}
            onChange={e => mutate(current.key, { luaStatus: e.target.value as BuildStatus })}>
            {buildTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select></label>
          <label>EDOPro 대전 검증 <select aria-label="도감 실전 검증 상태" value={current.duelStatus}
            onChange={e => mutate(current.key, { duelStatus: e.target.value as DuelStatus })}>
            {duelTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </select></label>
        </div>
        <label className="generic-catalog-block">최신 효과 원문
          <textarea aria-label="도감 효과 원문" rows={5}
            placeholder="확인된 효과 원문을 입력하세요. 추정 효과는 저장하지 않습니다."
            value={current.effect || studioCard?.effect || ""}
            onChange={e => mutate(current.key, { effect: e.target.value })}/>
          <small>{!current.effect && studioCard?.effect ? "작업실 카드의 효과를 참조 중 · 편집하면 도감의 독립 원문으로 저장됩니다." :
            "도감에 별도 저장 · 카드 제작 작업실의 효과와 CDB는 자동으로 덮어쓰지 않습니다."}</small>
        </label>
        <div className="generic-catalog-images">
          {artSlots.map(({ slot, label }) => {
            const image = artworkFor(current, project.cards, slot);
            return <div key={slot} className="generic-catalog-image">
              <strong>{label}</strong>
              <div>{image ? <img alt={current.name + " " + label} src={image}/> :
                <span><ImagePlus size={23}/> 이미지 미등록</span>}</div>
              <label>이미지 등록<input type="file" accept="image/png,image/jpeg,image/webp"
                aria-label={label + " 업로드"}
                onChange={e => { void addArtwork(slot, e.target.files?.[0]); e.target.value = ""; }}/></label>
              <small>{current.artwork[slot] ? "도감 별도 보관" :
                image ? "작업실 ID 연결" : "아직 없음"}</small>
            </div>;
          })}
        </div>
        <div className="generic-catalog-code">
          <label><FileCode2 size={15}/> Lua 원문 {current.id !== null && <code>c{current.id}.lua</code>}
            <input type="file" accept=".lua,text/plain" aria-label="도감 Lua 첨부"
              onChange={e => { void attachLua(e.target.files?.[0]); e.target.value = ""; }}/>
          </label>
          <small>{current.luaText ? "Lua 텍스트 첨부됨 · " + current.luaText.length + "자" :
            "Lua 원본 미첨부 · 제작 기록은 실전 검증을 의미하지 않습니다."}</small>
        </div>
        <label className="generic-catalog-block">버그·검증 메모
          <textarea aria-label="도감 검증 메모" value={current.issues} rows={2}
            placeholder="실전 재현 조건 / 수정 내역 / 미검증 항목"
            onChange={e => mutate(current.key, { issues: e.target.value })}/>
        </label>
        <div className="generic-catalog-history">
          <strong>버전 이력</strong>
          <div><input aria-label="버전 기록 내용" placeholder="이번 패치에서 변경된 내용" value={note}
            onChange={e => setNote(e.target.value)}/>
            <button type="button" onClick={addHistory}>이력 추가</button></div>
          {current.history.slice(-6).reverse().map((h, i) =>
            <p key={i}>{h.at.slice(0, 10)} · {h.version} · {h.note}</p>)}
          {!current.history.length && <small>아직 기록된 수정 이력이 없습니다.</small>}
        </div>
      </div> : <div className="generic-catalog-empty">도감 카드가 없습니다. 신규 카드를 추가하세요.</div>}
    </div>
    {message && <p role="status" className="generic-catalog-message">{message}</p>}
    <p className="generic-catalog-disclaimer">초기 5종의 CDB·Lua는 대화상 제작 기록입니다. 실제 파일 확인·EDOPro 실전 통과와 구분됩니다. 도감 수정은 원본 Lua/CDB·카드 일러스트를 덮어쓰지 않습니다.</p>
  </section>;
}
