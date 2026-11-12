import React, { useEffect, useRef, useState } from "react";
import { Check, Crop, RotateCcw, X } from "lucide-react";
import { getActivePack } from "./assetPack";
import { frameKey } from "./assetRender";
import { clamp, fitCropAspect, FULL_CROP, normalizeCrop, type ArtworkCrop } from "./artworkCrop";
import type { Card } from "./model";
import { renderCard } from "./render";

type Draft = Pick<Card, "artCrop" | "zoom" | "offsetX" | "offsetY">;
type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e";
interface Gesture {
  kind: "move" | "resize" | "new";
  handle?: Handle;
  start: { x: number; y: number };
  initial: ArtworkCrop;
  pointerId: number;
}
interface Props {
  card: Card;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}

function sameAsWhole(r: ArtworkCrop) {
  return Math.abs(r.x) < 1e-6 && Math.abs(r.y) < 1e-6 &&
    Math.abs(1 - r.w) < 1e-6 && Math.abs(1 - r.h) < 1e-6;
}

export function ArtworkCropEditor({ card, onSave, onCancel }: Props) {
  const [crop, setCrop] = useState<ArtworkCrop>(() => ({ ...(card.artCrop ?? FULL_CROP) }));
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [aspectLock, setAspectLock] = useState(false);
  const [zoom, setZoom] = useState(card.zoom);
  const [offsetX, setOffsetX] = useState(card.offsetX);
  const [offsetY, setOffsetY] = useState(card.offsetY);
  const [previewError, setPreviewError] = useState("");
  const layer = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const hasAssetFrame = !!getActivePack()?.files[frameKey(card)];
  const frameAspect = hasAssetFrame ? 1 : 686 / (card.pendulum ? 539 : 625);
  // Normalized width/height ratio that matches the actual crop's pixel aspect.
  const normAspect = frameAspect * size.h / size.w;
  const handles: Handle[] = aspectLock
    ? ["nw", "ne", "sw", "se"]
    : ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, [onCancel]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const target = document.createElement("canvas");
      void renderCard({ ...card, artCrop: sameAsWhole(crop) ? undefined : crop, zoom, offsetX, offsetY }, target, 421)
        .then(() => {
          if (!active || !preview.current) return;
          const canvas = preview.current;
          canvas.width = target.width;
          canvas.height = target.height;
          canvas.getContext("2d")?.drawImage(target, 0, 0);
          setPreviewError("");
        })
        .catch((err: unknown) => {
          if (active) setPreviewError(err instanceof Error ? err.message : String(err));
        });
    }, 75);
    return () => { active = false; clearTimeout(timer); };
  }, [card, crop, zoom, offsetX, offsetY]);

  const point = (e: React.PointerEvent | React.WheelEvent) => {
    const r = layer.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };
  const begin = (e: React.PointerEvent, kind: Gesture["kind"], handle?: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    if (!layer.current) return;
    layer.current.setPointerCapture(e.pointerId);
    const start = point(e);
    gesture.current = { kind, handle, start, initial: crop, pointerId: e.pointerId };
    if (kind === "new") {
      setCrop(normalizeCrop({ x: start.x, y: start.y, w: .02, h: .02 }));
    }
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.pointerId !== e.pointerId) return;
    const p = point(e);
    if (g.kind === "move") {
      setCrop(normalizeCrop({
        ...g.initial,
        x: g.initial.x + p.x - g.start.x,
        y: g.initial.y + p.y - g.start.y,
      }));
      return;
    }
    if (g.kind === "new") {
      let w = Math.abs(p.x - g.start.x);
      let h = Math.abs(p.y - g.start.y);
      const sx = p.x >= g.start.x ? 1 : -1;
      const sy = p.y >= g.start.y ? 1 : -1;
      if (aspectLock) {
        const maxW = sx > 0 ? 1 - g.start.x : g.start.x;
        const maxH = sy > 0 ? 1 - g.start.y : g.start.y;
        w = Math.min(Math.max(w, h * normAspect), maxW, maxH * normAspect);
        h = w / normAspect;
      }
      setCrop(normalizeCrop({
        x: sx < 0 ? g.start.x - w : g.start.x,
        y: sy < 0 ? g.start.y - h : g.start.y,
        w: Math.max(.02, w),
        h: Math.max(.02, h),
      }));
      return;
    }
    const handle = g.handle!;
    const initial = g.initial;
    if (aspectLock) {
      const west = handle.includes("w"), north = handle.includes("n");
      const ax = west ? initial.x + initial.w : initial.x;
      const ay = north ? initial.y + initial.h : initial.y;
      const maxW = west ? ax : 1 - ax;
      const maxH = north ? ay : 1 - ay;
      const needed = Math.max(Math.abs(p.x - ax), Math.abs(p.y - ay) * normAspect);
      const w = clamp(Math.min(needed, maxW, maxH * normAspect), .02, 1);
      const h = w / normAspect;
      setCrop(normalizeCrop({
        x: west ? ax - w : ax, y: north ? ay - h : ay, w, h,
      }));
      return;
    }
    const left = handle.includes("w") ? clamp(p.x, 0, initial.x + initial.w - .02) : initial.x;
    const right = handle.includes("e") ? clamp(p.x, initial.x + .02, 1) : initial.x + initial.w;
    const top = handle.includes("n") ? clamp(p.y, 0, initial.y + initial.h - .02) : initial.y;
    const bottom = handle.includes("s") ? clamp(p.y, initial.y + .02, 1) : initial.y + initial.h;
    setCrop(normalizeCrop({ x: left, y: top, w: right - left, h: bottom - top }));
  };

  const finish = (e: React.PointerEvent) => {
    if (gesture.current?.pointerId === e.pointerId) gesture.current = null;
    if (layer.current?.hasPointerCapture(e.pointerId)) layer.current.releasePointerCapture(e.pointerId);
  };

  const wheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const p = point(e);
    const factor = e.deltaY < 0 ? .9 : 1.1;
    const limited = clamp(factor, Math.max(.02 / crop.w, .02 / crop.h), Math.min(1 / crop.w, 1 / crop.h));
    const fx = clamp((p.x - crop.x) / crop.w, 0, 1);
    const fy = clamp((p.y - crop.y) / crop.h, 0, 1);
    const w = crop.w * limited, h = crop.h * limited;
    setCrop(normalizeCrop({ x: p.x - fx * w, y: p.y - fy * h, w, h }));
  };

  const nudge = (e: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? .001 : .01;
    setCrop(r => normalizeCrop({
      ...r,
      x: r.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0),
      y: r.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0),
    }));
  };
  const applyAspect = () => {
    if (!aspectLock) setCrop(fitCropAspect(crop, size.w, size.h, frameAspect));
    setAspectLock(!aspectLock);
  };
  const reset = () => {
    setCrop({ ...FULL_CROP });
    setZoom(1); setOffsetX(0); setOffsetY(0);
    setAspectLock(false);
  };

  return (
    <div className="modal-backdrop crop-backdrop" onMouseDown={e => {
      if (e.target === e.currentTarget) onCancel();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="crop-title" className="crop-modal">
        <header className="crop-modal-header">
          <div>
            <span className="eyebrow">ARTWORK CROP STUDIO</span>
            <h2 id="crop-title">일러스트 자르기</h2>
            <p>{card.name} · 원본은 손상되지 않습니다.</p>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="자르기 취소"><X size={20}/></button>
        </header>
        <div className="crop-layout">
          <div className="crop-workspace">
            <div className="crop-stage">
              <div
                ref={layer}
                className="crop-image-layer"
                style={{ "--crop-ratio": size.w / size.h } as React.CSSProperties}
                onPointerDown={e => begin(e, "new")}
                onPointerMove={move}
                onPointerUp={finish}
                onPointerCancel={finish}
                onWheel={wheel}
                onKeyDown={nudge}
                tabIndex={0}
                aria-label="이미지 자르기 영역, 방향키로 이동"
              >
                <img src={card.artwork} alt="일러스트 원본" draggable={false}
                  onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
                <div className="crop-selection"
                  style={{left: crop.x * 100 + "%", top: crop.y * 100 + "%",
                    width: crop.w * 100 + "%", height: crop.h * 100 + "%"}}
                  onPointerDown={e => begin(e, "move")}
                  role="presentation"
                >
                  {handles.map(h => (
                    <span key={h} className={"crop-handle crop-handle-" + h}
                      onPointerDown={e => begin(e, "resize", h)} aria-hidden="true" />
                  ))}
                  <span className="crop-center-mark" aria-hidden="true">+</span>
                </div>
              </div>
            </div>
            <p className="crop-hint">바깥쪽 드래그: 새 영역 · 안쪽 드래그: 이동 · 모서리: 크기 조절 · 휠: 영역 확대 · 방향키: 미세 이동</p>
          </div>
          <aside className="crop-controls">
            <div className="crop-preview-wrap">
              <span className="crop-control-title">카드 실시간 미리보기</span>
              <canvas ref={preview} aria-label="자른 일러스트가 반영된 카드 미리보기" />
              {previewError && <p role="alert" className="crop-preview-error">{previewError}</p>}
            </div>
            <div className="crop-control-actions">
              <button type="button" className={aspectLock ? "selected" : ""} onClick={applyAspect}>
                <Crop size={15}/>{aspectLock ? "프레임 비율 고정" : "프레임 비율 맞추기"}
              </button>
              <button type="button" onClick={() => setAspectLock(false)}>자유 비율</button>
            </div>
            <p className="crop-hint">프레임 비율을 맞추면 출력 영역을 왜곡 없이 정확하게 지정할 수 있어.</p>
            <div className="crop-ranges">
              {([
                ["확대", zoom, setZoom, 1, 3, .01, Math.round(zoom * 100) + "%"],
                ["가로 위치", offsetX, setOffsetX, -100, 100, 1, String(offsetX)],
                ["세로 위치", offsetY, setOffsetY, -100, 100, 1, String(offsetY)],
              ] as const).map(([label, value, setter, min, max, step, display]) => (
                <label key={label} className="crop-range">
                  <span>{label}<strong>{display}</strong></span>
                  <input type="range" min={min} max={max} step={step} value={value}
                    onChange={e => setter(Number(e.target.value))}/>
                </label>
              ))}
            </div>
            <p className="crop-hint">선택 영역이 카드 프레임과 다른 비율이면 바깥쪽은 자동으로 잘려 보여.</p>
          </aside>
        </div>
        <footer className="crop-modal-footer">
          <button type="button" onClick={reset}><RotateCcw size={16}/> 전체 초기화</button>
          <div>
            <button type="button" onClick={onCancel}>취소</button>
            <button type="button" className="crop-apply" onClick={() => onSave({
              artCrop: sameAsWhole(crop) ? undefined : crop, zoom, offsetX, offsetY,
            })}><Check size={16}/> 카드에 적용</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
