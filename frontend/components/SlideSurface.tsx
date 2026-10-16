'use client';
import React, { useRef } from 'react';
import { Scene, SceneElement, clamp, mediaSource } from '../lib/scene';

type Props = {
  scene: Scene;
  editable?: boolean;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  onChange?: (scene: Scene) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
  className?: string;
};
export default function SlideSurface({scene,editable=false,selected=[],onSelect,onChange,onGestureStart,onGestureEnd,className}: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const gesture = useRef<{id:string, mode:'move'|'resize', px:number, py:number, original:SceneElement, elements:SceneElement[], width:number,height:number}|null>(null);
  const start = (event: React.PointerEvent<HTMLDivElement>, el:SceneElement, mode:'move'|'resize') => {
    if (!editable || el.locked) return;
    event.preventDefault(); event.stopPropagation();
    const ids = event.shiftKey ? (selected.includes(el.id) ? selected.filter(id=>id!==el.id) : [...selected,el.id]) : selected.includes(el.id) ? selected : [el.id];
    onSelect?.(ids);
    if (!ids.includes(el.id)) return;
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    onGestureStart?.();
    gesture.current = { id:el.id, mode, px:event.clientX, py:event.clientY,original:{...el},elements:scene.elements.map(e=>({...e})),width:rect.width,height:rect.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !onChange) return;
    const dx = (event.clientX-g.px)/g.width*100, dy = (event.clientY-g.py)/g.height*100;
    const movingIds = selected.includes(g.id) ? selected : [g.id];
    onChange({...scene,elements:g.elements.map(element=>{
      if (!(g.mode === 'resize' ? element.id === g.id : movingIds.includes(element.id))) return element;
      if (g.mode === 'resize') return { ...element, width:clamp(g.original.width+dx,3,100-g.original.x),height:clamp(g.original.height+dy,3,100-g.original.y) };
      return {...element,x:clamp(element.x+dx,0,100-element.width),y:clamp(element.y+dy,0,100-element.height)};
    })});
  };
  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current=null; onGestureEnd?.();
  };
  const render = (e:SceneElement) => {
    if (e.hidden) return null;
    const textStyle: React.CSSProperties = {width:'100%',height:'100%',margin:0,whiteSpace:'pre-wrap',overflow:'hidden',overflowWrap:'anywhere',fontSize:`${e.fontSize || 4}cqw`,color:e.color || scene.foreground,fontWeight:e.fontWeight || 400,textAlign:e.textAlign || 'left',lineHeight:1.18};
    if (e.kind === 'text') return <div style={{...textStyle,display:'flex',alignItems:'center'}}><span style={{width:'100%'}}>{e.text}</span></div>;
    if (e.kind === 'image') {const src=mediaSource(e.src || '');return src ? <img src={src} alt={e.text || 'Bild'} draggable={false} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:e.borderRadius || 0}} /> : <div className="zeImagePlaceholder">Bild hinzufügen</div>;}
    if (e.kind === 'shape') return <div style={{width:'100%',height:'100%',background:e.shape==='line'?'transparent':(e.fill||'#7657FF'),borderRadius:e.shape==='ellipse'?'50%':(e.borderRadius??0),borderBottom:e.shape==='line'?`4px solid ${e.fill || '#7657FF'}`:undefined}}/>;
    if (e.kind === 'icon') return <div style={{...textStyle,display:'grid',placeItems:'center',fontSize:`${e.fontSize||15}cqw`}}>{e.icon || '★'}</div>;
    if (e.kind === 'chart') return <div style={{display:'flex',alignItems:'flex-end',gap:'4%',width:'100%',height:'100%',borderBottom:`2px solid ${scene.foreground}44`}}>{(e.data||[40,75,55,90]).slice(0,12).map((n,i)=><div key={i} style={{flex:1,height:`${clamp(Number(n)||0,0,100)}%`,background:e.fill||'#7657FF',borderRadius:'4px 4px 0 0'}} title={String(n)}/>)}</div>;
    return null;
  };
  return <div ref={surface} className={`zeSlideSurface ${className||''}`} style={{background:scene.background,color:scene.foreground}} onPointerDown={event=>{if(event.target===surface.current)onSelect?.([]);}}>
    {scene.elements.map((e,index)=><div key={e.id} role={editable?'button':undefined} tabIndex={editable?0:undefined}
      aria-label={editable?`${e.kind} Element ${index+1}`:undefined}
      className={`zeSceneElement ${editable?'zeEditable':''} ${selected.includes(e.id)?'zeSelected':''}`}
      onPointerDown={event=>start(event,e,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      onKeyDown={event=>{if(editable && event.key==='Enter')onSelect?.([e.id]);}}
      style={{left:`${e.x}%`,top:`${e.y}%`,width:`${e.width}%`,height:`${e.height}%`,opacity:e.opacity??1,transform:`rotate(${e.rotation||0}deg)`,zIndex:index+1,cursor:editable?(e.locked?'not-allowed':'move'):'default'}}>
      {render(e)}
      {editable && selected.includes(e.id) && !e.locked && <div className="zeResizeHandle" onPointerDown={event=>start(event,e,'resize')} aria-label="Größe ändern"/>}
    </div>)}
  </div>;
}
