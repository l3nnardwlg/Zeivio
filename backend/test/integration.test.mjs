import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

test('Create → Edit → Present → Vote → Moderate Q&A', {timeout:45000},async()=>{
  const port=4077;
  const api=`http://127.0.0.1:${port}/api`;
  const server=spawn(process.execPath,['backend/dist/server.js'],{
    env:{...process.env,PORT:String(port),JWT_SECRET:'ci-only-test-key-0123456789abcdef0123456789abcdef',MEDIA_DIR:`/tmp/zeivio-media-${randomUUID()}`},
    stdio:'pipe'
  });
  let output='';
  server.stderr.on('data',chunk=>{output+=chunk.toString();});
  const request=async(endpoint,options={})=>{
    const result=await fetch(api+endpoint,{headers:{'content-type':'application/json',...options.headers},...options});
    const json=await result.json().catch(()=>({}));
    return {status:result.status,data:json};
  };
  try{
    let ready=false;
    for(let i=0;i<65;i++){
      try{const response=await fetch(api+'/health');if(response.ok){ready=true;break;}}catch{}
      if(server.exitCode!==null)throw new Error('Backend terminated: '+output);
      await sleep(200);
    }
    assert.ok(ready,'Backend did not start: '+output);
    const email=`test+${randomUUID()}@example.test`;
    const register=await request('/auth/register',{method:'POST',body:JSON.stringify({name:'Test',email,password:'very-secure-test-password'})});
    assert.equal(register.status,201,JSON.stringify(register.data));
    const headers={authorization:`Bearer ${register.data.token}`};
    const create=await request('/presentations',{method:'POST',headers,body:JSON.stringify({title:'CI Presentation'})});
    assert.equal(create.status,201,JSON.stringify(create.data));
    const pres=create.data.presentation;
    assert.ok(pres.accessCode.length>=6);
    const scene={version:1,background:'#FFFFFF',foreground:'#172033',elements:[{id:'example',kind:'text',x:5,y:5,width:75,height:22,text:'A headline'}]};
    const poll=await request(`/slides/presentation/${pres.id}`,{method:'POST',headers,body:JSON.stringify({title:'Poll',type:'POLL',design:JSON.stringify(scene),options:JSON.stringify(['Yes','No'])})});
    assert.equal(poll.status,201,JSON.stringify(poll.data));
    const pollId=poll.data.slide.id;
    const changed=await request(`/slides/${pollId}`,{method:'PUT',headers,body:JSON.stringify({design:JSON.stringify({...scene,background:'#101010'})})});
    assert.equal(changed.status,200,JSON.stringify(changed.data));
    const reorder=await request(`/slides/presentation/${pres.id}/reorder`,{method:'PUT',headers,body:JSON.stringify({slideIds:[pollId]})});
    assert.equal(reorder.status,200,JSON.stringify(reorder.data));
    const notLive=await request(`/public/p/${pres.accessCode}`);
    assert.equal(notLive.status,404);
    const start=await request(`/presentations/${pres.id}`,{method:'PATCH',headers,body:JSON.stringify({sessionActive:true,isPublished:true,currentSlideIndex:0})});
    assert.equal(start.status,200,JSON.stringify(start.data));
    const publicView=await request(`/public/p/${pres.accessCode}`);
    assert.equal(publicView.status,200,JSON.stringify(publicView.data));
    assert.equal(publicView.data.presentation.slides[0].id,pollId);
    const voter=randomUUID();
    const vote=await request('/public/vote',{method:'POST',body:JSON.stringify({slideId:pollId,optionIndex:0,participantId:voter})});
    assert.equal(vote.status,201,JSON.stringify(vote.data));
    const duplicate=await request('/public/vote',{method:'POST',body:JSON.stringify({slideId:pollId,optionIndex:1,participantId:voter})});
    assert.equal(duplicate.status,409,JSON.stringify(duplicate.data));
    const qa=await request(`/slides/presentation/${pres.id}`,{method:'POST',headers,body:JSON.stringify({title:'Questions',type:'QA',design:JSON.stringify(scene)})});
    assert.equal(qa.status,201,JSON.stringify(qa.data));
    const qaId=qa.data.slide.id;
    const navigate=await request(`/presentations/${pres.id}`,{method:'PATCH',headers,body:JSON.stringify({currentSlideIndex:1})});
    assert.equal(navigate.status,200,JSON.stringify(navigate.data));
    const question=await request('/public/questions',{method:'POST',body:JSON.stringify({slideId:qaId,participantId:randomUUID(),text:'Will Zeivio work?'})});
    assert.equal(question.status,201,JSON.stringify(question.data));
    const moderation=await request(`/slides/${qaId}/questions`,{headers});
    assert.equal(moderation.status,200,JSON.stringify(moderation.data));
    assert.equal(moderation.data.questions.length,1);
    const questionId=moderation.data.questions[0].id;
    const approve=await request(`/slides/${qaId}/questions/${questionId}`,{method:'PATCH',headers,body:JSON.stringify({isApproved:true})});
    assert.equal(approve.status,200,JSON.stringify(approve.data));
    const publicQuestions=await request(`/public/questions/${qaId}`);
    assert.equal(publicQuestions.status,200,JSON.stringify(publicQuestions.data));
    assert.equal(publicQuestions.data.questions.length,1);
    const stop=await request(`/presentations/${pres.id}`,{method:'PATCH',headers,body:JSON.stringify({sessionActive:false})});
    assert.equal(stop.status,200);
    const waiting=await request(`/public/p/${pres.accessCode}`);
    assert.deepEqual(waiting.data.presentation.slides,[]);
  }finally{server.kill('SIGTERM');}
});
