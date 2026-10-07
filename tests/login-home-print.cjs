const assert = require("node:assert/strict");
const fs = require("node:fs");
const {execFileSync}=require("node:child_process");

module.exports=async ({browser,users,password,sql,record,consoleErrors})=>{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage();
 page.on("pageerror",e=>consoleErrors.push(e.message));
 await page.goto("http://127.0.0.1:5173");
 for(const width of [320,375,430,768,900,1280,1440,1920]){
  await page.setViewportSize({width,height:1000});
  const recovery=await page.getByRole("button",{name:"Esqueci minha senha",exact:true}).boundingBox();
  const guidance=await page.getByText("Perfis e permissões são definidos pelo responsável pelo Laudos Agudos.",{exact:true}).boundingBox();
  assert.ok(guidance.y>=recovery.y+recovery.height+8,"Login rows overlap at "+width);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===375||width===1440)await page.screenshot({path:"test-results/login-correction-"+width+".png",fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.getByLabel("E-mail",{exact:true}).fill(users.admin.email);
 await page.getByLabel("Senha",{exact:true}).fill(password);
 await page.getByRole("button",{name:"Entrar",exact:true}).click();
 await page.locator(".sidebar").waitFor();
 await page.locator(".flow-card").first().waitFor();
 const nav=async name=>{await page.locator(".sidebar nav").getByRole("button",{name,exact:true}).click();};
 await page.evaluate(id=>localStorage.setItem("laudos-agudos:onboarding:v1:"+id,"1"),users.admin.id);
 for(const name of ["Carregamentos","Autorizações","Cadastros"]){
  await nav(name);await page.locator(".heading h1").filter({hasText:name}).waitFor();
  await page.reload();await page.locator(".sidebar").waitFor();await page.locator(".flow-card").first().waitFor();
 }
 await nav("Carregamentos");
 await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
 await page.waitForLoadState("networkidle");
 assert.equal(await page.locator(".heading h1").innerText(),"Carregamentos","Data refresh must preserve navigation");
 // Verify the SDK cross-tab token-refresh event does not reset the active view.
 await page.evaluate(async()=>{
  const key=Object.keys(localStorage).find(k=>/^sb-.*-auth-token$/.test(k));
  const session=JSON.parse(localStorage.getItem(key));
  // Use a valid existing session in the SDK's broadcast shape; same user identity.
  const channel=new BroadcastChannel(key);
  channel.postMessage({event:"TOKEN_REFRESHED",session});
  channel.close();
 });
 await page.waitForTimeout(150);
 assert.equal(await page.locator(".heading h1").innerText(),"Carregamentos","Auth refresh must preserve navigation");
 const other=await context.newPage();
 await other.goto("http://127.0.0.1:5173");await other.locator(".sidebar").waitFor();await other.locator(".flow-card").first().waitFor();
 assert.equal(await page.locator(".heading h1").innerText(),"Carregamentos","Opening another tab must not redirect an existing tab");
 await other.close();
 record("Login/Início: recuperação e mensagem em linhas separadas em oito larguras; sessão existente e onboarding antigo iniciam no Início; refresh e navegação permanecem na página atual");
 await nav("Laudos");
 const number=sql("select certificate_number from public.pilot_loadings where state='Emitido' order by id desc limit 1");
 await page.locator("tbody tr").filter({hasText:number}).click();await page.locator(".certificate").waitFor();
 await page.getByRole("button",{name:"Baixar PDF",exact:true}).waitFor({state:"visible"});
 await page.waitForFunction(()=>!document.querySelector(".certificate-pdf-action").disabled);
 const official=await page.locator(".certificate").innerText();
 assert.ok(official.includes("Data de emissão")&&official.includes("Origem dos resultados"));
 // Native Chromium default headers enabled, not pre-disabled by the test.
 await page.pdf({path:"test-results/native-header-enabled.pdf",preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true});
 const native=execFileSync("pdftotext",["-layout","test-results/native-header-enabled.pdf","-"],{encoding:"utf8"});
 assert.ok(!native.includes("127.0.0.1")&&!native.includes("http:")&&!native.includes("Laudos Agudos"),"Browser title/URL must not be printed");
 assert.ok(native.includes("Data de emissão")&&native.includes("Origem dos resultados"));
 for(const count of [9,30,60]){
  await page.locator(".certificate tbody").evaluate((tbody,count)=>{
   const first=tbody.rows[0].cloneNode(true);tbody.innerHTML="";
   for(let i=0;i<count;i++){const row=first.cloneNode(true);row.cells[0].textContent="Análise controlada "+(i+1);tbody.append(row);}
  },count);
  const before=await page.locator(".certificate").innerText();
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"Baixar PDF",exact:true}).click();
  const download=await downloadPromise;
  const path="test-results/controlled-"+count+"-analyses.pdf";
  await download.saveAs(path);
  assert.match(download.suggestedFilename(),/^Laudo-.*\.pdf$/);
  assert.equal(await page.locator(".certificate").innerText(),before,"Export must not mutate the live certificate");
  const info=execFileSync("pdfinfo",[path],{encoding:"utf8"});
  assert.match(info,/Pages:\s+1\b/);assert.match(info,/Page size:\s+595\.\d+ x 841\.\d+ pts/);
  // Render the actual downloaded PDF; keep evidence for visual verification.
  execFileSync("pdftoppm",["-singlefile","-scale-to","1600","-png",path,"test-results/controlled-"+count+"-analyses"]);
 }
 await page.setViewportSize({width:390,height:900});
 assert.equal(await page.getByRole("button",{name:"Baixar PDF",exact:true}).count(),1,"Mobile must not duplicate PDF actions");
 const mobilePromise=page.waitForEvent("download");await page.getByRole("button",{name:"Baixar PDF",exact:true}).click();
 await (await mobilePromise).saveAs("test-results/controlled-mobile.pdf");
 assert.match(execFileSync("pdfinfo",["test-results/controlled-mobile.pdf"],{encoding:"utf8"}),/Pages:\s+1\b/);
 // Surface only fixture certificate/login images, never authentication state or credentials.
 for(const name of ["controlled-9-analyses","controlled-60-analyses","login-correction-375","login-correction-1440"]){
  console.log("REVIEW_IMAGE_"+name+":"+fs.readFileSync("test-results/"+name+".png").toString("base64"));
 }
 record("Impressão: PDF controlado A4 de uma página com 9/30/60 análises e mobile; exportação não altera certificado; impressão nativa com headers ativos omite título/URL e preserva rodapé oficial");
 await context.close();
};
