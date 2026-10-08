import assert from "node:assert/strict";
import { spawn } from "node:child_process";
async function run(args,changes) {
  const child=spawn(process.execPath,args,{env:{...process.env,...changes}});
  let output="";child.stderr.on("data",data=>output+=data);child.stdout.on("data",data=>output+=data);
  const code=await new Promise(resolve=>child.on("close",resolve));
  return {code,output};
}
for(const [name,args,env,expected] of [
  ["production startup rejected",["src/campus/server.js"],{NODE_ENV:"production"},"never deploy"],
  ["missing local-lab opt-in rejected",["src/campus/server.js"],{LAB_LOCAL_ONLY:"false"},"LAB_LOCAL_ONLY=true"],
  ["reset requires explicit yes",["scripts/campus-seed.js","--reset"],{},"Pass --yes"]
]) {
  const result=await run(args,env);
  assert.equal(result.code,1);assert.ok(result.output.includes(expected));
  console.log(JSON.stringify({variant:process.env.VARIANT,name,ok:true}));
}
