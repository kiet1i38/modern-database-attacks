import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { createRepository } from "../src/campus/repository.js";
import { createCampusApp } from "../src/campus/app.js";
const variant=process.env.VARIANT;
const repo=await createRepository(variant);
const app=createCampusApp({repo,variant,secret:process.env.SESSION_SECRET,sessionMaxAge:200});
const server=app.listen(0,"127.0.0.1");
await new Promise(resolve=>server.once("listening",resolve));
let base="http://127.0.0.1:"+server.address().port+"/api";
let rateServer;
let cookie="",csrf="";
async function request(url,method="GET",body) {
  const response=await fetch(base+url,{method,headers:{cookie,"content-type":"application/json","x-csrf-token":csrf},body:body?JSON.stringify(body):undefined});
  const data=await response.json();
  if(response.headers.getSetCookie().length) cookie=response.headers.getSetCookie()[0].split(";")[0];
  if(data.csrfToken) csrf=data.csrfToken;
  return {status:response.status,data};
}
try {
  await request("/auth/session");
  assert.equal((await request("/auth/login","POST",{username:"admin",password:"Admin@123"})).status,200);
  assert.equal((await request("/auth/me")).status,200);
  await delay(400);
  assert.equal((await request("/auth/me")).status,401);
  const rateApp=createCampusApp({repo,variant,secret:process.env.SESSION_SECRET});
  rateServer=rateApp.listen(0,"127.0.0.1");
  await new Promise(resolve=>rateServer.once("listening",resolve));
  base="http://127.0.0.1:"+rateServer.address().port+"/api";cookie="";csrf="";
  await request("/auth/session");
  for (let i=0;i<100;i++) assert.equal((await request("/auth/login","POST",{username:"absent-rate-qa",password:"invalid"})).status,401);
  assert.equal((await request("/auth/login","POST",{username:"absent-rate-qa",password:"invalid"})).status,429);
  console.log(JSON.stringify({variant,ok:true,check:"real database session expires and rate limiter enforces 100 attempts/minute",rateLimit100AttemptsValid:true,testCookieMaxAgeMs:200,defaultAppCookieMaxAgeMs:1800000}));
} finally { if(rateServer) await new Promise(resolve=>rateServer.close(resolve)); await new Promise(resolve=>server.close(resolve)); await repo.close(); }
