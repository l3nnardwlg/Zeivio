import { Router, Response } from 'express';
import express from 'express';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

export const MEDIA_DIRECTORY = path.resolve(process.env.MEDIA_DIR || path.join(process.cwd(), 'uploads'));
const router = Router();
const types: Record<string,string> = {
  'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'
};
function hasSignature(bytes:Buffer, type:string):boolean {
  if(type==='image/png') return bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(type==='image/jpeg') return bytes.length>3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(type==='image/gif') return bytes.subarray(0,6).toString('ascii')==='GIF89a'||bytes.subarray(0,6).toString('ascii')==='GIF87a';
  if(type==='image/webp') return bytes.length>12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  return false;
}
router.post('/', requireAuth, (req,res,next)=>{
  if(!types[req.headers['content-type']||'']) {res.status(415).json({error:'Unsupported image type'});return;}
  next();
},express.raw({type:()=>true,limit:'5mb'}),async(req:AuthenticatedRequest,res:Response)=>{
  try {
    const type=req.headers['content-type']||'';
    const body=req.body as Buffer;
    if(!Buffer.isBuffer(body)||!hasSignature(body,type)){res.status(400).json({error:'Invalid image file'});return;}
    const filename=`${randomUUID()}.${types[type]}`;
    await mkdir(MEDIA_DIRECTORY,{recursive:true});
    await writeFile(path.join(MEDIA_DIRECTORY,filename),body,{flag:'wx'});
    res.status(201).json({url:`/api/media/${filename}`});
  }catch(error){console.error('Media upload failed',error);res.status(500).json({error:'Upload failed'});}
});
export default router;
