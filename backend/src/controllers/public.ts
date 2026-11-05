import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

function validParticipant(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
}
async function activeSlide(slideId:string) {
  const slide=await prisma.slide.findUnique({where:{id:slideId},include:{presentation:true}});
  if(!slide || !slide.presentation.isPublished || !slide.presentation.sessionActive)return null;
  const current=await prisma.slide.findMany({where:{presentationId:slide.presentationId},orderBy:{orderIndex:'asc'},select:{id:true}});
  return current[slide.presentation.currentSlideIndex]?.id===slideId ? slide : null;
}
export async function getPublicPresentationByCode(req: Request, res: Response): Promise<void> {
  try {
    const code=(req.params.code as string).toUpperCase().trim();
    const p=await prisma.presentation.findUnique({
      where:{accessCode:code},
      include:{
        owner:{select:{name:true}},
        slides:{orderBy:{orderIndex:'asc'},select:{
          id:true,orderIndex:true,type:true,title:true,subtitle:true,content:true,design:true,options:true
        }}
      }
    });
    if(!p || !p.isPublished){res.status(404).json({error:'Präsentation nicht gefunden oder nicht öffentlich.'});return;}
    const {slides,...meta}=p;
    res.setHeader('Cache-Control','no-store');
    res.json({presentation:{...meta,slides:p.sessionActive?[slides[p.currentSlideIndex]].filter(Boolean):[]}});
  }catch(error){console.error('Public presentation error',error);res.status(500).json({error:'Internal server error'});}
}
export async function submitVote(req:Request,res:Response):Promise<void>{
  try {
    const {slideId,optionIndex,participantId}=req.body||{};
    if(typeof slideId!=='string'||!Number.isInteger(optionIndex)||!validParticipant(participantId)){
      res.status(400).json({error:'Invalid voting data'});return;
    }
    const slide=await activeSlide(slideId);
    if(!slide||slide.type!=='POLL'){res.status(403).json({error:'Poll is not active'});return;}
    let options:unknown;
    try{options=JSON.parse(slide.options||'[]');}catch{options=[];}
    if(!Array.isArray(options)||optionIndex<0||optionIndex>=options.length){res.status(400).json({error:'Invalid option'});return;}
    const vote=await prisma.pollVote.create({data:{slideId,optionIndex,participantId}});
    res.status(201).json({message:'Vote recorded',voteId:vote.id});
  }catch(error){
    if((error as {code?:string}).code==='P2002'){res.status(409).json({error:'Du hast bereits abgestimmt.'});return;}
    console.error('Submit vote error',error);res.status(500).json({error:'Internal server error'});
  }
}
const questionThrottle=new Map<string,number>();
export async function submitQuestion(req:Request,res:Response):Promise<void>{
  try{
    const {slideId,participantId,text}=req.body||{};
    if(typeof slideId!=='string'||!validParticipant(participantId)||typeof text!=='string'||!text.trim()||text.length>300){
      res.status(400).json({error:'Invalid question'});return;
    }
    const slide=await activeSlide(slideId);
    if(!slide||slide.type!=='QA'){res.status(403).json({error:'Q&A is not active'});return;}
    const key=slideId+':'+participantId,now=Date.now();
    if(now-(questionThrottle.get(key)||0)<10000){res.status(429).json({error:'Bitte warte zehn Sekunden.'});return;}
    questionThrottle.set(key,now);
    if(questionThrottle.size>5000){for(const [k,t] of questionThrottle)if(now-t>60000)questionThrottle.delete(k);}
    await prisma.audienceQuestion.create({data:{slideId,participantId,text:text.trim()}});
    res.status(201).json({message:'Frage zur Moderation eingereicht'});
  }catch(error){console.error('Submit question error',error);res.status(500).json({error:'Internal server error'});}
}
export async function getApprovedQuestions(req:Request,res:Response):Promise<void>{
  try{
    const slideId=req.params.slideId as string;
    const slide=await activeSlide(slideId);
    if(!slide||slide.type!=='QA'){res.status(404).json({error:'Q&A not active'});return;}
    const questions=await prisma.audienceQuestion.findMany({where:{slideId,isApproved:true},select:{id:true,text:true,createdAt:true},orderBy:{createdAt:'desc'},take:50});
    res.json({questions});
  }catch(error){console.error('Public question error',error);res.status(500).json({error:'Internal server error'});}
}
