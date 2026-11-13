import React, { useEffect, useRef, useState } from "react";
import { Check, Eraser, Eye, EyeOff, Move, Paintbrush, Redo2, RotateCcw, Undo2, X } from "lucide-react";
import type { Card } from "./model";
import {
  DEFAULT_OVERFRAME, cardToOverframeImage, overframePlacement, type OverframeLayer,
} from "./overframe";
import { loadImage, renderCard } from "./render";

type Tool = "move" | "erase" | "restore";
type Gesture = {
  id: number;
  from: OverframeLayer;
  point: { x: number; y: number };
  lastSource?: { x: number; y: number };
};
type Props = {
  card: Card;
  onCancel: () => void;
  onSave: (overframe: OverframeLayer) => void;
};
const bound = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function OverframeEditor({ card, onCancel, onSave }: Props) {
  const [draft, setDraftState] = useState<OverframeLayer>(() => ({
    ...DEFAULT_OVERFRAME, ...card.overframe, enabled: true,
  }));
  const draftRef = useRef(draft);
  const [tool, setTool] = useState<Tool>("move");
  const [brush, setBrush] = useState(24);
  const [previewError, setPreviewError] = useState("");
  const [maskReady, setMaskReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const past = useRef<OverframeLayer[]>([]);
  const future = useRef<OverframeLayer[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const maskCanvas = useRef<HTMLCanvasElement | null>(null);
  const dimensions = useRef({ w: 1, h: 1 });
  const gesture = useRef<Gesture | null>(null);
  const previewThrottle = useRef(0);
  const maskRevision = useRef(0);

  const setDraft = (next: OverframeLayer) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const commit = (next: OverframeLayer, before = draftRef.current) => {
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    past.current = [...past.current.slice(-19), before];
    future.current = [];
    setDraft(next);
    setRevision(r => r + 1);
  };
  const syncMask = async (layer: OverframeLayer) => {
    const mask = maskCanvas.current;
    if (!mask) return;
    const token = ++maskRevision.current;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    if (layer.mask) {
      const img = await loadImage(layer.mask);
      if (token !== maskRevision.current) return;
      ctx.clearRect(0, 0, mask.width, mask.height);
      ctx.drawImage(img, 0, 0, mask.width, mask.height);
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, mask.width, mask.height);
    }
  };
  const undo = () => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(draftRef.current);
    setDraft(previous);
    setRevision(r => r + 1);
    void syncMask(previous).catch(e => setPreviewError(String(e)));
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(draftRef.current);
    setDraft(next);
    setRevision(r => r + 1);
    void syncMask(next).catch(e => setPreviewError(String(e)));
  };
  useEffect(() => {
    let alive = true;
    void loadImage(draftRef.current.image).then(img => {
      if (!alive) return;
      dimensions.current = { w: img.naturalWidth, h: img.naturalHeight };
      const factor = Math.min(1, 768 / Math.max(img.naturalWidth, img.naturalHeight));
      const mask = document.createElement("canvas");
      mask.width = Math.max(1, Math.round(img.naturalWidth * factor));
      mask.height = Math.max(1, Math.round(img.naturalHeight * factor));
      maskCanvas.current = mask;
      return syncMask(draftRef.current).then(() => { if (alive) setMaskReady(true); });
    }).catch(e => { if (alive) setPreviewError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [card.id]);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      const result = document.createElement("canvas");
      void renderCard({ ...card, overframe: draft }, result, 842).then(() => {
        if (!alive || !canvas.current) return;
        const dest = canvas.current;
        dest.width = result.width;
        dest.height = result.height;
        dest.getContext("2d")?.drawImage(result, 0, 0);
        setPreviewError("");
      }).catch(e => { if (alive) setPreviewError(e instanceof Error ? e.message : String(e)); });
    }, 70);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [card, draft]);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onCancel]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * 842 / rect.width,
      y: (e.clientY - rect.top) * 1228 / rect.height };
  };
  const sourcePoint = (p: { x: number; y: number }) => {
    const d = dimensions.current;
    return cardToOverframeImage(p.x, p.y, d.w, d.h, draftRef.current);
  };
  const paint = (p: { x: number; y: number }, from?: { x: number; y: number }) => {
    const target = maskCanvas.current;
    if (!target) return;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const width = overframePlacement(dimensions.current.w, dimensions.current.h, draftRef.current).w;
    const start = from ?? p;
    ctx.save();
    ctx.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, brush * target.width / width);
    ctx.beginPath();
    ctx.moveTo(start.x * target.width, start.y * target.height);
    ctx.lineTo(p.x * target.width, p.y * target.height);
    ctx.stroke();
    if (!from) {
      ctx.beginPath();
      ctx.arc(p.x * target.width, p.y * target.height, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || !draftRef.current.image) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    gesture.current = { id: e.pointerId, point: p, from: draftRef.current };
    if (tool !== "move" && maskReady) {
      const s = sourcePoint(p);
      gesture.current.lastSource = s;
      paint(s);
    }
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const p = point(e);
    if (tool === "move") {
      setDraft({ ...g.from,
        x: bound(Math.round(g.from.x + p.x - g.point.x), -350, 350),
        y: bound(Math.round(g.from.y + p.y - g.point.y), -400, 400),
      });
    } else if (maskReady) {
      const s = sourcePoint(p);
      paint(s, g.lastSource);
      g.lastSource = s;
      if (performance.now() - previewThrottle.current > 125 && maskCanvas.current) {
        previewThrottle.current = performance.now();
        setDraft({ ...draftRef.current, mask: maskCanvas.current.toDataURL("image/png") });
      }
    }
  };
  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (tool !== "move" && maskReady && maskCanvas.current) {
      commit({ ...draftRef.current, mask: maskCanvas.current.toDataURL("image/png") }, g.from);
    } else if (tool === "move") commit(draftRef.current, g.from);
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const wheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!draftRef.current.image) return;
    e.preventDefault();
    if (tool === "move") commit({ ...draftRef.current,
      scale: bound(Math.round((draftRef.current.scale + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100, 0.25, 3),
    });
    else setBrush(v => bound(v + (e.deltaY < 0 ? 2 : -2), 2, 100));
  };
  const edit = (patch: Partial<OverframeLayer>) => commit({ ...draftRef.current, ...patch });
  const resetPosition = () => edit({ x: 0, y: 0, scale: 1, rotation: 0 });
  const clearMask = () => {
    edit({ mask: undefined });
    void syncMask({ ...draftRef.current, mask: undefined }).catch(e => setPreviewError(String(e)));
  };

  return <div className="modal-backdrop of-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget) onCancel();
  }}>
    <section className="of-modal" role="dialog" aria-modal="true" aria-labelledby="of-title">
      <header className="of-header">
        <div><span className="eyebrow">OVERFRAME STUDIO V2.2</span>
          <h2 id="of-title">오버프레임 정밀 편집</h2>
          <p>{card.name} · 원본은 그대로 유지하며 적용을 누를 때 저장됩니다.</p></div>
        <button type="button" aria-label="오버프레임 편집 취소" onClick={onCancel}><X size={19}/></button>
      </header>
      <div className="of-layout">
        <div className="of-workspace">
          <div className="of-toolbar" role="toolbar" aria-label="오버프레임 도구">
            <button type="button" aria-pressed={tool === "move"} className={tool === "move" ? "active" : ""} onClick={() => setTool("move")}><Move size={16}/> 이동</button>
            <button type="button" aria-pressed={tool === "erase"} className={tool === "erase" ? "active" : ""} onClick={() => setTool("erase")}><Eraser size={16}/> 지우개</button>
            <button type="button" aria-pressed={tool === "restore"} className={tool === "restore" ? "active" : ""} onClick={() => setTool("restore")}><Paintbrush size={16}/> 마스크 복원</button>
            <span className="of-toolbar-divider"/>
            <button type="button" onClick={undo} disabled={!past.current.length} aria-label="실행 취소"><Undo2 size={16}/></button>
            <button type="button" onClick={redo} disabled={!future.current.length} aria-label="다시 실행"><Redo2 size={16}/></button>
          </div>
          <div className="of-stage">
            <canvas ref={canvas}
              aria-label="오버프레임 직접 편집 캔버스" tabIndex={0}
              style={{ cursor: tool === "move" ? "grab" : "crosshair" }}
              onPointerDown={start} onPointerMove={move} onPointerUp={finish}
              onPointerCancel={finish} onWheel={wheel}
              onKeyDown={e => {
                if (tool !== "move" || !e.key.startsWith("Arrow")) return;
                e.preventDefault();
                edit({ x: bound(draftRef.current.x + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0), -350, 350),
                  y: bound(draftRef.current.y + (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0), -400, 400) });
              }}
            />
          </div>
          <p className="of-hint">
            {tool === "move"
              ? "카드 위 드래그: 캐릭터 이동 · 휠: 크기 변경 · 방향키: 1px 이동"
              : "카드 위에서 드래그해 돌출 영역을 " + (tool === "erase" ? "지웁니다" : "복원합니다") + ". 휠: 브러시 크기 조절"}
          </p>
          {!!previewError && <p role="alert" className="of-error">{previewError}</p>}
        </div>
        <aside className="of-controls">
          <div className="of-control-heading">레이어 구성</div>
          <div className="of-layer-list">
            <div><Eye size={15}/><strong>03 · 돌출 캐릭터 / 마스크</strong></div>
            <div><Eye size={15}/><span>02 · 카드 프레임 / 문자</span></div>
            <div><Eye size={15}/><span>01 · 기본 카드 일러스트</span></div>
          </div>
          <label className="of-check">
            <input type="checkbox" checked={draft.enabled} onChange={e => edit({ enabled: e.target.checked })}/>
            {draft.enabled ? <Eye size={15}/> : <EyeOff size={15}/>} 돌출 레이어 표시
          </label>
          <label className="of-range">경계 합성
            <select aria-label="오버프레임 가림 순서" value={draft.depth ?? "front"}
              onChange={e => edit({ depth: e.target.value as "front" | "inside" })}>
              <option value="front">프레임 위로 돌출</option>
              <option value="inside">일러스트 영역 안쪽</option>
            </select>
          </label>
          <div className="of-control-heading">위치·크기·회전</div>
          {([
            ["가로", "x", -350, 350, 1],
            ["세로", "y", -400, 400, 1],
            ["크기", "scale", .25, 3, .01],
            ["회전", "rotation", -45, 45, 1],
          ] as const).map(([label, key, min, max, step]) =>
            <label className="of-range" key={key}>
              <span>{label}<strong>{key === "scale" ? Math.round(draft.scale * 100) + "%" : String(draft[key]) + (key === "rotation" ? "°" : "")}</strong></span>
              <input type="range" min={min} max={max} step={step} value={draft[key]}
                onChange={e => edit({ [key]: Number(e.target.value) })}/>
            </label>
          )}
          <button type="button" className="of-secondary" onClick={resetPosition}><RotateCcw size={15}/> 위치 초기화</button>
          <div className="of-control-heading">마스크 브러시</div>
          <label className="of-range"><span>굵기<strong>{brush}px</strong></span>
            <input aria-label="오버프레임 브러시 크기" type="range" min="2" max="100" value={brush}
              onChange={e => setBrush(Number(e.target.value))}/>
          </label>
          <p className="of-hint">지우개는 돌출 캐릭터를 감추고, 복원은 원본의 투명도까지 복원해요. 자동 배경 제거는 하지 않습니다.</p>
          <button type="button" className="of-secondary" onClick={clearMask}><RotateCcw size={15}/> 마스크 전체 복원</button>
          <p className="of-hint">실행 취소/다시 실행: Ctrl+Z / Ctrl+Shift+Z. 최대 20단계.</p>
          <small className="of-revision">편집 기록 {past.current.length} / {future.current.length} · {revision}회</small>
        </aside>
      </div>
      <footer className="of-footer">
        <button type="button" onClick={onCancel}>취소</button>
        <button type="button" className="of-apply" onClick={() => onSave(draftRef.current)}><Check size={17}/> 카드에 적용</button>
      </footer>
    </section>
  </div>;
}
