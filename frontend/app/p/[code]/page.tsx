'use client';
import React,{use,useEffect,useState,useRef} from 'react';
import Link from 'next/link';
import {apiRequest} from '../../../lib/api';
import SlideSurface from '../../../components/SlideSurface';
import {SlideData,parseScene} from '../../../lib/scene';
import '../../editor.css';

type PublicPresentation={id:string;title:string;accessCode:string;sessionActive:boolean;currentSlideIndex:number;owner:{name:string};slides:SlideData[]};
type ApprovedQuestion={id:string;text:string;createdAt:string};
function getParticipant():string{
  const key='zeivio_participant_v1';
  let id=localStorage.getItem(key);
  if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
  return id;
}
export default function AudiencePage({params}:{params:Promise<{code:string}>}){
  const {code}=use(params);
  const [presentation,setPresentation]=useState<PublicPresentation|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [voteMessage,setVoteMessage]=useState('');
  const [questions,setQuestions]=useState<ApprovedQuestion[]>([]);
  const [question,setQuestion]=useState('');
  const [questionMessage,setQuestionMessage]=useState('');
  const participant=useRef<string>('');
  useEffect(()=>{participant.current=getParticipant();},[]);
  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const res=await apiRequest<{presentation:PublicPresentation}>(`/public/p/${encodeURIComponent(code)}`);
        if(mounted){setPresentation(res.presentation);setError('');}
      }catch(e){if(mounted)setError(e instanceof Error?e.message:'Verbindung fehlgeschlagen');}
      finally{if(mounted)setLoading(false);}
    };
    void load();
    const timer=setInterval(()=>void load(),2500);
    return()=>{mounted=false;clearInterval(timer);};
  },[code]);
  const slide=presentation?.slides[0];
  useEffect(()=>{
    if(!slide || slide.type!=='QA')return;
    let mounted=true;
    const load=async()=>{try{const r=await apiRequest<{questions:ApprovedQuestion[]}>(`/public/questions/${slide.id}`);if(mounted)setQuestions(r.questions||[]);}catch{}};
    void load();const timer=setInterval(()=>void load(),3500);
    return()=>{mounted=false;clearInterval(timer);};
  },[slide?.id,slide?.type]);
  const options=(()=>{try{return JSON.parse(slide?.options||'[]') as string[];}catch{return [];}})();
  const voteKey=slide?`zeivio_voted_${slide.id}`:'';
  const [voted,setVoted]=useState<Record<string,number>>({});
  useEffect(()=>{
    if(slide&&localStorage.getItem(voteKey)!==null){setVoted(prev=>({...prev,[slide.id]:Number(localStorage.getItem(voteKey))}));}
  },[slide?.id,voteKey]);
  const vote=async(index:number)=>{
    if(!slide||submitting||voted[slide.id]!==undefined)return;
    setSubmitting(true);setVoteMessage('');
    try{
      await apiRequest('/public/vote',{method:'POST',body:JSON.stringify({slideId:slide.id,optionIndex:index,participantId:participant.current})});
      localStorage.setItem(voteKey,String(index));setVoted(prev=>({...prev,[slide.id]:index}));setVoteMessage('Deine Stimme wurde gespeichert.');
    }catch(e){setVoteMessage(e instanceof Error?e.message:'Abstimmung fehlgeschlagen');}
    finally{setSubmitting(false);}
  };
  const sendQuestion=async()=>{
    if(!slide||!question.trim()||submitting)return;
    setSubmitting(true);setQuestionMessage('');
    try{
      await apiRequest('/public/questions',{method:'POST',body:JSON.stringify({slideId:slide.id,participantId:participant.current,text:question.trim()})});
      setQuestion('');setQuestionMessage('Deine Frage wurde zur Moderation eingereicht.');
    }catch(e){setQuestionMessage(e instanceof Error?e.message:'Frage konnte nicht gesendet werden');}
    finally{setSubmitting(false);}
  };
  if(loading)return <div className="zeAudience"><div className="loadingState"><div className="spinner"/><p>Verbinde mit Zeivio …</p></div></div>;
  if(error&&!presentation)return <div className="zeAudience zeAudienceCenter"><h1>Präsentation nicht verfügbar</h1><p>{error}</p><Link href="/" className="zeButton">Zur Startseite</Link></div>;
  return <div className="zeAudience">
    <header className="zeAudienceTop"><Link href="/" className="zeLogo">Z <span>Zeivio</span></Link><span>Raum {presentation?.accessCode||code}</span></header>
    <main className="zeAudienceMain">
      <div className="zeAudienceHeading"><h1>{presentation?.title}</h1><p>Präsentiert von {presentation?.owner?.name}</p></div>
      {!presentation?.sessionActive||!slide?<div className="zeWaiting"><div className="zePulse">●</div><h2>Die Präsentation beginnt gleich.</h2><p>Sobald der Präsentierende startet, erscheint hier automatisch die aktuelle Folie.</p></div>:<>
        <div className="zeAudienceStage"><SlideSurface scene={parseScene(slide)}/></div>
        <div className="zeAudienceInteraction">
          <div className="zeSectionTitle">Folie {presentation.currentSlideIndex+1} · {slide.type==='POLL'?'Live-Umfrage':slide.type==='QA'?'Fragen & Antworten':'Präsentation'}</div>
          {slide.type==='POLL'&&<div className="zePublicPoll">
            <h2>{slide.title}</h2>
            {voted[slide.id]!==undefined?<div className="zeAnswerSuccess">✓ Du hast für „{options[voted[slide.id]]}“ abgestimmt.</div>:<div className="zeVoteGrid">{options.map((o,i)=><button key={i} disabled={submitting} onClick={()=>void vote(i)}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}</div>}
            {voteMessage&&<p aria-live="polite">{voteMessage}</p>}
          </div>}
          {slide.type==='QA'&&<div className="zePublicPoll"><h2>Stelle deine Frage</h2>
            <textarea maxLength={300} rows={3} placeholder="Was möchtest du fragen?" value={question} onChange={e=>setQuestion(e.target.value)}/>
            <button className="zeButton zePrimary" disabled={submitting||!question.trim()} onClick={()=>void sendQuestion()}>Frage einreichen</button>
            {questionMessage&&<p aria-live="polite">{questionMessage}</p>}
            <h3>Freigegebene Fragen</h3>{questions.map(q=><div className="zePublicQuestion" key={q.id}>{q.text}</div>)}
          </div>}
        </div>
      </>}
    </main>
    <footer className="zeAudienceFooter">Zeivio · Live Audience Experience</footer>
  </div>;
}
