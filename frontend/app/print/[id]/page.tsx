'use client';
import React,{use,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useAuth} from '../../../lib/auth-context';
import {apiRequest} from '../../../lib/api';
import {SlideData,parseScene} from '../../../lib/scene';
import SlideSurface from '../../../components/SlideSurface';
import '../../editor.css';

export default function PrintPage({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);
  const {token,isLoading}=useAuth();
  const router=useRouter();
  const [slides,setSlides]=useState<SlideData[]>([]);
  const [title,setTitle]=useState('Präsentation');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!isLoading&&!token){router.replace('/login');return;}
    if(!token)return;
    let mounted=true;
    (async()=>{
      try{
        const [presentation,content]=await Promise.all([apiRequest<{presentation:{title:string}}>(`/presentations/${id}`),apiRequest<{slides:SlideData[]}>(`/slides/presentation/${id}`)]);
        if(mounted){setTitle(presentation.presentation.title);setSlides(content.slides);}
      }catch(e){if(mounted)setError(e instanceof Error?e.message:'Fehler beim Export');}
      finally{if(mounted)setLoading(false);}
    })();
    return()=>{mounted=false;};
  },[id,token,isLoading,router]);
  return <div className="zePrintPage">
    <header className="zePrintToolbar">
      <Link href={`/editor/${id}`} className="zeButton">← Zurück zum Editor</Link>
      <strong>{title}</strong>
      <span>{slides.length} Folien</span>
      <button className="zeButton zePrimary" disabled={loading||!!error} onClick={()=>window.print()}>Drucken / Als PDF speichern</button>
    </header>
    {loading?<p>Folien werden geladen …</p>:error?<p>{error}</p>:slides.map((slide,index)=><section className="zePrintSheet" key={slide.id} aria-label={`Folie ${index+1}`}>
      <SlideSurface scene={parseScene(slide)}/>
      <div className="zePrintNumber">{index+1} / {slides.length}</div>
    </section>)}
  </div>;
}
