import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Search,
  Layers,
  Check,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  ImagePlus,
  Crop,
  FileJson,
  FolderOpen,
  Package,
  CheckCircle2,
  Info,
  X,
  Copy,
  Maximize2,
  Minus,
  Image as ImageIcon,
  LayoutGrid,
  PanelLeft,
  RotateCcw,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  ATTRIBUTES,
  FRAMES,
  RACES,
  MONSTER_TRAITS,
  type MonsterTrait,
  LINK_BITS,
  isMonster,
  mergeCards,
  normalizeCardTraits,
  newCard,
  nextId,
  parseImport,
  readCDB,
  validateCards,
  type Card,
  type Frame,
  type Project,
} from "./model";
import { renderCard } from "./render";
import { ArtworkCropEditor } from "./CropEditor";
import { getActivePack, importAssetZip, loadAssetPack, saveAssetPack, setActivePack } from "./assetPack";
import { demoProject } from "./samples";
import { loadProject, saveProject } from "./storage";
import { download, exportOne, exportZip } from "./export";
import { deleteProjectCards, getDeletionTargets, toggleVisibleSelection, type DeleteScope } from "./cardDeletion";

export function CardMakerApp() {
  const [project, setProject] = useState<Project | null>(null),
    [active, setActive] = useState(0),
    [selected, setSelected] = useState<number[]>([]),
    [filter, setFilter] = useState(""),
    [theme, setTheme] = useState("전체 테마"),
    [tab, setTab] = useState("정보"),
    [toast, setToast] = useState(""),
    [saveState, setSaveState] = useState("불러오는 중"),
    [renderError, setRenderError] = useState(""),
    [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading"),
    [renderedFontSize, setRenderedFontSize] = useState<number | null>(null),
    [modal, setModal] = useState(false),
    [cropEditorOpen, setCropEditorOpen] = useState(false),
    [format, setFormat] = useState<"png" | "jpg">("png"),
    [size, setSize] = useState(1263),
    [busy, setBusy] = useState(""),
    [previewZoom, setPreviewZoom] = useState(100),
    [mobileLibrary, setMobileLibrary] = useState(false),
    [assetName, setAssetName] = useState(""),
    [assetCount, setAssetCount] = useState(0),
    [assetEpoch, setAssetEpoch] = useState(0),
    [deleteRequest, setDeleteRequest] = useState<{ scope: DeleteScope; ids: number[]; theme: string } | null>(null),
    [undoDeletion, setUndoDeletion] = useState<{
      project: Project; active: number; selected: number[]; theme: string;
    } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    importInput = useRef<HTMLInputElement>(null),
    artInput = useRef<HTMLInputElement>(null),
    assetInput = useRef<HTMLInputElement>(null);
  // Native embed can unmount on in-app navigation before the normal 500ms autosave.
  // Flush the latest card edit instead of silently dropping the last change.
  const latestProjectRef=useRef<Project|null>(null);
  latestProjectRef.current=project;
  useEffect(()=>()=>{const snapshot=latestProjectRef.current;if(snapshot)void saveProject(snapshot).catch(()=>{});},[]);
  const card = project?.cards.find((c) => c.id === active);
  const packFiles = assetCount ? getActivePack()?.files : undefined;
  const packMissingMask = !!packFiles && (card?.pendulum ? !packFiles["mask:pendulum"] : !packFiles["mask:default"]);
  const packMissingNameFont = !!packFiles && !packFiles["font:name"];
  useEffect(() => {
    let live = true;
    loadProject()
      .then((p) => {
        if (!live) return;
        const value = p ?? demoProject();
        const migrated = { ...value, cards: value.cards.map(normalizeCardTraits) };
        setProject(migrated);
        setActive(migrated.cards[0]?.id ?? 0);
        setSelected(migrated.cards.map((c) => c.id));
      })
      .catch(() => {
        if (live) {
          const p = demoProject();
          setProject(p);
          setActive(p.cards[0].id);
          setSelected(p.cards.map((c) => c.id));
          setToast("저장소를 읽지 못했습니다. JSON 백업을 사용해 주세요.");
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    loadAssetPack().then((pack) => {
      if (!live || !pack) return;
      setActivePack(pack);
      setAssetName(pack.name);
      setAssetCount(Object.keys(pack.files).length);
      setAssetEpoch((n) => n + 1);
    }).catch(() => { if (live) setToast("자산팩 복원 실패 · ZIP을 다시 가져와 주세요."); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!project) return;
    setSaveState("저장 중");
    const timer = setTimeout(() => {
      saveProject(project)
        .then(() => setSaveState("이 기기에 저장됨"))
        .catch(() => setSaveState("저장 실패 · JSON 백업 필요"));
    }, 500);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    let live = true;
    if (!card) return;
    // The previous card is not a valid preview of a newly selected card.
    // Keep its canvas hidden until the new card finishes rendering.
    setPreviewState("loading");
    setRenderError("");
    setRenderedFontSize(null);
    const target = document.createElement("canvas");
    renderCard(card, target)
      .then((result) => {
        if (live && canvas.current) {
          canvas.current.width = target.width;
          canvas.current.height = target.height;
          canvas.current.getContext("2d")!.drawImage(target, 0, 0);
          setRenderError("");
          setRenderedFontSize(result.fontSize);
          setPreviewState("ready");
        }
      })
      .catch((e) => {
        if (live) {
          setRenderError(e instanceof Error ? e.message : String(e));
          setPreviewState("error");
          setRenderedFontSize(null);
        }
      });
    return () => {
      live = false;
    };
  }, [card, assetEpoch]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const update = (value: Partial<Card>) => {
    if (!card) return;
    setUndoDeletion(null);
    setProject((p) =>
      p
        ? {
            ...p,
            cards: p.cards.map((c) =>
              c.id === active ? { ...c, ...value } : c,
            ),
          }
        : p,
    );
  };
  const changeId = (value: string) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1 || id > 4294967295) {
      setToast("유효한 카드 ID를 입력해 주세요.");
      return;
    }
    if (project?.cards.some((c) => c.id === id && c.id !== active)) {
      setToast("이미 사용 중인 카드 ID입니다.");
      return;
    }
    update({ id });
    setSelected((s) => s.map((n) => (n === active ? id : n)));
    setActive(id);
  };
  const addCard = (duplicate = false) => {
    if (!project) return;
    setUndoDeletion(null);
    const id = nextId(project.cards);
    const c =
      duplicate && card
        ? { ...card, id, name: card.name + " · 복사" }
        : newCard(id, theme === "전체 테마" ? "새로운 테마" : theme);
    setProject({ ...project, cards: [...project.cards, c] });
    setActive(id);
    setSelected((s) => [...s, id]);
    setMobileLibrary(false);
    setTab("정보");
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > 60 * 1024 * 1024)
        throw Error("가져오기 파일은 60MB 이하로 선택하세요.");
      let incoming: Card[];
      if (file.name.toLowerCase().endsWith(".cdb"))
        incoming = await readCDB(new Uint8Array(await file.arrayBuffer()));
      else incoming = parseImport(JSON.parse(await file.text()));
      if (incoming.length > 2000)
        throw Error("한 번에 2000장까지 가져올 수 있습니다.");
      setUndoDeletion(null);
      setProject((p) =>
        p ? { ...p, cards: mergeCards(p.cards, incoming) } : p,
      );
      setActive(incoming[0].id);
      setSelected(incoming.map((c) => c.id));
      setTheme("전체 테마");
      setToast(`${incoming.length}장 가져옴 · 기존 일러스트 유지`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "가져오기 실패");
    }
  };
  const uploadAssets = async (file: File) => {
    setBusy("카드 리소스 분류 중");
    try {
      const report = await importAssetZip(file);
      await saveAssetPack(report.pack);
      setActivePack(report.pack);
      setAssetName(report.pack.name);
      setAssetCount(Object.keys(report.pack.files).length);
      setAssetEpoch((n) => n + 1);
      setToast("리소스 " + Object.keys(report.pack.files).length + "종 적용 · 중복 " + report.duplicates + "건 정리");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "리소스 ZIP을 읽을 수 없습니다.");
    } finally { setBusy(""); }
  };
  const clearAssets = async () => {
    try {
      await saveAssetPack(null);
      setActivePack(null);
      setAssetName("");
      setAssetCount(0);
      setAssetEpoch((n) => n + 1);
      setToast("기본 프레임으로 돌아왔습니다.");
    } catch { setToast("자산팩 초기화에 실패했습니다."); }
  };
  const uploadArt = async (file: File) => {
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw Error("10MB 이하 PNG, JPG, WebP를 선택하세요.");
      const data = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const img = new Image();
      img.src = data;
      await img.decode();
      if (img.width * img.height > 40_000_000)
        throw Error("4000만 픽셀 이하 이미지를 선택하세요.");
      update({ artwork: data, artCrop: undefined, zoom: 1, offsetX: 0, offsetY: 0 });
      setToast("일러스트를 적용했습니다.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "이미지를 읽을 수 없습니다.");
    }
  };
  const visibleCards = project?.cards.filter(
    (c) =>
      (theme === "전체 테마" || c.theme === theme) &&
      `${c.name} ${c.id}`.toLowerCase().includes(filter.toLowerCase()),
  ) ?? [];
  const visibleIds = visibleCards.map((c) => c.id);

  const openDelete = (scope: DeleteScope) => {
    if (!project) return;
    const targets = getDeletionTargets(project.cards, scope, selected, visibleIds, theme);
    if (!targets.length) {
      setToast("삭제할 카드를 먼저 선택하거나 구체적인 테마를 선택해 주세요.");
      return;
    }
    setDeleteRequest({ scope, ids: targets.map((c) => c.id), theme });
  };
  const confirmDelete = () => {
    if (!project || !deleteRequest) return;
    const requestedIds = new Set(deleteRequest.ids);
    const targets = project.cards.filter((c) =>
      requestedIds.has(c.id) &&
      (deleteRequest.scope !== "theme" || c.theme === deleteRequest.theme),
    );
    if (!targets.length) {
      setDeleteRequest(null);
      return;
    }
    setUndoDeletion({ project, active, selected, theme });
    const deletedIds = targets.map((c) => c.id);
    const deletedSet = new Set(deletedIds);
    const next = deleteProjectCards(project, deletedIds);
    setProject(next);
    setSelected((s) => s.filter((id) => !deletedSet.has(id)));
    if (!next.cards.some((c) => c.id === active)) {
      const sameTheme = next.cards.find((c) => c.theme === card?.theme);
      setActive(sameTheme?.id ?? next.cards[0]?.id ?? 0);
    }
    if (theme !== "전체 테마" && !next.cards.some((c) => c.theme === theme))
      setTheme("전체 테마");
    setDeleteRequest(null);
    setToast(`${targets.length}장 삭제 · '삭제 취소'로 복원할 수 있습니다.`);
  };
  const undoLastDeletion = () => {
    if (!undoDeletion) return;
    setProject(undoDeletion.project);
    setActive(undoDeletion.active);
    setSelected(undoDeletion.selected);
    setTheme(undoDeletion.theme);
    setUndoDeletion(null);
    setToast("삭제한 카드를 복원했습니다.");
  };
  const saveBackupJson = () => {
    if (!project) return;
    download(
      new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
      "duelmind-before-delete.json",
    );
  };
  const doExport = async (zip: boolean) => {
    if (!project || !card) return;
    setBusy("이미지 준비 중");
    try {
      if (zip) {
        const cards = project.cards.filter((c) => selected.includes(c.id));
        const blob = await exportZip(cards, format, setBusy);
        download(blob, "duelmind-cards.zip");
      } else await exportOne(card, format, size);
      setToast(
        zip
          ? "ZIP 다운로드를 시작했습니다."
          : "이미지 다운로드를 시작했습니다.",
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : "출력 실패");
    } finally {
      setBusy("");
    }
  };
  if (!project)
    return (
      <div className="loading">
        <Layers /> 카드 작업실을 준비하고 있습니다…
      </div>
    );
  if (!card)
    return (
      <div className="empty-workspace">
        <Layers size={42} />
        <h1>작업실에 카드가 없습니다.</h1>
        <p>새 카드를 만들거나 CDB / JSON 파일을 불러올 수 있어요.</p>
        <div className="empty-workspace-actions">
          <button className="primary" onClick={() => addCard()}>
            <Plus size={16} /> 새 카드 만들기
          </button>
          <button onClick={() => importInput.current?.click()}>
            <ArrowUpFromLine size={16} /> CDB / JSON 가져오기
          </button>
          {undoDeletion && (
            <button onClick={undoLastDeletion}>
              <RotateCcw size={16} /> 직전 삭제 취소
            </button>
          )}
        </div>
        <input
          ref={importInput}
          type="file"
          accept=".json,.cdb"
          aria-label="카드 데이터 파일"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = "";
          }}
        />
        <p>원본 CDB와 일러스트 파일은 삭제되지 않았습니다.</p>
      </div>
    );
  const themes = [...new Set(project.cards.map((c) => c.theme))];
  const visible = visibleCards;
  const visibleSelectedIds = visibleIds.filter((id) => selected.includes(id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const currentThemeCount = theme === "전체 테마" ? 0 :
    project.cards.filter((c) => c.theme === theme).length;
  const deletePreview = deleteRequest
    ? project.cards.filter((c) => deleteRequest.ids.includes(c.id))
    : [];
  const errors = validateCards(
    project.cards.filter((c) => selected.includes(c.id)),
  );
  const currentErrors = validateCards([card]);
  const field = (label: string, key: keyof Card, placeholder?: string) => (
    <label className="field">
      {label}
      <input
        value={String(card[key])}
        onChange={(e) => update({ [key]: e.target.value })}
        placeholder={placeholder}
      />
    </label>
  );
  const num = (label: string, key: keyof Card, min: number, max: number) => (
    <label className="field">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={Number(card[key])}
        onChange={(e) => update({ [key]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">
            <Layers size={23} />
          </span>
          <span>
            DUELMIND<span className="brand-sub">CARD STUDIO</span>
          </span>
        </a>
        <span className="workspace-label">
          WORKSPACE <span>/</span> 나의 카드 작업실{" "}
          <span className="beta">MVP</span>
        </span>
        <div className="top-actions">
          <span className="save-state">
            <span
              className={
                saveState.startsWith("저장 실패") ? "dot warning" : "dot"
              }
            />
            {saveState}
          </span>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(project, null, 2)], {
                  type: "application/json",
                }),
                "duelmind-project.json",
              )
            }
          >
            <FileJson size={15} /> JSON 저장
          </button>
          <button className="primary" onClick={() => setModal(true)}>
            <ArrowDownToLine size={15} /> 내보내기
          </button>
        </div>
      </header>
      <div className="workspace">
        <aside className={`library ${mobileLibrary ? "mobile-open" : ""}`}>
          <div className="library-title">
            <span>
              <FolderOpen size={17} /> 테마 라이브러리
            </span>
            <span className="count">{project.cards.length}</span>
          </div>
          <div className="library-tools">
            <div className="theme-select">
              <Layers size={15} />
              <select
                aria-label="테마 선택"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option>전체 테마</option>
                {themes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="search">
              <Search size={14} />
              <input
                aria-label="카드 검색"
                placeholder="이름 또는 카드 ID 검색"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <kbd>⌕</kbd>
            </div>
          </div>
          <div className="list-heading">
            <span>
              CARDS <small>{visible.length}</small>
            </span>
            <button
              className="text-button"
              disabled={!visible.length}
              onClick={() => setSelected((current) => toggleVisibleSelection(current, visibleIds))}
            >
              {allVisibleSelected ? "현재 목록 선택 해제" : "현재 목록 전체 선택"}
            </button>
          </div>
          <div className="delete-actions">
            <button
              className="delete-action"
              disabled={!visibleSelectedIds.length}
              onClick={() => openDelete("selected")}
            >
              <Trash2 size={13} /> 선택 삭제 ({visibleSelectedIds.length})
            </button>
            <button
              className="delete-action"
              disabled={!currentThemeCount}
              onClick={() => openDelete("theme")}
              title={theme === "전체 테마" ? "먼저 삭제할 테마를 선택하세요." : `${theme} 카드만 삭제`}
            >
              <Trash2 size={13} /> 현재 테마 삭제
            </button>
            {undoDeletion && (
              <button className="undo-action" onClick={undoLastDeletion}>
                <RotateCcw size={13} /> 삭제 취소
              </button>
            )}
          </div>
          <div className="card-list">
            {visible.map((c) => (
              <div
                key={c.id}
                className={`card-row ${c.id === active ? "active" : ""}`}
              >
                <input
                  type="checkbox"
                  aria-label={`${c.id} 출력 선택`}
                  checked={selected.includes(c.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, c.id]
                        : s.filter((n) => n !== c.id),
                    )
                  }
                />
                <button
                  className="card-pick"
                  onClick={() => {
                    setActive(c.id);
                    setMobileLibrary(false);
                  }}
                >
                  <span className={`thumb ${c.frame}`}>
                    {c.artwork ? (
                      <img src={c.artwork} alt="" />
                    ) : (
                      <ImageIcon size={20} />
                    )}
                  </span>
                  <span className="card-summary">
                    <strong>{c.name}</strong>
                    <span>{c.id}</span>
                    <small>
                      <i className={`type-dot ${c.frame}`} />
                      {FRAMES[c.frame]}{" "}
                      {c.frame === "spell" || c.frame === "trap"
                        ? "카드"
                        : "몬스터"}
                    </small>
                  </span>
                </button>
                {c.id === active && <span className="selected-mark" />}
              </div>
            ))}
            {!visible.length && <p className="empty">검색 결과가 없습니다.</p>}
          </div>
          <div className="library-bottom">
            <button className="new-card" onClick={() => addCard()}>
              <Plus size={16} /> 새 카드 만들기
            </button>
            <button
              className="import-button"
              onClick={() => importInput.current?.click()}
            >
              <ArrowUpFromLine size={15} /> CDB / JSON 가져오기
            </button>
            <input
              ref={importInput}
              type="file"
              accept=".json,.cdb"
              aria-label="카드 데이터 파일"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
            <button
              className="import-button"
              onClick={() => assetInput.current?.click()}
              title="ZIP 안의 프레임과 아이콘을 자동으로 분류합니다"
            >
              <Layers size={15} /> 카드 프레임 ZIP 불러오기
            </button>
            <input
              ref={assetInput}
              type="file"
              accept=".zip,application/zip"
              aria-label="카드 프레임 리소스 ZIP"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAssets(file);
                e.target.value = "";
              }}
            />
            {assetCount > 0 && (
              <button className="text-button" onClick={() => void clearAssets()}>
                기본 프레임 복귀
              </button>
            )}
            <div className="local-note">
              <span className="dot" />
              {assetCount > 0 ? assetName + " · " + assetCount + "종 자동 적용" : "카드 프레임은 현재 기본 디자인입니다."}
            </div>
            {assetCount > 0 && (packMissingMask || packMissingNameFont) && (
              <div className="local-note" role="status">
                {packMissingMask ? "마스크 누락 · " : ""}
                {packMissingNameFont ? "원본 한국어 카드명 폰트 누락" : ""}
              </div>
            )}
            <div className="local-note">리소스 파일은 이 브라우저에 저장되며 공개 서버로 업로드되지 않습니다.</div>
          </div>
        </aside>
        <main className="stage">
          <div className="stage-toolbar">
            <div className="breadcrumb">
              <button
                className="mobile-toggle"
                aria-label="라이브러리 열기"
                onClick={() => setMobileLibrary(!mobileLibrary)}
              >
                <PanelLeft size={17} />
              </button>
              <span>{card.theme}</span>
              <ChevronRight size={13} />
              <strong>카드 편집</strong>
            </div>
            <div className="stage-options">
              <span className="live-dot" /> {assetCount ? "자산팩 미리보기" : "실시간 미리보기"}{" "}
              <button
                title="카드 복제"
                aria-label="카드 복제"
                onClick={() => addCard(true)}
              >
                <Copy size={15} />
              </button>
            </div>
          </div>
          <div className="preview-area">
            <div className="preview-label">
              <span className="eyebrow">YOUR NEXT ACE</span>
              <h1>상상을, 한 장의 카드로.</h1>
            </div>
            <div
              className="card-object"
              style={
                { "--preview-scale": previewZoom / 100 } as React.CSSProperties
              }
            >
              <canvas
                ref={canvas}
                role="img"
                aria-label={`${card.name} 카드 미리보기`}
                style={{ visibility: previewState === "ready" ? "visible" : "hidden" }}
              />
              {previewState !== "ready" && (
                <div className="preview-status" role="status" aria-live="polite">
                  <span>{card.name}</span>
                  <strong>{previewState === "loading" ? "카드 렌더링 중…" : "미리보기 생성 실패"}</strong>
                  <small>{previewState === "error" ? "효과문 및 카드 설정을 확인해 주세요." : "카드 내용과 글꼴을 적용하고 있습니다."}</small>
                </div>
              )}
            </div>
            <div className="preview-caption">
              <span className="small-diamond" /> {card.id}{" "}
              <span className="separator">/</span> CUSTOM EDITION
            </div>
            {renderError && (
              <div role="alert" className="render-error">
                {renderError}
              </div>
            )}
            {previewState === "ready" && renderedFontSize !== null && renderedFontSize <= 23 && (
              <div className="render-density-warning" role="status">
                글씨가 매우 작습니다 ({renderedFontSize}px). 고화질로 확인하고 필요하면 효과문을 정리하세요.
              </div>
            )}
            {packMissingMask && (
              <div role="alert" className="render-error">
                카드 마스크가 자산 ZIP에 없습니다. 펜듈럼/일반 마스크 2개를 포함한 새 ZIP을 불러오세요.
              </div>
            )}
            <div className="preview-zoom">
              <button
                aria-label="미리보기 축소"
                disabled={previewZoom <= 75}
                onClick={() => setPreviewZoom((z) => z - 25)}
              >
                <Minus size={14} />
              </button>
              <span>{previewZoom}%</span>
              <button
                aria-label="미리보기 확대"
                disabled={previewZoom >= 150}
                onClick={() => setPreviewZoom((z) => z + 25)}
              >
                <Plus size={14} />
              </button>
              <i />
              <button
                aria-label="미리보기 배율 초기화"
                onClick={() => setPreviewZoom(100)}
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
          <div className="stage-footer">
            <span>
              <CheckCircle2 size={14} /> 브라우저에서 렌더링
            </span>
            <span>
              421 × 614 px <span className="separator">·</span> EDOPro 비율
            </span>
            <button className="text-button" onClick={() => setModal(true)}>
              출력 설정 <ChevronRight size={13} />
            </button>
          </div>
        </main>
        <aside className="inspector">
          <div className="inspector-title">
            <span>
              <SlidersHorizontal size={16} /> 카드 편집
            </span>
            <span className="editing-badge">EDITING</span>
          </div>
          <div className="tabs" role="tablist">
            {["정보", "일러스트"].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
              >
                {t === "정보" ? (
                  <LayoutGrid size={14} />
                ) : (
                  <ImageIcon size={14} />
                )}{" "}
                {t}
              </button>
            ))}
          </div>
          <div className="inspector-content">
            {tab === "정보" ? (
              <>
                <div className="section-label">
                  기본 정보 <span>01</span>
                </div>
                <label className="field">
                  카드 ID{" "}
                  <span className="label-tip">
                    이미지 파일명으로 사용됩니다
                  </span>
                  <input
                    key={card.id}
                    defaultValue={card.id}
                    inputMode="numeric"
                    onBlur={(e) => {
                      if (e.target.value !== String(card.id))
                        changeId(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                </label>
                {field("카드명", "name")}
                {field("테마", "theme")}
                <label className="field">
                  카드 프레임
                  <select
                    value={card.frame}
                    onChange={(e) => {
                      const frame = e.target.value as Frame;
                      update({
                        frame,
                        ...(["spell", "trap", "link", "token"].includes(frame)
                          ? { pendulum: false }
                          : {}),
                        ...(["spell", "trap"].includes(frame)
                          ? { traits: [] }
                          : {}),
                        ...(frame === "link"
                          ? { level: 2, arrows: [1, 4] }
                          : {}),
                        ...(frame === "token"
                          ? { traits: [], arrows: [], pendulumEffect: "" }
                          : {}),
                      });
                    }}
                  >
                    {Object.entries(FRAMES).map(([v, l]) => (
                      <option key={v} value={v}>
                        {v === "token" ? "토큰" : `${l} ${v === "spell" || v === "trap" ? "카드" : "몬스터"}`}
                      </option>
                    ))}
                  </select>
                </label>
                {card.frame === "token" && (
                  <div className="notice">
                    <Info size={15} />
                    <span>토큰은 효과로 소환되는 카드입니다. 메인 덱에는 직접 넣지 않습니다.</span>
                  </div>
                )}
                {isMonster(card) ? (
                  <>
                    <div className="form-grid">
                      <label className="field">
                        속성
                        <select
                          value={card.attribute}
                          onChange={(e) =>
                            update({ attribute: e.target.value })
                          }
                        >
                          {ATTRIBUTES.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      </label>
                      {num(
                        card.frame === "link"
                          ? "링크"
                          : card.frame === "xyz"
                            ? "랭크"
                            : "레벨",
                        "level",
                        0,
                        13,
                      )}
                    </div>
                    <label className="field">
                      종족
                      <select
                        value={card.race}
                        onChange={(e) => update({ race: e.target.value })}
                      >
                        {RACES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    {card.frame !== "token" && <fieldset className="trait-fieldset">
                      <legend>몬스터 특성</legend>
                      <div className="trait-grid">
                        {MONSTER_TRAITS.map((trait: MonsterTrait) => (
                          <label key={trait} className="trait-option">
                            <input
                              type="checkbox"
                              checked={(card.traits ?? []).includes(trait)}
                              onChange={(e) => {
                                const existing = card.traits ?? [];
                                const next = e.target.checked
                                  ? MONSTER_TRAITS.filter((t) => t === trait || existing.includes(t))
                                  : existing.filter((t) => t !== trait);
                                update({
                                  traits: next,
                                  unsupported: (card.unsupported ?? []).filter((flag) =>
                                    flag !== trait && flag !== trait + " 표기"),
                                });
                              }}
                            />
                            <span>{trait}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>}
                    <div className="form-grid">
                      {field("공격력 · ATK", "atk")}
                      {card.frame !== "link" && field("수비력 · DEF", "def")}
                    </div>
                    {card.frame === "link" && (
                      <div className="field">
                        링크 마커{" "}
                        <div className="arrows">
                          {[64, 128, 256, 8, 0, 32, 1, 2, 4].map((v, i) => (
                            <button
                              key={i}
                              disabled={!v}
                              aria-label={`링크 마커 ${v}`}
                              aria-pressed={card.arrows.includes(v)}
                              className={card.arrows.includes(v) ? "on" : ""}
                              onClick={() =>
                                update({
                                  arrows: card.arrows.includes(v)
                                    ? card.arrows.filter((a) => a !== v)
                                    : [...card.arrows, v],
                                })
                              }
                            >
                              {["↖", "↑", "↗", "←", "◇", "→", "↙", "↓", "↘"][i]}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {card.frame !== "link" && card.frame !== "token" && (
                      <label className="switch-row">
                        펜듈럼 카드
                        <input
                          type="checkbox"
                          checked={card.pendulum}
                          onChange={(e) =>
                            update({ pendulum: e.target.checked })
                          }
                        />
                        <span className="switch" />
                      </label>
                    )}
                    {card.pendulum && (
                      <>
                        <div className="form-grid">
                          {num("왼쪽 스케일", "scaleLeft", 0, 13)}
                          {num("오른쪽 스케일", "scaleRight", 0, 13)}
                        </div>
                        <label className="field">
                          펜듈럼 효과
                          <textarea
                            rows={4}
                            value={card.pendulumEffect}
                            onChange={(e) =>
                              update({ pendulumEffect: e.target.value })
                            }
                          />
                        </label>
                      </>
                    )}
                  </>
                ) : (
                  <label className="field">
                    카드 종류
                    <select
                      value={card.subtype}
                      onChange={(e) => update({ subtype: e.target.value })}
                    >
                      {(card.frame === "spell"
                        ? ["일반", "속공", "지속", "장착", "필드", "의식"]
                        : ["일반", "지속", "카운터"]
                      ).map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="section-label effect-heading">
                  효과 텍스트 <span>02</span>
                </div>
                <label className="field">
                  <span className="sr-only">효과 텍스트</span>
                  <textarea
                    className="effect-input"
                    rows={7}
                    value={card.effect}
                    onChange={(e) => update({ effect: e.target.value })}
                  />
                  <span className="text-counter">
                    자동 줄바꿈 · 고정 글자 수 제한 없음 <span>{card.effect.length}자</span>
                  </span>
                </label>
                {card.unsupported?.length ? (
                  <div className="notice warning-box">
                    <Info size={15} />
                    <div>
                      {card.unsupported.join(", ")}
                      <button
                        className="text-button"
                        onClick={() => update({ unsupported: [] })}
                      >
                        편집 내용 확인 완료
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="notice">
                  <Info size={15} />
                  <span>
                    미리보기와 같은 렌더러로 출력합니다.
                    <br />긴 효과는 글자 크기가 자동 조정됩니다.
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="section-label">
                  아트워크 <span>01</span>
                </div>
                <button
                  className="art-upload"
                  onClick={() => artInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0])
                      void uploadArt(e.dataTransfer.files[0]);
                  }}
                >
                  {card.artwork ? (
                    <img src={card.artwork} alt="현재 일러스트" />
                  ) : (
                    <ImagePlus size={32} />
                  )}
                  <span>
                    <ImagePlus size={17} /> 일러스트 업로드
                  </span>
                </button>
                <p className="helper">
                  PNG, JPG, WebP · 최대 10MB
                  <br />
                  이미지를 끌어놓거나 클릭해서 선택하세요.
                </p>
                <div className="section-label effect-heading">
                  이미지 위치 <span>02</span>
                </div>
                <button
                  type="button"
                  className="full-width crop-open-button"
                  disabled={!card.artwork}
                  onClick={() => setCropEditorOpen(true)}
                >
                  <Crop size={16} /> 고급 자르기 · 영역 직접 선택
                </button>
                {card.artCrop && <p className="crop-applied-label">자르기 영역 적용됨 · 고급 자르기에서 변경 가능</p>}
                {(
                  [
                    ["확대", "zoom", 1, 3, 0.01],
                    ["가로 위치", "offsetX", -100, 100, 1],
                    ["세로 위치", "offsetY", -100, 100, 1],
                  ] as const
                ).map(([label, key, min, max, step]) => (
                  <label className="field range" key={key}>
                    {label}
                    <span>
                      {key === "zoom"
                        ? `${Math.round(card.zoom * 100)}%`
                        : card[key]}
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={card[key]}
                      onChange={(e) =>
                        update({ [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
                <button
                  className="full-width"
                  onClick={() => update({ zoom: 1, offsetX: 0, offsetY: 0 })}
                >
                  <RotateCcw size={14} /> 위치 초기화
                </button>
                <div className="notice">
                  <Info size={15} />
                  <span>
                    CDB나 JSON 정보를 다시 가져와도
                    <br />
                    기존 일러스트와 위치는 유지됩니다.
                  </span>
                </div>
              </>
            )}
            <input
              ref={artInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="일러스트 파일"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadArt(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="inspector-footer">
            <span>
              <span className="dot" /> LOCAL WORKSPACE
            </span>
            <span>v0.1</span>
          </div>
        </aside>
      </div>
      {cropEditorOpen && card?.artwork && (
        <ArtworkCropEditor key={card.id} card={card}
          onCancel={() => setCropEditorOpen(false)}
          onSave={draft => {
            update(draft);
            setCropEditorOpen(false);
            setToast("자르기 영역과 위치를 저장했습니다.");
          }}
        />
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            className="export-modal"
          >
            <div className="modal-header">
              <span className="modal-icon">
                <Package size={23} />
              </span>
              <button
                className="icon-button"
                aria-label="내보내기 닫기"
                disabled={!!busy}
                onClick={() => setModal(false)}
              >
                <X size={19} />
              </button>
            </div>
            <span className="eyebrow">READY FOR YOUR NEXT DUEL</span>
            <h2 id="export-title">카드를 세상 밖으로.</h2>
            <p>한 장의 이미지부터, 덱 전체의 EDOPro 패키지까지.</p>
            <div className="export-settings">
              <label className="field">
                이미지 형식
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as "png" | "jpg")}
                >
                  <option value="png">PNG · 무손실</option>
                  <option value="jpg">JPG · 고품질</option>
                </select>
              </label>
              <label className="field">
                단일 이미지 크기
                <select
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                >
                  <option value={1263}>고화질 · 1263 × 1842</option>
                  <option value={421}>EDOPro · 421 × 614</option>
                  <option value={842}>표준 · 842 × 1228</option>
                </select>
              </label>
            </div>
            <button
              className="export-choice"
              disabled={!!busy || !!currentErrors.length || !!renderError}
              onClick={() => void doExport(false)}
            >
              <ImageIcon size={23} />
              <span>
                <strong>현재 카드 다운로드</strong>
                <small>
                  {card.id}.{format}
                </small>
              </span>
              <ArrowDownToLine size={18} />
            </button>
            <button
              className="export-choice highlighted"
              disabled={!!busy || !selected.length || !!errors.length}
              onClick={() => void doExport(true)}
            >
              <Package size={24} />
              <span>
                <strong>선택한 {selected.length}장 ZIP 다운로드</strong>
                <small>pics/ + originals/ + manifest.json</small>
              </span>
              <ArrowDownToLine size={18} />
            </button>
            <div className="export-info">
              <Check size={14} /> 파일명은 카드 ID로 저장됩니다.
              <br />
              <span>ZIP: pics 421 × 614 · originals 1263 × 1842</span>
            </div>
            {errors.length > 0 && (
              <div className="export-errors" role="alert">
                {errors.slice(0, 6).map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            {!!busy && (
              <p className="progress" role="status">
                {busy}…
              </p>
            )}
            <p className="export-disclaimer">
              이미지 제작 도구입니다. 카드 효과 구현과 실제 EDOPro 적용은 별도로
              확인해 주세요.
            </p>
          </section>
        </div>
      )}
      {deleteRequest && (
        <div className="modal-backdrop">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-explanation"
            className="export-modal deletion-modal"
          >
            <div className="modal-header">
              <span className="modal-icon deletion-icon"><Trash2 size={22} /></span>
              <button className="icon-button" aria-label="삭제 취소" onClick={() => setDeleteRequest(null)}>
                <X size={19} />
              </button>
            </div>
            <h2 id="delete-title">
              {deleteRequest.scope === "theme"
                ? `${deleteRequest.theme} 테마 카드 삭제`
                : `선택한 ${deletePreview.length}장 삭제`}
            </h2>
            <p id="delete-explanation">
              카드 스튜디오 작업실에서 {deletePreview.length}장을 삭제합니다.
              컴퓨터의 원본 CDB와 이미지 파일은 변경되지 않습니다.
            </p>
            <div className="deletion-target-list">
              {deletePreview.slice(0, 10).map((c) => (
                <div key={c.id}>
                  <strong>{c.name}</strong>
                  <span>{c.theme} · {c.id}</span>
                </div>
              ))}
              {deletePreview.length > 10 && (
                <p>그 외 {deletePreview.length - 10}장</p>
              )}
            </div>
            <p className="deletion-hint">
              삭제 전 JSON을 저장하면 새로고침 후에도 복원할 수 있습니다.
              삭제 취소 버튼은 현재 작업실을 열어둔 동안에만 지원합니다.
            </p>
            <button className="deletion-backup" onClick={saveBackupJson}>
              <FileJson size={15} /> 삭제 전 JSON 백업 다운로드
            </button>
            <div className="deletion-footer">
              <button onClick={() => setDeleteRequest(null)}>돌아가기</button>
              <button className="deletion-confirm" onClick={confirmDelete}>
                <Trash2 size={15} /> {deletePreview.length}장 삭제
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={17} />
          <span>{toast}</span>
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
