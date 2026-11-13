/** Explainable V3.7 card-layout recommendations; pixel analysis is local to browser.
 * No facial/subject recognition, external API or destructive preset application.
 */
import type { Frame } from "./model";
import type { SimpleOverframe } from "./simpleOverframe";
import { ART_H, ART_W, builtInLayout, overlayRects, type OverframeLayout, type OverlayRect } from "./overframeLayout";

export type TemplateKey = "기본" | "중앙형" | "상단 여백형";
export type ArtPixelSample = { width: number; height: number; data: Uint8ClampedArray };
export type LayoutRecommendation = {
  key: TemplateKey;
  label: string;
  score: number;
  reason: string;
  layout: OverframeLayout;
};

const TYPES: { key: TemplateKey; label: string }[] = [
  {key:"기본",label:"기본 OCG형"},
  {key:"중앙형",label:"중앙 일러스트형"},
  {key:"상단 여백형",label:"하단 효과창형"},
];
const clamp = (x: number, lo: number, hi: number) => Math.max(lo,Math.min(hi,x));

/** Crop to the same centered 3:4 region used by renderSimpleOverframe, at small resolution. */
export async function sampleArtworkForLayout(image: string): Promise<ArtPixelSample> {
  if (!image) throw Error("먼저 원화를 업로드하세요.");
  const img=new Image();
  img.src=image;
  await img.decode();
  if (!img.naturalWidth || !img.naturalHeight) throw Error("원화를 분석할 수 없습니다.");
  const canvas=document.createElement("canvas");
  canvas.width=180;canvas.height=240;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if (!ctx) throw Error("원화 픽셀 분석을 사용할 수 없습니다.");
  const ratio=ART_W/ART_H, srcRatio=img.naturalWidth/img.naturalHeight;
  let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
  if(srcRatio>ratio) {sw=img.naturalHeight*ratio;sx=(img.naturalWidth-sw)/2;}
  else {sh=img.naturalWidth/ratio;sy=(img.naturalHeight-sh)/2;}
  ctx.drawImage(img,sx,sy,sw,sh,0,0,180,240);
  return {width:180,height:240,data:ctx.getImageData(0,0,180,240).data};
}
function luma(pixel: ArtPixelSample, x: number, y: number): number {
  const p=(y*pixel.width+x)*4;
  return (pixel.data[p]*.2126+pixel.data[p+1]*.7152+pixel.data[p+2]*.0722)/255;
}
/** Local brightness and detail measure inside a proposed text/box area. */
export function regionReadability(pixels: ArtPixelSample, rect: OverlayRect) {
  if (pixels.data.length !== pixels.width*pixels.height*4)
    throw Error("원화 분석 데이터 길이가 올바르지 않습니다.");
  const x0=clamp(Math.floor(rect.x/ART_W*pixels.width),0,pixels.width-1);
  const y0=clamp(Math.floor(rect.y/ART_H*pixels.height),0,pixels.height-1);
  const x1=clamp(Math.ceil((rect.x+rect.w)/ART_W*pixels.width),x0+1,pixels.width);
  const y1=clamp(Math.ceil((rect.y+rect.h)/ART_H*pixels.height),y0+1,pixels.height);
  let luminance=0,detail=0,n=0;
  for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){
    const base=luma(pixels,x,y);
    luminance+=base;n++;
    const rx=Math.min(x+2,pixels.width-1),ry=Math.min(y+2,pixels.height-1);
    detail+=Math.abs(base-luma(pixels,rx,y))+
      Math.abs(base-luma(pixels,x,ry));
  }
  return {brightness:luminance/Math.max(1,n),detail:detail/Math.max(1,n)/2};
}
export function recommendLayoutChoices(
  card: {frame:Frame;level:number;name:string;effect:string},
  config: Pick<SimpleOverframe,"effectTop"|"effectHeight"|"showEffectBox"|"showEffectText"|
    "showStats"|"showTypeLine"|"showName"|"showAttribute"|"showLevel">,
  art?: ArtPixelSample,
): LayoutRecommendation[] {
  const effectChars=Array.from(card.effect.trim()).length;
  const charsNeeded=config.showEffectBox && config.showEffectText?effectChars:0;
  const headerFooter=(config.showTypeLine?37:0)+(config.showStats?43:0);
  return TYPES.map((item,index)=>{
    const layout=builtInLayout(item.key,card.frame,card.level,
      config.effectTop,config.effectHeight);
    const rects=overlayRects({...config,layout},card.frame,card.level);
    const box=rects.effect;
    let score=100;
    const reasons:string[]=[];
    const effectHeight=box.h-20-headerFooter;
    if(config.showEffectBox){
      const estimatedRows=charsNeeded?Math.ceil(charsNeeded/Math.max(1,Math.floor((box.w-35)/14))):0;
      const estimatedNeeded=estimatedRows*19;
      const shortage=Math.max(0,estimatedNeeded-effectHeight);
      score-=Math.min(48,shortage*.19);
      score+=Math.max(0,(1200-box.y)/30)*-.5;
      if(charsNeeded>0) reasons.push(shortage>0?"효과문 길이에 비해 효과창이 작을 수 있음":
        "효과문 길이 "+effectChars+"자에 맞는 공간");
      else reasons.push(item.key==="상단 여백형"?"원화를 넓게 보여주는 낮은 효과창":
        item.key==="중앙형"?"주인공 중심 구도에 적합한 중간 효과창":"안정적인 기본 효과창");
    }
    if(card.name.length>18 && item.key==="상단 여백형")score+=2;
    if(card.frame==="link"&&item.key==="중앙형")score+=2;
    if(card.frame==="xyz"&&item.key==="기본")score+=2;
    if(art){
      if(config.showName){
        const title=regionReadability(art,rects.name);
        // White title on darker/smoother top reads more clearly.
        score-=title.brightness*14+title.detail*31;
      }
      if(config.showEffectBox){
        const bottom=regionReadability(art,box);
        // Avoid obscuring textured part of the art; big boxes incur coverage penalty.
        score-=bottom.detail*23+bottom.brightness*3;
        score-=box.w*box.h/(ART_W*ART_H)*8;
      }
      reasons.push("원화의 밝기·윤곽선 밀도 분석 반영");
    }else reasons.push("카드 정보 기준 추천 (원화 분석 없음)");
    score-=index*.02; // deterministic tie breaker
    return {key:item.key,label:item.label,layout,
      score:Math.round(clamp(score,0,100)*10)/10,
      reason:reasons.join(" · ")};
  }).sort((a,b)=>b.score-a.score||TYPES.findIndex(p=>p.key===a.key)-TYPES.findIndex(p=>p.key===b.key));
}
