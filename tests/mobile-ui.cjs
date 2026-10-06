const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const path=require('node:path');
// Deterministic UI fixtures only: every Supabase request is intercepted, never sent to a hosted database.
// Compare the actual desktop source before this change, rather than a recreated screen.
const out='test-results/mobile-ui';fs.mkdirSync(out,{recursive:true});
const baseline='/tmp/laudos-desktop-baseline';
let lastPage;
const specs=[{name:'Viscosidade do produto',unit:'cP',min:100,max:250,required:true},{name:'pH',unit:'pH',min:6,max:8,required:true}];
const product={id:1,code:'RES-001',name:'Resina para fabricação de painéis',family:'Resina',specifications:specs,active:true,version:1};
const date='2026-10-04T09:00:00.000Z';
const cycles=[1,2,3].map(id=>({id,tank_id:id,product_id:1,specifications:specs,specification_version:1,manufactured_at:date,lots:'LOTE-2026-'+id,reference_values:['180','7'],analyst:'Ana responsável pelas análises',active:id===1,status:id===1?'Ativo':id===2?'Encerrado':'Cancelado',product_snapshot:product,snapshot_provenance:'recorded',created_at:date,closed_at:id===1?null:date}));
const loading={id:1,cycle_id:1,plate:'ABC1D23',trailer:'Única',carrier:'Transportadora Industrial Agudos',destination:'Itapetininga - Revestidos',destination_id:'itapetininga-revestidos',analyst:'Ana responsável pelas análises',loaded_at:date,values:['180','7'],source:'own',observation:'Transferência para unidade receptora.',state:'Emitido',edit_version:1,certificate_number:'LA-2026-0001',issued_at:date};
const user={id:'00000000-0000-0000-0000-000000000001',email:'ana.operadora@laudos.example.test',user_metadata:{full_name:'Ana'},app_metadata:{provider:'email'},aud:'authenticated',role:'authenticated',created_at:date};
const profile={...user,name:'Ana',role:'Administrador',active:true,status:'Ativo',destination:null};
const session={access_token:'test-token',refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const permissions=['loadings.create','users.manage','products.manage','authorizations.reuse','authorizations.exception','cycles.close','cancellations.request','cancellations.decide'];
const requests=[{id:1,kind:'cancel_cycle',cycle_id:3,loading_id:null,edit_version:null,requester_name:'Ana',requested_at:date,reason:'Tanque informado incorretamente no cadastro.',decision:'approved',actor_name:'Supervisor responsável',actor_role:'Supervisor',decided_at:date,decision_reason:'Cancelamento conferido e aprovado.'}];
async function fixture(browser,port,width){
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<=900});
 await context.route('https://mobile-fixture.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  let data;
  if(path==='/auth/v1/token')data=session;
  else if(path==='/auth/v1/user')data=user;
  else if(path==='/auth/v1/logout')data={};
  else if(path==='/rest/v1/pilot_profiles')data=profile;
  else if(path.endsWith('/pilot_password_state'))data={required:false};
  else if(path.endsWith('/pilot_permissions'))data=permissions;
  else if(path.endsWith('/pilot_products'))data=[product];
  else if(path.endsWith('/pilot_tanks'))data=cycles.map(c=>({id:c.id,code:'TQ-'+c.id,family:'Resina',active:true}));
  else if(path.endsWith('/pilot_cycles'))data=cycles;
  else if(path.endsWith('/pilot_loadings'))data=[loading,{...loading,id:2,plate:'DEF4G56',state:'Rascunho',certificate_number:null,issued_at:null}];
  else if(path.endsWith('/pilot_approvals')||path.endsWith('/pilot_list_pending_profiles'))data=[];
  else if(path.endsWith('/pilot_destinations'))data=[{id:'itapetininga-revestidos',name:'Itapetininga - Revestidos',active:true}];
  else if(path.endsWith('/pilot_authorization_requests'))data=requests;
  else if(path.endsWith('/pilot_list_users'))data=[profile];
  else if(path.endsWith('/pilot_product_versions'))data=[{product_id:1,version:1,data:product,author_name:'Ana',changed_at:date,captured_at:date,provenance:'recorded',changes:{}}];
  else if(path.endsWith('/pilot_certificate_details'))data={loading_id:1,edit_version:1,issuer:{name:'Ana',role:'Administrador',identity_source:'snapshot'},approvals:[]};
  else throw new Error('Unexpected fixture request '+path);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//,route=>route.fulfill({status:200,body:''}));
 const page=await context.newPage();lastPage=page;page.on('dialog',d=>d.accept());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port);await page.getByLabel('E-mail',{exact:true}).fill(user.email);await page.getByLabel('Senha',{exact:true}).fill('Fixture-only');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.locator('.sidebar').waitFor();
 await page.waitForFunction(()=>document.querySelector('.flow-card')||document.querySelector('.metrics'));
 return {context,page,errors};
}
async function nav(page,name){
 const menu=page.getByRole('button',{name:'Abrir menu',exact:true});if(await menu.count())await menu.click();
 await page.locator('.sidebar nav').getByRole('button',{name,exact:true}).click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function capture(page,name,width){
 await page.evaluate(()=>document.activeElement?.blur());
 await page.screenshot({path:out+'/'+name+'-'+width+'.png',fullPage:true});
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(el=>{const b=el.getBoundingClientRect();return b.width&&b.right>innerWidth+1}).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,100),right:el.getBoundingClientRect().right})).slice(0,12)}));
 if(overflow.scroll>overflow.width)console.log('OVERFLOW',name,width,JSON.stringify(overflow));
 assert.ok(overflow.scroll<=overflow.width,'page overflow '+name+' '+width);
 if(width===390&&['mobile-Início','mobile-Ciclos de tanques','mobile-loading-form'].includes(name))console.log('VISUAL_'+name+':'+(await page.screenshot({type:'jpeg',quality:65})).toString('base64'));
}
(async()=>{
 const baselineSha='df7ea43f5c881ec4421c789108200ee00c9c9543';
 execFileSync('git',['fetch','--depth=1','origin',baselineSha],{stdio:'pipe'});
 fs.mkdirSync(baseline,{recursive:true});
 const archive=execFileSync('git',['archive',baselineSha],{maxBuffer:8*1024*1024});
 execFileSync('tar',['-x','-C',baseline],{input:archive});
 if(!fs.existsSync(baseline+'/node_modules'))fs.symlinkSync(path.resolve('node_modules'),baseline+'/node_modules','dir');
 const env={...process.env,VITE_SUPABASE_URL:'https://mobile-fixture.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'ui-test-key'};
 // The real flow server already uses 5173 in CI; run independent fixture servers on different ports.
 const fixtureServers=[spawn(process.execPath,[path.resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5175','--strictPort'],{env,cwd:process.cwd(),stdio:'pipe'}),
 spawn(process.execPath,[path.resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5176','--strictPort'],{env,cwd:baseline,stdio:'pipe'})];
 await Promise.all([5175,5176].map(async port=>{for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok)return}catch{}await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Fixture server not ready '+port)}));
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1280,1440,1920]){
   const before=await fixture(browser,5176,width),after=await fixture(browser,5175,width);
   for(const name of ['Início','Ciclos de tanques','Carregamentos','Autorizações','Laudos','Cadastros','Usuários']){
    await nav(before.page,name);await nav(after.page,name);
    if(name==='Cadastros'){
     // Sticky changes Chromium's text compositing. Verify geometry and scroll behavior first,
     // then give the baseline only the requested sticky behavior for exact pixel comparison.
     const panel=after.page.locator('.tank-management');
     const oldBox=await before.page.locator('.tank-management').boundingBox(),newBox=await panel.boundingBox();
     for(const key of ['x','y','width','height'])assert.ok(Math.abs(oldBox[key]-newBox[key])<0.1,'Tank panel geometry changed '+key);
     assert.equal(await panel.evaluate(el=>getComputedStyle(el).position),'sticky');
     // Exercise a long operational list: sticky remains bounded by its grid row.
     await after.page.locator('.two-col > .card').first().evaluate(el=>{const extra=document.createElement('p');extra.id='test-long-product-list';extra.style.height='600px';extra.textContent='Lista operacional longa de verificação';el.append(extra)});
     await after.page.setViewportSize({width,height:650});
     await after.page.evaluate(()=>window.scrollTo(0,250));
     await after.page.waitForTimeout(100);
     assert.ok(Math.abs((await panel.boundingBox()).y-16)<=2,'Tank management must stick at the top');
     await after.page.locator('#test-long-product-list').evaluate(el=>el.remove());
     await after.page.setViewportSize({width,height:900});await after.page.evaluate(()=>window.scrollTo(0,0));
     await before.page.locator('.tank-management').evaluate(el=>Object.assign(el.style,{position:'sticky',top:'16px',alignSelf:'start',maxHeight:'calc(100dvh - 32px)',overflowY:'auto',overscrollBehavior:'contain',scrollbarWidth:'thin'}));
    }
    // Only the new account action is normalized; the rest of each desktop screen must match.
    if(await after.page.locator('.account-password').count()) await after.page.locator('.account-password').evaluate(el=>el.style.display='none');
    await capture(before.page,'desktop-before-'+name,width);await capture(after.page,'desktop-after-'+name,width);
    const a=fs.readFileSync(out+'/desktop-before-'+name+'-'+width+'.png'),b=fs.readFileSync(out+'/desktop-after-'+name+'-'+width+'.png');
    if(!a.equals(b)){console.log('DESKTOP_BEFORE:'+(await before.page.screenshot({type:'jpeg',quality:65})).toString('base64'));console.log('DESKTOP_AFTER:'+(await after.page.screenshot({type:'jpeg',quality:65})).toString('base64'));}
    assert.ok(a.equals(b),'desktop pixels changed '+name+' '+width);
   }
   for(const fixture of [before,after]){await nav(fixture.page,'Ciclos de tanques');await fixture.page.locator('.card-grid').getByRole('button',{name:'Novo carregamento',exact:true}).click();}
   for(const name of ['form','certificate','manual']){
    if(name==='certificate')for(const fixture of [before,after]){await nav(fixture.page,'Laudos');await fixture.page.locator('tbody tr').filter({hasText:loading.certificate_number}).click();await fixture.page.locator('.cert-responsibles').getByText('Ana',{exact:true}).waitFor();}
    if(name==='manual')for(const fixture of [before,after]){await fixture.page.locator('.sidebar nav').getByRole('button',{name:'Ajuda',exact:true}).click();await fixture.page.getByRole('dialog',{name:'Manual operacional'}).waitFor();}
    // Normalize only the explicitly requested additions/removal/date; all remaining pixels must match production.
    // Tank summary was already present in this production baseline.
    if(name==='certificate'){
     // Certificate identification and footer are explicitly redesigned and verified in the real PDF tests.
     await before.page.locator('.certificate').evaluate(el=>el.style.display='none');
     await after.page.locator('.certificate').evaluate(el=>el.style.display='none');
    }
    if(name==='manual')await before.page.locator('.manual-header small').evaluate(el=>{for(const node of el.childNodes)if(node.nodeType===Node.TEXT_NODE)node.textContent=node.textContent.replace('02/10/2026','05/10/2026')});
    if(name==='form'||name==='certificate'){
     const oldBox=await before.page.locator('.action-column').boundingBox(),newBox=await after.page.locator('.action-column').boundingBox();
     for(const key of ['x','y','width','height'])assert.ok(Math.abs(oldBox[key]-newBox[key])<0.1,'Action panel geometry changed '+key);
     // The requested bounded scroll container clips the card's shadow. Normalize that containment
     // in the baseline; actual sticky, tall content and keyboard focus are verified by real flows.
     await before.page.locator('.action-column').evaluate(el=>Object.assign(el.style,{alignSelf:'start',maxHeight:'calc(100dvh - 32px)',overflowY:'auto',overscrollBehavior:'contain',scrollbarWidth:'thin'}));
    }
    // Only the new account action is normalized; the rest of each desktop screen must match.
    if(await after.page.locator('.account-password').count()) await after.page.locator('.account-password').evaluate(el=>el.style.display='none');
    await capture(before.page,'desktop-before-'+name,width);await capture(after.page,'desktop-after-'+name,width);
    assert.ok(fs.readFileSync(out+'/desktop-before-'+name+'-'+width+'.png').equals(fs.readFileSync(out+'/desktop-after-'+name+'-'+width+'.png')),'desktop pixels changed '+name+' '+width);
   }
   await before.context.close();await after.context.close();console.log('DESKTOP PIXEL IDENTICAL',width,'all 7 screens; panel sticky/containment/form/certificate/manual normalized only for requested changes');
  }
  for(const width of [320,375,390,430,768,900]){
   const {context,page,errors}=await fixture(browser,5175,width);
   for(const name of ['Início','Ciclos de tanques','Carregamentos','Autorizações','Laudos','Cadastros','Usuários']){
    await nav(page,name);await capture(page,'mobile-'+name,width);
   }
   await nav(page,'Ciclos de tanques');await page.locator('.cycle-record-table tbody tr').filter({hasText:'TQ-2'}).getByRole('button',{name:'Consultar',exact:true}).click();
   await capture(page,'mobile-cycle-dialog',width);await page.getByRole('button',{name:'Fechar',exact:true}).click();
   await page.locator('.card-grid').getByRole('button',{name:'Novo carregamento',exact:true}).click();await capture(page,'mobile-loading-form',width);
   assert.ok(await page.locator('.mobile-loading-actions').isVisible());
   await page.getByRole('combobox',{name:'Transportadora',exact:true}).fill('Transportadora');
   await page.getByRole('option',{name:loading.carrier,exact:true}).tap();assert.equal(await page.getByRole('combobox',{name:'Transportadora',exact:true}).inputValue(),loading.carrier);
   await nav(page,'Laudos');await page.locator('tbody tr').filter({hasText:loading.certificate_number}).click();await page.locator('.cert-responsibles').getByText('Ana',{exact:true}).waitFor();await capture(page,'mobile-certificate',width);
   if(width===390)console.log('VISUAL_MOBILE_CERTIFICATE:'+(await page.screenshot({type:'jpeg',quality:65})).toString('base64'));
   await page.getByRole('button',{name:'Abrir menu',exact:true}).click();await page.locator('.sidebar nav').getByRole('button',{name:'Ajuda',exact:true}).click();await page.getByRole('dialog',{name:'Manual operacional'}).waitFor();await capture(page,'mobile-manual',width);
   assert.deepEqual(errors,[]);
   if(width===390)console.log('VISUAL_MOBILE_MANUAL:'+(await page.screenshot({type:'jpeg',quality:65})).toString('base64'));
   await context.close();console.log('MOBILE UI PASSED',width);
  }
 }finally{await browser.close();for(const server of fixtureServers)server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
