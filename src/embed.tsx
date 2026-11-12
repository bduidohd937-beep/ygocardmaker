import React from 'react';
import { createRoot } from 'react-dom/client';
import { CardMakerApp } from './main';
import makerCss from './style.css?inline';

/** Shadow DOM prevents the embedded card renderer from overriding YGO STUDIO styles. */
export function mountCardMaker(host:HTMLElement):{root:ShadowRoot;unmount:()=>void}{
  const shadow=host.shadowRoot??host.attachShadow({mode:'open'});
  shadow.replaceChildren();
  const style=document.createElement('style');
  style.textContent=`/* Embedded CARD STUDIO; the main site's navigation remains authoritative. */
:host{display:block;min-width:0;--line:#2b3038;--muted:#838c99;--lime:#d5ed98;--panel:#1a1e25;color:#d5d8dc;background:#15191f;font-family:"Noto Sans KR Variable","Noto Sans KR",sans-serif;font-size:12px;isolation:isolate}
${makerCss}
:host .topbar{height:auto;min-height:62px;flex-wrap:wrap;padding:9px 15px;gap:9px}
:host .topbar .brand,:host .topbar .workspace-label{display:none}
:host .topbar .top-actions{margin-left:0;display:flex;flex-wrap:wrap}
:host .app-shell{min-height:660px;height:auto}
:host .editor-layout{min-height:650px}
:host .toast{position:fixed}
`;
  const mount=document.createElement('div');
  mount.id='native-cardmaker-root';
  shadow.append(style,mount);
  const reactRoot=createRoot(mount);
  reactRoot.render(<React.StrictMode><CardMakerApp/></React.StrictMode>);
  return {root:shadow,unmount:()=>{reactRoot.unmount();shadow.replaceChildren();}};
}
