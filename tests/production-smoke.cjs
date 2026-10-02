// Read-only verification of the published production UI. No login or writes.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  const response=await page.goto("https://laudos-agudos-piloto.vercel.app/",{waitUntil:"networkidle"});
  assert.equal(response.status(),200);
  assert.equal(await page.title(),"Laudos Agudos");
  await page.getByRole("heading",{name:"Laudos de qualidade",exact:true}).waitFor();
  await page.getByText("Perfis e permissões são definidos pelo responsável pelo Laudos Agudos.",{exact:true}).waitFor();
  assert.equal(await page.getByLabel("E-mail",{exact:true}).count(),1);
  assert.equal(await page.getByLabel("Senha",{exact:true}).count(),1);
  await page.getByRole("button",{name:"Ainda não tenho acesso",exact:true}).click();
  await page.getByRole("heading",{name:"Solicitar acesso",exact:true}).waitFor();
  assert.equal(await page.getByLabel("Nome completo",{exact:true}).count(),1);
  await page.getByRole("button",{name:"Já tenho uma conta",exact:true}).click();
  for(const width of [1280,1440,1920]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:"test-results/production-login-"+width+".png",fullPage:true});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync("test-results/production-smoke.json",JSON.stringify({status:"passed",url:page.url(),checks:["HTTP 200","official title","login form","access request form","desktop 1280/1440/1920","zero console errors"],readOnly:true},null,2));
  console.log("PRODUCTION READ-ONLY SMOKE PASSED");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
