'use client';
import React,{use,useEffect,useState,useCallback} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '../../../lib/auth-context';
import {apiRequest} from '../../../lib/api';
import SlideSurface from '../../../components/SlideSurface';
import {SlideData,parseScene} from '../../../lib/scene';
import '../../editor.css';

interface Presentation {id:string;title:string;accessCode:string;isPublished:boolean;sessionActive:boolean;currentSlideIndex:number;sessionStartedAt?:string|null}
interface Question {id:string;text:string;isApproved:boolean;createdAt:string}
export default function PresentPage({params}:{params:Promise<{id:string}>}) {
  const {id}=use(params);
  const {token,isLoading:authLoading}=useAuth();
  const router=useRouter();
  const [presentation,setPresentation]=useState<Presentation|null>(null);
  const [slides,setSlides]=useState<SlideData[]>([]);
  const [index,setIndex]=useState(0);
  const [loading,setLoading]=useState(true);
  const [questions,setQuestions]=useState<Question[]>([]);
  const [black,setBlack]=useState(false);
  const [elapsed,setElapsed]=useState(0);
  const [error,setError]=useState('');
  const current=slides[index];
  const next=slides[index+1];
  const fetchSlides=useCallback(async()=>{
    const result=await apiRequest<{slides:SlideData[]}>(`/slides/presentation/${id}`);
    setSlides(result.slides||[]);
  },[id]);
  useEffect(()=>{
    if(!authLoading&&!token){router.replace('/login');return;}
    if(!token)return;
    let active=true;
    (async()=>{
      try{
        const [p,s]=await Promise.all([
          apiRequest<{presentation:Presentation}>(`/presentations/${id}`),
          apiRequest<{slides:SlideData[]}>(`/slides/presentation/${id}`)
        ]);
        if(!active)return;
        setPresentation(p.presentation);setSlides(s.slides||[]);
        setIndex(Math.min(p.presentation.currentSlideIndex,Math.max(0,s.slides.length-1)));
      }catch(e){if(active)setError(e instanceof Error?e.message:'Laden fehlgeschlagen');}
      finally{if(active)setLoading(false);}
    })();
    return()=>{active=false;};
  },[id,token,authLoading,router]);
  useEffect(()=>{
    if(!presentation)return;
    const timer=setInterval(()=>{
      if(presentation.sessionStartedAt)setElapsed(Math.floor((Date.now()-new Date(presentation.sessionStartedAt).getTime())/1000));
      void fetchSlides().catch(()=>{});
    },2500);
    return()=>clearInterval(timer);
  },[presentation?.sessionStartedAt,fetchSlides]);
  useEffect(()=>{
    if(!current||current.type!=='QA')return;
    let mounted=true;
    const load=async()=>{try{const r=await apiRequest<{questions:Question[]}>(`/slides/${current.id}/questions`);if(mounted)setQuestions(r.questions);}catch{}};
    void load();const timer=setInterval(()=>void load(),2500);
    return()=>{mounted=false;clearInterval(timer);};
  },[current?.id,current?.type]);
  const patch=async(data:Partial<Presentation>)=>{
    try{
      const r=await apiRequest<{presentation:Presentation}>(`/presentations/${id}`,{method:'PATCH',body:JSON.stringify(data)});
      setPresentation(r.presentation);
      setError('');
      return true;
    }catch(e){setError(e instanceof Error?e.message:'Speichern fehlgeschlagen');return false;}
  };
  const navigate=async(nextIndex:number)=>{
    if(nextIndex<0||nextIndex>=slides.length||nextIndex===index)return;
    if(presentation?.sessionActive && !await patch({currentSlideIndex:nextIndex}))return;
    setIndex(nextIndex);
  };
  const toggleSession=async()=>{
    if(!presentation)return;
    const goingLive=!presentation.sessionActive;
    if(await patch({sessionActive:goingLive,isPublished:goingLive?true:presentation.isPublished,currentSlideIndex:index})){
      if(goingLive)setElapsed(0);
    }
  };
  const moderate=async(q:Question)=>{
    if(!current)return;
    try{
      await apiRequest(`/slides/${current.id}/questions/${q.id}`,{method:'PATCH',body:JSON.stringify({isApproved:!q.isApproved})});
      setQuestions(prev=>prev.map(item=>item.id===q.id?{...item,isApproved:!item.isApproved}:item));
    }catch{setError('Moderation fehlgeschlagen');}
  };
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;
      if(['INPUT','TEXTAREA'].includes(target.tagName))return;
      if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();void navigate(index+1);}
      if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();void navigate(index-1);}
      if(e.key.toLowerCase()==='b')setBlack(x=>!x);
      if(e.key==='Escape'&&document.fullscreenElement)void document.exitFullscreen();
    };
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  });
  const options=(()=>{try{return JSON.parse(current?.options||'[]') as string[];}catch{return [];}})();
  const count=current?.votes?.length||0;
  const duration=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
  if(authLoading||loading)return <div className="loadingState"><div className="spinner"/><p>Lade Präsentation …</p></div>;
  if(!presentation)return <div className="loadingState"><p>{error||'Nicht gefunden'}</p><Link href="/dashboard">Dashboard</Link></div>;
  return <div className="zePresenter">
    <header className="zePresentHeader">
      <strong>▣ Zeivio Presenter</strong><span>{presentation.title}</span>
      <div className="zeSpacer"/>
      <span className={presentation.sessionActive?'zeLive':'zeOffline'}>{presentation.sessionActive?'● LIVE':'○ OFFLINE'}</span>
      <button onClick={()=>void toggleSession()} className="zeButton zePrimary">{presentation.sessionActive?'Live-Sitzung beenden':'▶ Live starten'}</button>
      <Link className="zeButton" href={`/editor/${id}`}>Editor ✕</Link>
    </header>
    {error&&<div className="zePresentError">{error}</div>}
    <div className="zePresentBody">
      <div className="zePresentMain">
        <div className="zePresentAudience">Publikum: <strong>{typeof window!=='undefined'?window.location.origin+'/p/'+presentation.accessCode: presentation.accessCode}</strong></div>
        <div className="zePresenterStage">
          {black?<div className="zeBlackout">Bildschirm pausiert – Taste B</div>:current?<SlideSurface scene={parseScene(current)} />:<p>Keine Folie verfügbar</p>}
        </div>
        {current?.type==='POLL'&&<div className="zePresentPoll">
          <strong>Live-Umfrage · {count} Stimmen</strong>
          {options.map((o,i)=>{
            const votes=current.votes?.filter(v=>v.optionIndex===i).length||0;
            return <div key={i} className="zePollRow"><span>{o} · {votes}</span><div><i style={{width:`${count?Math.round(votes/count*100):0}%`}}/></div></div>;
          })}
        </div>}
        {current?.type==='QA'&&<div className="zePresentPoll">
          <strong>Q&A-Moderation ({questions.filter(q=>!q.isApproved).length} offen)</strong>
          {questions.length===0&&<p>Fragen erscheinen hier, sobald das Publikum sie einreicht.</p>}
          {questions.map(q=><div className="zeQuestionRow" key={q.id}><span>{q.text}</span><button className="zeButton" onClick={()=>void moderate(q)}>{q.isApproved?'Freigabe entfernen':'Freigeben'}</button></div>)}
        </div>}
        <footer className="zePresentControls">
          <button className="zeButton" onClick={()=>void navigate(index-1)} disabled={index<=0}>← Zurück</button>
          <span>Folie {index+1} / {slides.length} · {duration}</span>
          <button className="zeButton" onClick={()=>setBlack(x=>!x)}>{black?'Bild einblenden':'Bild schwarz (B)'}</button>
          <button className="zeButton" onClick={()=>{const node=document.documentElement;if(!document.fullscreenElement)void node.requestFullscreen();else void document.exitFullscreen();}}>⛶ Vollbild</button>
          <button className="zeButton zePrimary" onClick={()=>void navigate(index+1)} disabled={index>=slides.length-1}>Weiter →</button>
        </footer>
      </div>
      <aside className="zePresentSide">
        <h3>Nächste Folie</h3>
        {next?<SlideSurface scene={parseScene(next)} />:<p>Ende der Präsentation</p>}
        <h3>Sprechernotizen</h3>
        <p className="zeNotes">{current?parseScene(current).notes||'Keine Notizen für diese Folie.':'Keine Folie'}</p>
        <h3>Publikumsmodus</h3>
        <a href={`/p/${presentation.accessCode}`} target="_blank" rel="noopener noreferrer" className="zeButton zeFill">Publikumsansicht öffnen ↗</a>
        <p className="zeHint">Mit ← → oder Leertaste steuern. Die Zuschauer sehen nur die aktive Folie, wenn die Sitzung läuft.</p>
      </aside>
    </div>
  </div>;
}
