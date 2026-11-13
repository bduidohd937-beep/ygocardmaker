import { useEffect, useRef, useState } from "react";
import { Check, Download, ImagePlus, RotateCcw, X } from "lucide-react";
import type { Card } from "./model";
import { ATTRIBUTES, FRAMES, type Frame } from "./model";
import { DEFAULT_SIMPLE_OVERFRAME, renderSimpleOverframe, requiredSimpleOverframeAssets, type SimpleOverframe } from "./simpleOverframe";
import { download } from "./export";
import { toBlob } from "./render";

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
  const [imageAspect, setImageAspect] = useState(0.75);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const update = (p: Partial<SimpleOverframe>) => setConfig(s => ({ ...s, ...p }));

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
      void renderSimpleOverframe(result, config, name, attribute, effect, 900, frame, level)
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
  }, [config, name, attribute, effect, frame, level]);

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
    onSave({ name: name.trim() || "이름 없는 카드", attribute, frame, level, effect, simpleOverframe: config });
  };
  const exportPng = async () => {
    if (!config.image || busy) { setError("3:4 원화를 먼저 선택하세요."); return; }
    setBusy(true);
    setStatus("");
    try {
      const out = document.createElement("canvas");
      await renderSimpleOverframe(out, config, name, attribute, effect, 1500, frame, level);
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
            <canvas ref={canvas} width={450} height={600} aria-label="3:4 오버프레임 미리보기"/>
          </div>
          <p>최종 PNG 1500 × 2000 · 원화 하나만 표시 · 별도 투명 PNG/마스크 불필요</p>
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
          {config.showEffectBox && <div className="simple-of-group">
            <strong>03 · 효과창 디자인</strong>
            <label>스타일
              <select aria-label="간편 모드 효과창 스타일" value={config.effectStyle}
                onChange={e => update({ effectStyle: e.target.value as SimpleOverframe["effectStyle"] })}>
                <option value="glass">반투명 흑색</option>
                <option value="classic">OCG풍 베이지</option>
                <option value="outline">테두리만</option>
              </select>
            </label>
            {([
              ["불투명도", "effectOpacity", 0, 100, "%"],
              ["효과창 위치", "effectTop", 55, 87, "%"],
              ["효과창 높이", "effectHeight", 10, Math.min(32, 99 - config.effectTop), "%"],
            ] as const).map(([title, key, min, max, unit]) =>
              <label key={key} className="simple-of-range">
                <span>{title} <b>{config[key]}{unit}</b></span>
                <input type="range" value={config[key]} min={min} max={max} step={1}
                  onChange={e => update({
                    [key]: Number(e.target.value),
                    ...(key === "effectTop" && config.effectHeight + Number(e.target.value) > 99
                      ? { effectHeight: 99 - Number(e.target.value) } : {}),
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
