import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Download, ImagePlus, RotateCcw, X, Move, Save, ScanLine } from "lucide-react";
import type { Card } from "./model";
import { ATTRIBUTES, FRAMES, RACES, type Frame } from "./model";
import { supportsStats, type PanelTint, type PanelBorder } from "./effectPanel";
import { DEFAULT_SIMPLE_OVERFRAME, renderSimpleOverframe, requiredSimpleOverframeAssets, type SimpleOverframe } from "./simpleOverframe";
import { download } from "./export";
import { toBlob } from "./render";
import {
  ART_W, ART_H, builtInLayout, clampOverlayRect, completeLayout, defaultOverlayRects,
  overlayRects, snapOverlayRect, updateLayoutPart,
  type OverlayPart, type OverlayRect,
} from "./overframeLayout";

interface Props {
  card: Card;
  onCancel: () => void;
  onSave: (patch: Partial<Card>) => void;
}
const imageType = /^(image\/png|image\/jpeg|image\/webp)$/;

export function SimpleOverframeEditor({ card, onCancel, onSave }: Props) {
  const [config, setConfig] = useState<SimpleOverframe>({
    ...DEFAULT_SIMPLE_OVERFRAME, ...card.simpleOverframe,
  });
  const [name, setName] = useState(card.name);
  const [attribute, setAttribute] = useState(card.attribute);
  const [frame, setFrame] = useState<Frame>(card.frame);
  const [level, setLevel] = useState(card.level);
  const [effect, setEffect] = useState(card.effect);
  const [race, setRace] = useState(card.race);
  const [atk, setAtk] = useState(card.atk);
  const [def, setDef] = useState(card.def);
  const [imageAspect, setImageAspect] = useState(0.75);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const interactiveCard = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: number; part: OverlayPart; startX: number; startY: number;
    original: OverlayRect; baseline: SimpleOverframe; resize: boolean;
  } | null>(null);
  const [selected, setSelected] = useState<OverlayPart>("effect");
  const [snap, setSnap] = useState(true);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [presetName, setPresetName] = useState("내 레이아웃");
  const fileInput = useRef<HTMLInputElement>(null);
  const update = (p: Partial<SimpleOverframe>) => setConfig(s => ({ ...s, ...p }));
  const boxes = overlayRects(config, frame, level);
  const visible = (id: OverlayPart) =>
    id === "name" ? config.showName : id === "attribute" ? config.showAttribute :
    id === "level" ? config.showLevel !== false && !["spell","trap","link"].includes(frame) && level > 0 :
    config.showEffectBox;
  const labelFor: Record<OverlayPart, string> = {
    name: "카드명", attribute: "속성", level: frame === "xyz" ? "랭크" : "레벨", effect: "효과창",
  };
  const rectFor = (id: OverlayPart) => boxes[id];
  const applyRect = (part: OverlayPart, rect: OverlayRect, baseline = config) => {
    const corrected = clampOverlayRect(rect);
    const layout = updateLayoutPart(baseline, frame, level, part, corrected);
    setConfig(s => ({ ...s, layout }));
  };
  const pointerDown = (e: ReactPointerEvent<HTMLButtonElement>, part: OverlayPart) => {
    if (e.button !== 0 || !config.image) return;
    e.preventDefault();
    const resize = (e.target as HTMLElement).closest("[data-resize]") !== null;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId, part, startX: e.clientX, startY: e.clientY,
      original: rectFor(part), baseline: config, resize,
    };
    setSelected(part);
  };
  const pointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = drag.current;
    const bounds = interactiveCard.current?.getBoundingClientRect();
    if (!g || !bounds || e.pointerId !== g.id) return;
    const dx = (e.clientX - g.startX) * ART_W / bounds.width;
    const dy = (e.clientY - g.startY) * ART_H / bounds.height;
    if (g.resize) {
      if (g.part === "effect") {
        applyRect(g.part, { ...g.original,
          w: Math.max(180, Math.min(ART_W - g.original.x, g.original.w + dx)),
          h: Math.max(90, Math.min(ART_H - g.original.y, g.original.h + dy)),
        }, g.baseline);
      } else {
        const base = defaultOverlayRects(frame, level, g.baseline.effectTop, g.baseline.effectHeight)[g.part];
        const cap = Math.min(2, (ART_W - g.original.x) / base.w,
          (ART_H - g.original.y) / base.h);
        const scale = Math.max(.35, Math.min(cap, (g.original.w + dx) / base.w));
        applyRect(g.part, { ...g.original, w: base.w * scale, h: base.h * scale }, g.baseline);
      }
      setGuides({});
      return;
    }
    const proposed = { ...g.original, x: g.original.x + dx, y: g.original.y + dy };
    const snapped = snapOverlayRect(proposed, snap);
    applyRect(g.part, snapped.rect, g.baseline);
    setGuides(snapped.guides);
  };
  const pointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current || e.pointerId !== drag.current.id) return;
    drag.current = null;
    setGuides({});
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const changeSelectedRect = (field: "x" | "y" | "w" | "h" | "scale", value: number) => {
    const r = rectFor(selected);
    const base = defaultOverlayRects(frame, level, config.effectTop, config.effectHeight)[selected];
    const next = field === "scale" ? { ...r,
      w: base.w * Math.max(.35, Math.min(2, value / 100)),
      h: base.h * Math.max(.35, Math.min(2, value / 100)) }
      : { ...r, [field]: value };
    applyRect(selected, next);
  };
  const applyPreset = (key: string) => {
    if (!key) return;
    const layout = key.startsWith("built:")
      ? builtInLayout(key.slice(6) as "기본" | "중앙형" | "상단 여백형",
        frame, level, config.effectTop, config.effectHeight)
      : config.savedPresets?.find(p => p.name === key.slice(5))?.layout;
    if (layout) {
      update({ layout: structuredClone(layout) });
      setStatus("레이아웃 프리셋을 적용했습니다. 설정 저장을 눌러 카드에 보존하세요.");
    }
  };
  const savePreset = () => {
    const name = presetName.trim();
    if (!name || name.length > 32) { setError("프리셋 이름은 1~32자로 입력하세요."); return; }
    const others = (config.savedPresets ?? []).filter(p => p.name !== name);
    if (others.length >= 5) { setError("카드당 프리셋은 최대 5개입니다."); return; }
    update({ savedPresets: [...others, { name, layout: completeLayout(config, frame, level) }] });
    setError("");
    setStatus("현재 레이아웃을 프리셋으로 저장했습니다. 카드에 적용하면 JSON에도 보존됩니다.");
  };

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [onCancel]);

  useEffect(() => {
    if (!config.image) return;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) setImageAspect(img.naturalWidth / img.naturalHeight); };
    img.src = config.image;
    return () => { alive = false; };
  }, [config.image]);

  useEffect(() => {
    let alive = true;
    if (!config.image) {
      const ctx = canvas.current?.getContext("2d");
      if (canvas.current && ctx) {
        canvas.current.width = 450;
        canvas.current.height = 600;
        ctx.fillStyle = "#171723";
        ctx.fillRect(0, 0, 450, 600);
        ctx.textAlign = "center";
        ctx.fillStyle = "#beb4d2";
        ctx.font = '17px sans-serif';
        ctx.fillText("3:4 원화를 업로드하세요", 225, 300);
      }
      return;
    }
    const handle = window.setTimeout(() => {
      const result = document.createElement("canvas");
      void renderSimpleOverframe(result, config, name, attribute, effect, 900, frame, level, {race,atk,def})
        .then(() => {
          if (!alive || !canvas.current) return;
          const target = canvas.current;
          target.width = result.width;
          target.height = result.height;
          target.getContext("2d")?.drawImage(result, 0, 0);
          setError("");
        })
        .catch(e => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    }, 90);
    return () => { alive = false; window.clearTimeout(handle); };
  }, [config, name, attribute, effect, frame, level, race, atk, def]);

  const upload = async (file: File) => {
    try {
      if (!imageType.test(file.type) || file.size > 10 * 1024 * 1024)
        throw Error("PNG/JPG/WebP 원화만 업로드할 수 있습니다. 최대 10MB.");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("이미지를 읽지 못했습니다."));
        reader.readAsDataURL(file);
      });
      if (data.length > 15_900_000) throw Error("저장 가능한 원화 크기를 초과했습니다.");
      const img = new Image();
      img.src = data;
      await img.decode();
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40_000_000)
        throw Error("이미지는 최대 4천만 픽셀까지 지원합니다.");
      update({ image: data });
      setStatus("원화를 불러왔습니다. 프레임이나 이미지 복제 없이 한 장만 사용합니다.");
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const save = () => {
    if (!config.image) { setError("3:4 원화를 먼저 선택하세요."); return; }
    onSave({ name: name.trim() || "이름 없는 카드", attribute, frame, level, effect, race, atk, def, simpleOverframe: config });
  };
  const exportPng = async () => {
    if (!config.image || busy) { setError("3:4 원화를 먼저 선택하세요."); return; }
    setBusy(true);
    setStatus("");
    try {
      const out = document.createElement("canvas");
      await renderSimpleOverframe(out, config, name, attribute, effect, 1500, frame, level, {race,atk,def});
      const blob = await toBlob(out, "png");
      download(blob, `${card.id}.png`);
      setStatus("3:4 · 1500 × 2000 PNG 다운로드를 시작했습니다.");
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const missingAssets = requiredSimpleOverframeAssets(config, attribute, frame, level);
  return <div className="modal-backdrop simple-of-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget) onCancel();
  }}>
    <section className="simple-of-modal" role="dialog" aria-modal="true" aria-labelledby="simple-of-title">
      <header className="simple-of-header">
        <div>
          <span className="eyebrow">FULL ART OVERFRAME · 3:4</span>
          <h2 id="simple-of-title">오버프레임 간편 제작</h2>
          <p>원화 한 장에 카드명 · 속성 · 효과창만 합성해요. 기존 일반 카드 데이터와 프레임은 보존됩니다.</p>
        </div>
        <button type="button" aria-label="간편 제작 닫기" onClick={onCancel}><X size={18}/></button>
      </header>
      <div className="simple-of-layout">
        <div className="simple-of-workspace">
          <div className="simple-of-canvas-wrap">
            <div className="simple-of-interactive" ref={interactiveCard}>
              <canvas ref={canvas} width={450} height={600} aria-label="3:4 오버프레임 미리보기"/>
              {config.image && (["effect", "level", "attribute", "name"] as const).map(part => {
                if (!visible(part)) return null;
                const rect = boxes[part];
                return <button key={part} type="button"
                  aria-label={labelFor[part] + " 이동"} title={labelFor[part] + " 드래그로 이동"}
                  className={"simple-of-target" + (selected === part ? " active" : "")}
                  style={{
                    left: (rect.x / ART_W * 100) + "%", top: (rect.y / ART_H * 100) + "%",
                    width: (rect.w / ART_W * 100) + "%", height: (rect.h / ART_H * 100) + "%",
                  }}
                  onPointerDown={e => pointerDown(e, part)}
                  onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
                  {selected === part && <span className="simple-of-target-name">{labelFor[part]}</span>}
                  {selected === part && <span data-resize="true" className="simple-of-resize" aria-hidden="true"/>}
                </button>;
              })}
              {guides.x !== undefined && <span aria-hidden="true" className="simple-of-guide x" style={{ left: (guides.x / ART_W * 100) + "%" }}/>}
              {guides.y !== undefined && <span aria-hidden="true" className="simple-of-guide y" style={{ top: (guides.y / ART_H * 100) + "%" }}/>}
            </div>
          </div>
          <p>요소를 드래그해 이동 · 우하단 핸들로 크기 조절 · 선택 후 숫자로 정밀 조정</p>
          <label className="simple-of-snap"><input type="checkbox" checked={snap}
            onChange={e => setSnap(e.target.checked)}/> 가운데·안전 여백에 자동 정렬</label>
          <p>최종 PNG 1500 × 2000 · 원화 하나만 사용 · 선택 테두리와 가이드는 출력되지 않음</p>
          {Math.abs(imageAspect - 0.75) > 0.02 && config.image && (
            <p className="simple-of-warning" role="status">현재 원화는 3:4가 아니므로 좌우 또는 상하가 일부 잘려요. 3:4 원화를 권장합니다.</p>
          )}
        </div>
        <aside className="simple-of-controls">
          <div className="simple-of-group">
            <strong>01 · 3:4 원화</strong>
            <button type="button" onClick={() => fileInput.current?.click()}>
              <ImagePlus size={17}/> {config.image ? "원화 교체" : "원화 업로드"}
            </button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden
              aria-label="3대4 오버프레임 원화 파일" onChange={e => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}/>
            {!!card.artwork && (
              <button type="button" className="simple-of-subtle" onClick={() => update({ image: card.artwork })}>
                현재 카드 원화 가져오기
              </button>
            )}
            <small>3:4 비율 권장 · PNG/JPG/WebP · 최대 10MB</small>
            {missingAssets.length > 0 && <small className="simple-of-warning" role="status">
              원본 에셋 필요: {missingAssets.join(", ")}. 왼쪽 '카드 프레임 ZIP 불러오기'에서 기존 리소스를 불러와 주세요.
            </small>}
            {!missingAssets.length && <small>현재 선택한 카드 표시는 기존 리소스 에셋을 사용합니다. ({[config.showName && "카드명 폰트", config.showAttribute && "속성 PNG", config.showLevel !== false && !["spell","trap","link"].includes(frame) && "레벨/랭크 PNG"].filter(Boolean).join(" · ") || "모든 표시 숨김"})</small>}
            <small>원화에는 카드명·속성·별을 그리지 않아야 중복 표시되지 않습니다.</small>
          </div>
          <div className="simple-of-group">
            <strong>02 · 카드 정보</strong>
            <label>카드명
              <input aria-label="간편 모드 카드명" value={name} maxLength={120}
                onChange={e => setName(e.target.value)}/>
            </label>
            <label>카드 종류
              <select aria-label="간편 모드 카드 종류" value={frame} onChange={e => setFrame(e.target.value as Frame)}>
                {Object.entries(FRAMES).map(([key, value]) => (
                  <option key={key} value={key}>{value}{["spell", "trap"].includes(key) ? " 카드" : " 몬스터"}</option>
                ))}
              </select>
            </label>
            {!["spell", "trap"].includes(frame) && <label>속성
              <select aria-label="간편 모드 속성" value={attribute} onChange={e => setAttribute(e.target.value)}>
                {ATTRIBUTES.map(a => <option value={a} key={a}>{a}</option>)}
              </select>
            </label>}
            {!["spell", "trap"].includes(frame) && <label>{frame === "xyz" ? "랭크" : frame === "link" ? "링크" : "레벨"}
              <input type="number" aria-label="간편 모드 레벨/랭크" min={0} max={13}
                value={level} onChange={e => setLevel(Math.min(13, Math.max(0, Number(e.target.value) || 0)))}/>
            </label>}
            <label>효과 텍스트 (선택)
              <textarea aria-label="간편 모드 효과 텍스트" rows={3} value={effect}
                onChange={e => setEffect(e.target.value)}/>
            </label>
            <label className="simple-of-check"><input type="checkbox" checked={config.showName}
              onChange={e => update({ showName: e.target.checked })}/> 카드명 표시</label>
            <label>카드명 배경
              <select aria-label="간편 모드 카드명 배경" value={config.titleBackdrop ?? "none"}
                onChange={e => update({ titleBackdrop: e.target.value as "none" | "shadow" | "gradient" })}>
                <option value="none">없음 (원화 그대로, 기본값)</option>
                <option value="shadow">글자 그림자만 강조</option>
                <option value="gradient">상단 검정 그라데이션</option>
              </select>
            </label>
            <label className="simple-of-check"><input type="checkbox" checked={config.showAttribute}
              onChange={e => update({ showAttribute: e.target.checked })}/> 속성 표시</label>
            {!["spell", "trap", "link"].includes(frame) && <label className="simple-of-check">
              <input type="checkbox" checked={config.showLevel !== false}
                onChange={e => update({ showLevel: e.target.checked })}/>
              {frame === "xyz" ? "랭크" : "레벨"} 아이콘 표시 (원본 별 PNG)
            </label>}
            <label className="simple-of-check"><input type="checkbox" checked={config.showEffectBox}
              onChange={e => update({ showEffectBox: e.target.checked })}/> 효과창 표시</label>
            <label className="simple-of-check"><input type="checkbox" checked={config.showEffectText}
              disabled={!config.showEffectBox}
              onChange={e => update({ showEffectText: e.target.checked })}/> 효과창에 텍스트 표시</label>
          </div>
          <div className="simple-of-group">
            <strong>03 · 자유 배치 에디터</strong>
            <label>편집할 요소
              <select aria-label="배치 요소 선택" value={selected}
                onChange={e => setSelected(e.target.value as OverlayPart)}>
                {(["name","attribute","level","effect"] as const).filter(visible).map(k =>
                  <option key={k} value={k}>{labelFor[k]}</option>)}
              </select>
            </label>
            {visible(selected) && <>
              <div className="simple-of-number-grid">
                {(["x","y"] as const).map(field => <label key={field}>
                  {field === "x" ? "가로 X" : "세로 Y"}
                  <input aria-label={labelFor[selected] + " " + field.toUpperCase()} type="number"
                    min="0" max={field === "x" ? ART_W : ART_H} step="1"
                    value={Math.round(boxes[selected][field])}
                    onChange={e => changeSelectedRect(field, Number(e.target.value))}/>
                </label>)}
              </div>
              {selected === "effect" ? <div className="simple-of-number-grid">
                {(["w","h"] as const).map(field => <label key={field}>
                  {field === "w" ? "효과창 너비" : "효과창 높이"}
                  <input aria-label={"효과창 " + field.toUpperCase()} type="number"
                    min={field === "w" ? 180 : 90} max={field === "w" ? ART_W : ART_H}
                    value={Math.round(boxes.effect[field])}
                    onChange={e => changeSelectedRect(field, Number(e.target.value))}/>
                </label>)}
              </div> : <label className="simple-of-range">
                <span>크기 <b>{Math.round(boxes[selected].w /
                  defaultOverlayRects(frame, level, config.effectTop, config.effectHeight)[selected].w * 100)}%</b></span>
                <input aria-label={labelFor[selected] + " 크기"} type="range" min="35" max="200"
                  value={Math.round(boxes[selected].w /
                    defaultOverlayRects(frame, level, config.effectTop, config.effectHeight)[selected].w * 100)}
                  onChange={e => changeSelectedRect("scale", Number(e.target.value))}/>
              </label>}
            </>}
            <button type="button" className="simple-of-subtle" onClick={() => update({ layout: undefined })}>
              <RotateCcw size={15}/> 전체 위치 초기화
            </button>
          </div>
          <div className="simple-of-group">
            <strong>04 · 레이아웃 프리셋</strong>
            <label>불러오기
              <select aria-label="오버프레임 프리셋 불러오기" value=""
                onChange={e => applyPreset(e.target.value)}>
                <option value="">프리셋 선택…</option>
                <option value="built:기본">기본 OCG형</option>
                <option value="built:중앙형">중앙 일러스트형</option>
                <option value="built:상단 여백형">하단 효과창형</option>
                {(config.savedPresets ?? []).map(p =>
                  <option key={p.name} value={"save:" + p.name}>{p.name}</option>)}
              </select>
            </label>
            <label>내 프리셋 이름
              <input aria-label="프리셋 이름" value={presetName} maxLength={32}
                onChange={e => setPresetName(e.target.value)}/>
            </label>
            <button type="button" onClick={savePreset}><Save size={15}/> 현재 배치 프리셋 저장</button>
            <small>이 카드의 프리셋은 최대 5개까지 카드 JSON에 함께 저장됩니다.</small>
          </div>
          {config.showEffectBox && <div className="simple-of-group">
            <strong>05 · 효과창 디자인</strong>
            <label>스타일
              <select aria-label="간편 모드 효과창 스타일" value={config.effectStyle}
                onChange={e => update({ effectStyle: e.target.value as SimpleOverframe["effectStyle"] })}>
                <option value="ocg">OCG풍 정교한 효과창 (신규)</option>
                <option value="glass">반투명 흑색 (기존)</option>
                <option value="classic">베이지 단색 (기존)</option>
                <option value="outline">테두리만 (기존)</option>
              </select>
            </label>
            <label>테두리 색감
              <select aria-label="효과창 테두리 색감" value={config.panelTint ?? "auto"}
                onChange={e => update({ panelTint: e.target.value as PanelTint })}>
                <option value="auto">카드 종류에 따라 자동</option>
                <option value="charcoal">차콜 · 엑시즈풍</option>
                <option value="violet">자수정 · 융합풍</option>
                <option value="silver">은회색 · 싱크로풍</option>
                <option value="azure">청회색 · 링크풍</option>
                <option value="sepia">고동색 · 일반 효과풍</option>
              </select>
            </label>
            <label>테두리 구성
              <select aria-label="효과창 테두리 구성" value={config.panelBorder ?? "double"}
                onChange={e => update({ panelBorder: e.target.value as PanelBorder })}>
                <option value="double">이중 정교 테두리</option>
                <option value="single">단일 테두리</option>
                <option value="none">테두리 없음</option>
              </select>
            </label>
            <div className="simple-of-number-grid">
              <label>테두리 굵기
                <input type="number" min="1" max="6" step="0.5" aria-label="효과창 테두리 굵기"
                  value={config.borderThickness ?? 2}
                  onChange={e => update({ borderThickness: Math.max(1,Math.min(6,Number(e.target.value)||1)) })}/>
              </label>
              <label>질감 강도
                <input type="number" min="0" max="100" step="5" aria-label="효과창 질감 강도"
                  value={config.panelTexture ?? 22}
                  onChange={e => update({ panelTexture: Math.max(0,Math.min(100,Number(e.target.value)||0)) })}/>
              </label>
            </div>
            <label className="simple-of-check">
              <input type="checkbox" checked={config.showTypeLine ?? false}
                onChange={e => update({ showTypeLine: e.target.checked })}/>
              종족·소환 방식 표기
            </label>
            {config.showTypeLine && supportsStats(frame) && <label>종족
              <select aria-label="간편 모드 종족" value={race} onChange={e => setRace(e.target.value)}>
                {RACES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>}
            {supportsStats(frame) && <label className="simple-of-check">
              <input type="checkbox" checked={config.showStats ?? false}
                onChange={e => update({ showStats: e.target.checked })}/>
              공격력·수비력 표시 {frame === "link" ? "(ATK·LINK)" : "(ATK·DEF)"}
            </label>}
            {!!config.showStats && supportsStats(frame) && <>
              <div className="simple-of-number-grid">
                <label>공격력
                  <input aria-label="간편 모드 공격력" value={atk} maxLength={6}
                    onChange={e => setAtk(e.target.value.replace(/[^0-9?]/g,"").slice(0,6))}/>
                </label>
                {frame !== "link" && <label>수비력
                  <input aria-label="간편 모드 수비력" value={def} maxLength={6}
                    onChange={e => setDef(e.target.value.replace(/[^0-9?]/g,"").slice(0,6))}/>
                </label>}
              </div>
              <label className="simple-of-range">
                <span>공수 표기 크기 <b>{config.statsFontSize ?? 20}px</b></span>
                <input type="range" min="14" max="32" step="1"
                  aria-label="공수 표기 크기" value={config.statsFontSize ?? 20}
                  onChange={e => update({ statsFontSize: Number(e.target.value) })}/>
              </label>
            </>}
            <small>원본 효과문·종족 폰트를 사용합니다. 공간이 부족하면 효과문을 잘라내지 않고 알려줍니다.</small>
            {([
              ["불투명도", "effectOpacity", 0, 100, "%"],
            ] as const).map(([title, key, min, max, unit]) =>
              <label key={key} className="simple-of-range">
                <span>{title} <b>{config[key]}{unit}</b></span>
                <input type="range" value={config[key]} min={min} max={max} step={1}
                  onChange={e => update({
                    [key]: Number(e.target.value),
                  })}/>
              </label>
            )}
            <button type="button" className="simple-of-subtle" onClick={() => setConfig(s => ({
              ...DEFAULT_SIMPLE_OVERFRAME, image: s.image,
            }))}><RotateCcw size={15}/> 디자인 초기화</button>
          </div>}
        </aside>
      </div>
      {!!error && <p className="simple-of-error" role="alert">{error}</p>}
      {!!status && <p className="simple-of-status" role="status">{status}</p>}
      <footer className="simple-of-footer">
        <button type="button" onClick={onCancel}>취소</button>
        <button type="button" onClick={save}><Check size={16}/> 설정 저장</button>
        <button type="button" className="simple-of-primary" disabled={busy} onClick={() => void exportPng()}>
          <Download size={16}/> {busy ? "생성 중..." : "3:4 PNG 다운로드"}
        </button>
      </footer>
    </section>
  </div>;
}
