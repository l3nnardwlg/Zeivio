'use client';
import React, { use, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { apiRequest, uploadMedia } from '../../../lib/api';
import SlideSurface from '../../../components/SlideSurface';
import { Scene, SlideData, SceneElement, ElementKind, PALETTES, makeElement, makeScene, parseScene, validScene, clamp } from '../../../lib/scene';
import '../../editor.css';

type Presentation = {id:string;title:string;accessCode:string;isPublished:boolean};
type Status = 'saved'|'saving'|'unsaved'|'error';
type MediaAsset = {id:string;url:string;name:string;mime:string;bytes:number};
const TEMPLATES = [
  ['title','Titelfolie'],['blank','Leer'],['split','Zwei Spalten'],['section','Kapitel'],
  ['quote','Zitat'],['image','Bild'],['agenda','Agenda'],['data','Daten'],['poll','Umfrage']
] as const;
export default function EditorPage({params}:{params:Promise<{id:string}>}) {
  const {id} = use(params);
  const {token,isLoading} = useAuth();
  const router=useRouter();
  const [presentation,setPresentation]=useState<Presentation|null>(null);
  const [slides,setSlides]=useState<SlideData[]>([]);
  const [activeId,setActiveId]=useState<string>('');
  const [selected,setSelected]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [status,setStatus]=useState<Status>('saved');
  const [zoom,setZoom]=useState(100);
  const [tab,setTab]=useState<'elements'|'templates'|'media'>('elements');
  const [assets,setAssets]=useState<MediaAsset[]>([]);
  const [dragId,setDragId]=useState<string|null>(null);
  const [uploading,setUploading]=useState(false);
  const fileInput=useRef<HTMLInputElement>(null);
  const pending=useRef(new Map<string,Scene>());
  const pendingMeta=useRef(new Map<string,Partial<SlideData>>());
  const metaTimeouts=useRef(new Map<string,ReturnType<typeof setTimeout>>());
  const timeouts=useRef(new Map<string,ReturnType<typeof setTimeout>>());
  const chain=useRef<Promise<void>>(Promise.resolve());
  const undoStacks=useRef(new Map<string,Scene[]>());
  const redoStacks=useRef(new Map<string,Scene[]>());
  const slidesRef=useRef<SlideData[]>([]);
  const dirty=useRef(false);
  const active=slides.find(s=>s.id===activeId)||null;
  const scene=active?parseScene(active):null;
  const element=scene?.elements.find(e=>selected.includes(e.id))||null;
  useEffect(()=>{slidesRef.current=slides;},[slides]);
  useEffect(()=>{
    if(!isLoading&&!token){router.replace('/login');return;}
    if(!token)return;
    let cancelled=false;
    (async()=>{
      try{
        const [p,s]=await Promise.all([
          apiRequest<{presentation:Presentation}>(`/presentations/${id}`),
          apiRequest<{slides:SlideData[]}>(`/slides/presentation/${id}`)
        ]);
        if(cancelled)return;
        setPresentation(p.presentation);
        void apiRequest<{assets:MediaAsset[]}>('/media').then(result=>{if(!cancelled)setAssets(result.assets||[]);}).catch(console.error);
        setSlides(s.slides);setActiveId(s.slides[0]?.id||'');
      }catch(e){console.error(e);if(!cancelled)setStatus('error');}
      finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[id,token,isLoading,router]);
  useEffect(()=>{
    const before=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);
  },[]);
  const persist = useCallback((slideId:string)=>{
    const timer=timeouts.current.get(slideId);
    if(timer)clearTimeout(timer);
    timeouts.current.delete(slideId);
    const snapshot=pending.current.get(slideId);
    if(!snapshot)return chain.current;
    pending.current.delete(slideId);
    setStatus('saving');
    chain.current=chain.current.catch(()=>{}).then(async()=>{
      try{
        await apiRequest(`/slides/${slideId}`,{method:'PUT',body:JSON.stringify({design:JSON.stringify(snapshot)})});
        if(!pending.current.size&&!timeouts.current.size&&!pendingMeta.current.size&&!metaTimeouts.current.size){dirty.current=false;setStatus('saved');}
      }catch(error){
        pending.current.set(slideId,snapshot);dirty.current=true;setStatus('error');console.error('Speichern fehlgeschlagen',error);
      }
    });
    return chain.current;
  },[]);
  const schedule = useCallback((slideId:string,value:Scene)=>{
    if(!validScene(value)){setStatus('error');return;}
    setSlides(prev=>prev.map(s=>s.id===slideId?{...s,design:JSON.stringify(value)}:s));
    pending.current.set(slideId,value);dirty.current=true;setStatus('unsaved');
    const old=timeouts.current.get(slideId);if(old)clearTimeout(old);
    timeouts.current.set(slideId,setTimeout(()=>{void persist(slideId);},650));
  },[persist]);
  const persistMeta=(slideId:string)=>{
    const timer=metaTimeouts.current.get(slideId);
    if(timer)clearTimeout(timer);
    metaTimeouts.current.delete(slideId);
    const changes=pendingMeta.current.get(slideId);
    if(!changes)return chain.current;
    pendingMeta.current.delete(slideId);
    setStatus('saving');
    chain.current=chain.current.catch(()=>{}).then(async()=>{
      try{
        await apiRequest(`/slides/${slideId}`,{method:'PUT',body:JSON.stringify(changes)});
        if(!pending.current.size&&!timeouts.current.size&&!pendingMeta.current.size&&!metaTimeouts.current.size){
          dirty.current=false;setStatus('saved');
        }
      }catch(error){
        pendingMeta.current.set(slideId,{...changes,...pendingMeta.current.get(slideId)});
        dirty.current=true;setStatus('error');console.error('Metadaten-Speicherung fehlgeschlagen',error);
      }
    });
    return chain.current;
  };
  const flush=async()=>{
    for(const key of Array.from(pending.current.keys()))persist(key);
    for(const key of Array.from(pendingMeta.current.keys()))persistMeta(key);
    await chain.current;
    return !dirty.current;
  };
  const remember=()=>{
    if(!active||!scene)return;
    undoStacks.current.set(active.id,[...(undoStacks.current.get(active.id)||[]).slice(-49),structuredClone(scene)]);
    redoStacks.current.set(active.id,[]);
  };
  const change=(next:Scene,record=true)=>{
    if(!active)return;
    if(record)remember();
    schedule(active.id,next);
  };
  const history=(direction:'undo'|'redo')=>{
    if(!active||!scene)return;
    const from=direction==='undo'?undoStacks.current:redoStacks.current;
    const to=direction==='undo'?redoStacks.current:undoStacks.current;
    const stack=from.get(active.id)||[];
    const previous=stack.pop();if(!previous)return;
    from.set(active.id,stack);
    to.set(active.id,[...(to.get(active.id)||[]),structuredClone(scene)]);
    schedule(active.id,previous);
    setSelected([]);
  };
  const changeElement=(changes:Partial<SceneElement>)=>{
    if(!scene||!selected.length)return;
    change({...scene,elements:scene.elements.map(e=>selected.includes(e.id)?{...e,...changes}:e)});
  };
  const add=(kind:ElementKind,extra:Partial<SceneElement>={})=>{
    if(!scene)return;
    const e=makeElement(kind,{color:scene.foreground,...extra});
    change({...scene,elements:[...scene.elements,e]});setSelected([e.id]);
  };
  const remove=()=>{
    if(!scene||!selected.length)return;
    change({...scene,elements:scene.elements.filter(e=>!selected.includes(e.id))});
    setSelected([]);
  };
  const copy=()=>{if(!scene)return;const picked=scene.elements.filter(e=>selected.includes(e.id));if(picked.length)(window as any).__zeivioClipboard=picked.map(e=>({...e}));};
  const paste=()=>{
    if(!scene)return;
    const items=(window as any).__zeivioClipboard as SceneElement[]|undefined;
    if(!Array.isArray(items)||!items.length)return;
    const copies=items.map(e=>({...e,id:crypto.randomUUID(),x:clamp(e.x+3,0,100-e.width),y:clamp(e.y+3,0,100-e.height)}));
    change({...scene,elements:[...scene.elements,...copies]});setSelected(copies.map(e=>e.id));
  };
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const el=event.target as HTMLElement;
      if(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)||el.isContentEditable)return;
      const command=event.ctrlKey||event.metaKey;
      if(command&&event.key.toLowerCase()==='z'){event.preventDefault();history(event.shiftKey?'redo':'undo');}
      else if(command&&event.key.toLowerCase()==='y'){event.preventDefault();history('redo');}
      else if(command&&event.key.toLowerCase()==='c'){event.preventDefault();copy();}
      else if(command&&event.key.toLowerCase()==='v'){event.preventDefault();paste();}
      else if((event.key==='Delete'||event.key==='Backspace')&&selected.length){event.preventDefault();remove();}
      else if(scene&&selected.length&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();remember();
        const step=event.shiftKey?5:1;
        change({...scene,elements:scene.elements.map(e=>selected.includes(e.id)?{...e,x:clamp(e.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0),0,100-e.width),y:clamp(e.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0),0,100-e.height)}:e)},false);
      }
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const addSlide=async(template:string)=>{
    try{
      const type=template==='poll'?'POLL':'CONTENT';
      const scene=makeScene(template,template==='poll'?'Deine Frage':'Neue Folie');
      const res=await apiRequest<{slide:SlideData}>(`/slides/presentation/${id}`,{method:'POST',body:JSON.stringify({title:template==='poll'?'Umfrage':'Neue Folie',type,design:JSON.stringify(scene),options:template==='poll'?JSON.stringify(['Option A','Option B']):undefined})});
      setSlides(prev=>[...prev,res.slide]);setActiveId(res.slide.id);setSelected([]);
    }catch(error){alert(error instanceof Error?error.message:'Folie konnte nicht erstellt werden');}
  };
  const duplicate=async()=>{
    if(!active)return;
    try{
      const res=await apiRequest<{slide:SlideData}>(`/slides/presentation/${id}`,{method:'POST',body:JSON.stringify({title:active.title+' (Kopie)',type:active.type,subtitle:active.subtitle,content:active.content,options:active.options,design:active.design})});
      setSlides(prev=>[...prev,res.slide]);setActiveId(res.slide.id);setSelected([]);
    }catch(error){alert('Duplizieren fehlgeschlagen');}
  };
  const deleteSlide=async(slideId:string)=>{
    if(slides.length<=1)return alert('Mindestens eine Folie muss erhalten bleiben.');
    if(!confirm('Folie löschen?'))return;
    try{
      await apiRequest(`/slides/${slideId}`,{method:'DELETE'});
      const remaining=slides.filter(s=>s.id!==slideId);
      setSlides(remaining);if(activeId===slideId)setActiveId(remaining[0]?.id||'');
      setSelected([]);
    }catch{alert('Löschen fehlgeschlagen');}
  };
  const reorder=async(targetId:string)=>{
    if(!dragId||dragId===targetId)return;
    const sorted=[...slides];const from=sorted.findIndex(s=>s.id===dragId),to=sorted.findIndex(s=>s.id===targetId);
    if(from<0||to<0)return;
    const [moved]=sorted.splice(from,1);sorted.splice(to,0,moved);
    setSlides(sorted);setDragId(null);
    try{await apiRequest(`/slides/presentation/${id}/reorder`,{method:'PUT',body:JSON.stringify({slideIds:sorted.map(s=>s.id)})});}
    catch(error){setSlides(slides);alert('Sortierung konnte nicht gespeichert werden');}
  };
  const updateSlideMeta=(fields:Partial<SlideData>)=>{
    if(!active)return;
    const slideId=active.id;
    setSlides(prev=>prev.map(s=>s.id===slideId?{...s,...fields}:s));
    pendingMeta.current.set(slideId,{...(pendingMeta.current.get(slideId)||{}),...fields});
    dirty.current=true;setStatus('unsaved');
    const timer=metaTimeouts.current.get(slideId);if(timer)clearTimeout(timer);
    metaTimeouts.current.set(slideId,setTimeout(()=>void persistMeta(slideId),650));
  };
  const upload=async(file:File)=>{
    if(!scene)return;
    setUploading(true);
    try{
      const result=await uploadMedia(file);
      const refreshed=await apiRequest<{assets:MediaAsset[]}>('/media');setAssets(refreshed.assets||[]);
      if(element?.kind==='image'){changeElement({src:result.url});}else{add('image',{src:result.url,x:22,y:20,width:56,height:60});}
    }catch(error){alert(error instanceof Error?error.message:'Upload fehlgeschlagen');}
    finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}
  };
  const rename=async()=>{
    if(!presentation)return;
    const title=prompt('Präsentation umbenennen',presentation.title);
    if(!title?.trim())return;
    try{const res=await apiRequest<{presentation:Presentation}>(`/presentations/${id}`,{method:'PATCH',body:JSON.stringify({title:title.trim()})});setPresentation(res.presentation);}
    catch{alert('Umbenennen fehlgeschlagen');}
  };
  const publish=async()=>{
    if(!presentation)return;
    try{const res=await apiRequest<{presentation:Presentation}>(`/presentations/${id}`,{method:'PATCH',body:JSON.stringify({isPublished:!presentation.isPublished})});setPresentation(res.presentation);}
    catch{alert('Veröffentlichung fehlgeschlagen');}
  };
  const present=async()=>{if(await flush())router.push(`/present/${id}`);else alert('Änderungen wurden nicht gespeichert. Bitte erneut versuchen.');};
  const moveLayer=(delta:number)=>{
    if(!scene||!element)return;
    const arr=[...scene.elements];const from=arr.findIndex(e=>e.id===element.id);const to=clamp(from+delta,0,arr.length-1);
    const [item]=arr.splice(from,1);arr.splice(to,0,item);change({...scene,elements:arr});
  };
  const pollOptions=(()=>{try{return JSON.parse(active?.options||'["Option A","Option B"]') as string[];}catch{return ['Option A','Option B'];}})();
  if(isLoading||loading)return <div className="loadingState"><div className="spinner"/><p>Zeivio Studio wird geladen...</p></div>;
  if(!presentation||!scene||!active)return <div className="loadingState"><p>Präsentation nicht gefunden.</p><Link href="/dashboard">Zurück zum Dashboard</Link></div>;
  return <div className="zeStudio">
    <header className="zeTop">
      <Link href="/dashboard" className="zeLogo">Z <span>Zeivio Studio</span></Link>
      <button className="zeTitleButton" onClick={rename}>{presentation.title} ✎</button>
      <span className={`zeSave zeSave-${status}`}>{status==='saved'?'✓ Gespeichert':status==='saving'?'Speichert …':status==='error'?'⚠ Speicherfehler':'Änderungen …'}</span>
      <div className="zeSpacer"/>
      <button className="zeButton" onClick={()=>history('undo')} title="Rückgängig (Ctrl+Z)">↶</button>
      <button className="zeButton" onClick={()=>history('redo')} title="Wiederholen (Ctrl+Y)">↷</button>
      <button className="zeButton" onClick={()=>void flush()}>Speichern</button>
      <button className="zeButton" onClick={publish}>{presentation.isPublished?'● Öffentlich':'○ Veröffentlichen'}</button>
      <button className="zeButton zePrimary" onClick={()=>void present()}>▶ Präsentieren</button>
    </header>
    <div className="zeWorkspace">
      <aside className="zeSlides">
        <div className="zePanelHeader">Folien <span>{slides.length}</span></div>
        <div className="zeSlideList">
          {slides.map((slide,i)=><div key={slide.id} className={`zeThumb ${slide.id===activeId?'zeThumbActive':''}`} draggable onDragStart={()=>setDragId(slide.id)} onDragEnd={()=>setDragId(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void reorder(slide.id);}} onClick={()=>{setActiveId(slide.id);setSelected([]);}}>
            <div className="zeThumbLabel"><span>☰ {i+1}</span><button onClick={e=>{e.stopPropagation();void deleteSlide(slide.id);}} title="Folie löschen">×</button></div>
            <SlideSurface scene={parseScene(slide)} className="zeThumbSurface" />
            <span className="zeThumbCaption">{slide.title}</span>
          </div>)}
        </div>
        <button className="zeButton zeFill" onClick={()=>void addSlide('title')}>+ Neue Folie</button>
        <button className="zeButton zeFill" onClick={()=>void duplicate()}>Duplizieren</button>
        <p className="zeHint">Folien zum Sortieren ziehen.</p>
      </aside>
      <aside className="zeLibrary">
        <div className="zeTabs"><button className={tab==='elements'?'active':''} onClick={()=>setTab('elements')}>Elemente</button><button className={tab==='templates'?'active':''} onClick={()=>setTab('templates')}>Vorlagen</button><button className={tab==='media'?'active':''} onClick={()=>setTab('media')}>Medien</button></div>
        {tab==='elements'?<div className="zeLibraryContent">
          <p className="zeSectionLabel">Inhalt</p>
          <div className="zeTools">
            <button onClick={()=>add('text',{text:'Überschrift',fontSize:8,fontWeight:700})}>Tt <small>Überschrift</small></button>
            <button onClick={()=>add('text',{text:'Dein Text',fontSize:4})}>≡ <small>Text</small></button>
            <button onClick={()=>fileInput.current?.click()}>▧ <small>{uploading?'Lädt …':'Bild hochladen'}</small></button>
            <button onClick={()=>add('shape',{shape:'rectangle'})}>▣ <small>Rechteck</small></button>
            <button onClick={()=>add('shape',{shape:'ellipse'})}>◯ <small>Kreis</small></button>
            <button onClick={()=>add('shape',{shape:'line',height:2})}>━ <small>Linie</small></button>
            <button onClick={()=>add('icon',{icon:'★'})}>★ <small>Icon</small></button>
            <button onClick={()=>add('chart')}>▥ <small>Diagramm</small></button>
          </div>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e=>{if(e.target.files?.[0])void upload(e.target.files[0]);}}/>
          <p className="zeSectionLabel">Foliendesign</p>
          <div className="zePaletteList">{PALETTES.map(p=><button key={p.name} onClick={()=>change({...scene,background:p.background,foreground:p.foreground,elements:scene.elements.map(e=>e.kind==='text'?{...e,color:p.foreground}:e)})}><span className="zeSwatches"><i style={{background:p.background}}/><i style={{background:p.foreground}}/><i style={{background:p.accent}}/></span>{p.name}</button>)}</div>
          <p className="zeSectionLabel">Interaktiv</p>
          <button className="zeButton zeFill" onClick={()=>void addSlide('poll')}>+ Live-Umfrage</button>
        </div>:tab==='templates'?<div className="zeLibraryContent">
          <p className="zeSectionLabel">Neue Folie aus Vorlage</p>
          {TEMPLATES.map(([key,name])=><button key={key} className="zeTemplate" onClick={()=>void addSlide(key)}><span className="zeTemplateIcon">▣</span>{name}<span>+</span></button>)}
        </div>:<div className="zeLibraryContent">
          <p className="zeSectionLabel">Deine Bildbibliothek</p>
          <button className="zeButton zeFill" onClick={()=>fileInput.current?.click()}>+ Bild hochladen</button>
          <p className="zeHint">Bilder bleiben gespeichert und können auf mehreren Folien verwendet werden.</p>
          {assets.length===0?<p className="zeHint">Noch keine Bilder hochgeladen.</p>:<div className="zeMediaGrid">
            {assets.map(asset=><button key={asset.id} className="zeMediaAsset" onClick={()=>add('image',{src:asset.url,x:22,y:20,width:56,height:60})} title={asset.name}>
              <img src={(process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api').replace(/\/api\/?$/,'')+asset.url} alt={asset.name} loading="lazy"/>
              <span>{decodeURIComponent(asset.name)}</span>
            </button>)}
          </div>}
        </div>}
      </aside>
      <main className="zeCenter">
        <div className="zeCanvasToolbar">
          <span>Folie {slides.findIndex(s=>s.id===activeId)+1} / {slides.length}</span>
          <span>16:9 · {active.type}</span>
          <div className="zeSpacer"/>
          <button onClick={()=>setZoom(z=>clamp(z-10,40,160))}>−</button>
          <strong>{zoom}%</strong>
          <button onClick={()=>setZoom(z=>clamp(z+10,40,160))}>+</button>
          <button onClick={()=>setZoom(100)}>Fit</button>
        </div>
        <div className="zeCanvasScroll">
          <div className="zeCanvasHolder" style={{width:`${Math.max(65,zoom)}%`}}>
            <SlideSurface scene={scene} editable selected={selected} onSelect={setSelected} onGestureStart={remember} onChange={value=>change(value,false)} onGestureEnd={()=>{}}/>
          </div>
        </div>
        <div className="zeCanvasFooter">
          <span>Shift + Klick: Mehrfachauswahl · Pfeiltasten: Bewegen · Ctrl+Z: Undo · Ctrl+C/V: Kopieren</span>
          <span>{scene.elements.length} Elemente</span>
        </div>
      </main>
      <aside className="zeInspector">
        <div className="zePanelHeader">Eigenschaften</div>
        <div className="zeInspectorBody">
          <label>Folientitel<input value={active.title} onChange={e=>void updateSlideMeta({title:e.target.value})}/></label>
          {active.type==='POLL'&&<div className="zeInspectorGroup"><strong>Antworten</strong>{pollOptions.map((o,i)=><input key={i} value={o} onChange={e=>{const values=[...pollOptions];values[i]=e.target.value;void updateSlideMeta({options:JSON.stringify(values)});}}/>)}<button className="zeButton" onClick={()=>void updateSlideMeta({options:JSON.stringify([...pollOptions,'Neue Antwort'])})}>+ Antwort</button></div>}
          <div className="zeInspectorGroup"><strong>Folie</strong>
            <label>Hintergrund<input type="color" value={scene.background} onChange={e=>change({...scene,background:e.target.value})}/></label>
            <label>Vordergrund<input type="color" value={scene.foreground} onChange={e=>change({...scene,foreground:e.target.value})}/></label>
            <label>Sprechernotizen<textarea value={scene.notes||''} rows={3} onChange={e=>change({...scene,notes:e.target.value})}/></label>
          </div>
          {element?<div className="zeInspectorGroup">
            <strong>Ausgewählt: {element.kind}</strong>
            {element.kind==='text'&&<>
              <label>Text<textarea rows={4} value={element.text||''} onChange={e=>changeElement({text:e.target.value})}/></label>
              <label>Schriftgröße<input type="number" min="1" max="30" step=".5" value={element.fontSize||4} onChange={e=>changeElement({fontSize:clamp(Number(e.target.value),1,30)})}/></label>
              <label>Schriftstärke<select value={element.fontWeight||400} onChange={e=>changeElement({fontWeight:Number(e.target.value)})}><option value="400">Normal</option><option value="600">Halbfett</option><option value="700">Fett</option></select></label>
              <label>Ausrichtung<select value={element.textAlign||'left'} onChange={e=>changeElement({textAlign:e.target.value as SceneElement['textAlign']})}><option value="left">Links</option><option value="center">Zentriert</option><option value="right">Rechts</option></select></label>
            </>}
            {element.kind==='image'&&<><label>Bild-URL (HTTPS)<input value={element.src||''} onChange={e=>changeElement({src:e.target.value})}/></label><button className="zeButton" onClick={()=>fileInput.current?.click()}>Bild ersetzen / hochladen</button></>}
            {element.kind==='shape'&&<label>Form<select value={element.shape||'rectangle'} onChange={e=>changeElement({shape:e.target.value as SceneElement['shape']})}><option value="rectangle">Rechteck</option><option value="ellipse">Kreis</option><option value="line">Linie</option></select></label>}
            {element.kind==='icon'&&<label>Symbol<input maxLength={4} value={element.icon||'★'} onChange={e=>changeElement({icon:e.target.value})}/></label>}
            {element.kind==='chart'&&<label>Werte (durch Kommas getrennt)<input value={(element.data||[]).join(',')} onChange={e=>changeElement({data:e.target.value.split(',').map(Number).slice(0,12)})}/></label>}
            <label>{element.kind==='shape'||element.kind==='chart'?'Füllfarbe':'Farbe'}<input type="color" value={element.kind==='shape'||element.kind==='chart'?(element.fill||'#7657FF'):(element.color||'#172033')} onChange={e=>changeElement(element.kind==='shape'||element.kind==='chart'?{fill:e.target.value}:{color:e.target.value})}/></label>
            <div className="zeCoordinates">{(['x','y','width','height'] as const).map(k=><label key={k}>{k.toUpperCase()}<input type="number" min="0" max="100" step=".5" value={Math.round(element[k]*10)/10} onChange={e=>changeElement({[k]:clamp(Number(e.target.value),0,100)} as Partial<SceneElement>)}/></label>)}</div>
            <label>Rotation<input type="range" min="-180" max="180" value={element.rotation||0} onChange={e=>changeElement({rotation:Number(e.target.value)})}/><small>{element.rotation||0}°</small></label>
            <label>Deckkraft<input type="range" min="0" max="1" step=".05" value={element.opacity??1} onChange={e=>changeElement({opacity:Number(e.target.value)})}/></label>
            <div className="zeInline"><button className="zeButton" onClick={()=>moveLayer(1)}>Ebene ↑</button><button className="zeButton" onClick={()=>moveLayer(-1)}>Ebene ↓</button></div>
            <div className="zeInline"><button className="zeButton" onClick={()=>changeElement({locked:!element.locked})}>{element.locked?'Entsperren':'Sperren'}</button><button className="zeButton" onClick={()=>changeElement({hidden:!element.hidden})}>{element.hidden?'Anzeigen':'Ausblenden'}</button></div>
            <button className="zeButton zeDanger" onClick={remove}>Auswahl löschen</button>
          </div>:<p className="zeHint">Element auf der Folie auswählen, um es zu gestalten. Elemente können frei bewegt und an der Ecke skaliert werden.</p>}
          <div className="zeInspectorGroup"><strong>Ebenen</strong>{[...scene.elements].reverse().map(e=><button key={e.id} className={`zeLayer ${selected.includes(e.id)?'active':''}`} onClick={()=>setSelected([e.id])}>{e.kind==='text'?'T':e.kind==='image'?'▧':'◈'} {e.text?.slice(0,20)||e.kind} {e.locked?'🔒':''}</button>)}</div>
        </div>
      </aside>
    </div>
  </div>;
}
