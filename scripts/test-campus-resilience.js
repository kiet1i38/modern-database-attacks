import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { VARIANTS } from "../src/campus/domain.js";
const evidence=process.env.EVIDENCE_DIR || "evidence/campusdesk-final-2026-10-09";
await mkdir(evidence,{recursive:true});
const results=[],sessions={};
async function docker(args) {
  const child=spawn("docker",["compose",...args]);
  let log="";child.stdout.on("data",d=>log+=d);child.stderr.on("data",d=>log+=d);
  const code=await new Promise(resolve=>child.on("close",resolve));
  if(code) throw new Error(log);
  return log;
}
async function request(variant,route,cookie="",method="GET",body,csrf="") {
  const response=await fetch("http://127.0.0.1:"+VARIANTS[variant].port+"/api"+route,{method,headers:{cookie,"content-type":"application/json","x-csrf-token":csrf},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  return {status:response.status,data:await response.json(),cookie:response.headers.getSetCookie()[0]?.split(";")[0]};
}
async function ready() {
  for(let retry=0;retry<100;retry++) {
    const health=await Promise.all(Object.keys(VARIANTS).map(v=>request(v,"/health").catch(()=>({status:0}))));
    if(health.every(r=>r.status===200))return;
    await delay(500);
  } throw new Error("Database recovery readiness timeout");
}
async function check(variant,name,fn) {
  try {await fn();results.push({variant,name,pass:true});console.log("PASS "+variant+" "+name);}
  catch(error){results.push({variant,name,pass:false,error:error.message});console.error("FAIL "+variant+" "+name+" "+error.message);}
}
try {
  for(const variant of Object.keys(VARIANTS)) {
    const initial=await request(variant,"/auth/session");
    const login=await request(variant,"/auth/login",initial.cookie,"POST",{username:"admin",password:"Admin@123"},initial.data.csrfToken);
    assert.equal(login.status,200);sessions[variant]=login.cookie;
  }
  await docker(["restart",...Object.keys(VARIANTS)]);
  await ready();
  for(const variant of Object.keys(VARIANTS)) await check(variant,"session survives application restart",async()=>assert.equal((await request(variant,"/auth/me",sessions[variant])).data.user.role,"admin"));
  await docker(["stop","mysql","mongodb"]);
  for(const variant of Object.keys(VARIANTS)) await check(variant,"database outage produces health 503 without stack",async()=>{const r=await request(variant,"/health");assert.equal(r.status,503);assert.equal(r.data.status,"unavailable");});
  await docker(["start","mysql","mongodb"]);await ready();
  for(const variant of Object.keys(VARIANTS)) await check(variant,"database recovery restores persistent session",async()=>assert.equal((await request(variant,"/auth/me",sessions[variant])).data.user.role,"admin"));
} finally {
  await docker(["start","mysql","mongodb"]).catch(()=>{});
  await ready().catch(error=>results.push({name:"final recovery",pass:false,error:error.message}));
  const summary={generatedAt:new Date().toISOString(),total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
  await writeFile(path.join(evidence,"resilience-results.json"),JSON.stringify(summary,null,2));
  if(summary.failed)process.exitCode=1;
}
