const assert=require('node:assert/strict');
module.exports=async function mobileFlows({browser,users,password,sql,record,consoleErrors}){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>consoleErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 async function login(name){await page.goto('http://127.0.0.1:5173');await page.getByLabel('E-mail',{exact:true}).fill(users[name].email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).tap();await page.locator('.sidebar').waitFor();}
 async function nav(name){await page.getByRole('button',{name:'Abrir menu',exact:true}).tap();await page.locator('.sidebar nav').getByRole('button',{name,exact:true}).tap();assert.equal(await page.locator('.sidebar nav').isVisible(),false);}
 const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 try{
  await login('operador');await noOverflow();
  await page.evaluate(()=>window.scrollTo(0,400));
  const menuBox=await page.getByRole('button',{name:'Abrir menu',exact:true}).boundingBox();assert.ok(menuBox.y>=0&&menuBox.y+menuBox.height<=100);
  await page.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await page.locator('.sidebar nav').isVisible(),false);
  await page.getByRole('button',{name:'Abrir menu',exact:true}).tap();await page.getByRole('button',{name:'Sair',exact:true}).waitFor();
  await page.keyboard.press('Escape');assert.equal(await page.locator('.sidebar nav').isVisible(),false);
  await nav('Ciclos de tanques');
  const closed=page.locator('.cycle-record-table tbody tr').filter({hasText:'T-CI-3'});await closed.getByRole('button',{name:'Consultar',exact:true}).tap();
  const dialog=page.getByRole('dialog',{name:'Consultar Ciclo de tanque',exact:true});await dialog.waitFor();await noOverflow();
  const box=await dialog.boundingBox();assert.ok(box.width<=390&&box.height<=820);
  await dialog.getByRole('button',{name:'Fechar',exact:true}).tap();
  const card=page.locator('.card-grid .card').filter({hasText:'WEB-LOTE'});
  const eye=await card.getByRole('button',{name:'Consultar',exact:true}).boundingBox();assert.ok(eye.width>=44&&eye.height>=44);
  await card.getByRole('button',{name:'Novo carregamento',exact:true}).tap();
  const bar=page.locator('.mobile-loading-actions');await bar.waitFor();
  const barBox=await bar.boundingBox();assert.ok(barBox.y+barBox.height<=845);
  await bar.getByRole('button',{name:'Salvar rascunho',exact:true}).tap();
  await page.locator('[data-field="plate"] [aria-invalid="true"]').waitFor();
  assert.ok(await page.locator('.floating-notice').isVisible());
  await page.getByRole('combobox',{name:'Placa',exact:true}).fill('MOB1234');
  const carrier=page.getByRole('combobox',{name:'Transportadora',exact:true});await carrier.tap();
  await page.getByRole('option',{name:'Transportadora WEB',exact:true}).tap();assert.equal(await carrier.inputValue(),'Transportadora WEB');
  assert.equal(await carrier.evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await page.getByLabel('Unidade / destino *',{exact:true}).selectOption('agudos-mdf2');
  await page.getByRole('combobox',{name:'pH',exact:true}).fill('7');await page.getByRole('combobox',{name:'Aspecto',exact:true}).fill('Límpido');
  await bar.getByRole('button',{name:'Salvar rascunho',exact:true}).tap();await page.getByText('Rascunho salvo.',{exact:true}).waitFor();
  assert.equal(sql("select state from public.pilot_loadings where plate='MOB1234'"),'Rascunho');
  await bar.getByRole('button',{name:'Emitir laudo',exact:true}).tap();await page.locator('.certificate').waitFor();
  assert.equal(sql("select state from public.pilot_loadings where plate='MOB1234'"),'Emitido');await noOverflow();
  assert.equal(await page.locator('details.loading-data').getAttribute('open'),null);
  assert.ok((await page.locator('.certificate').boundingBox()).y<(await page.locator('.two-col').boundingBox()).y);
  await page.locator('details.loading-data > summary').tap();assert.notEqual(await page.locator('details.loading-data').getAttribute('open'),null);
  await page.locator('details.loading-data > summary').tap();await page.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await page.locator('.certificate table').evaluate(el=>getComputedStyle(el).display),'block');
  await page.screenshot({path:'test-results/mobile-issued-certificate-390.png',fullPage:true});
  await nav('Ciclos de tanques');await card.getByRole('button',{name:'Novo carregamento',exact:true}).tap();
  await page.getByRole('combobox',{name:'Placa',exact:true}).fill('MOB5678');await carrier.fill('Transportadora WEB');
  await page.getByLabel('Unidade / destino *',{exact:true}).selectOption('uberaba-mdf');await page.getByLabel('Origem dos resultados',{exact:true}).selectOption('ref');
  await bar.getByRole('button',{name:'Solicitar autorização',exact:true}).tap();await page.getByText('Solicitação enviada. O responsável já pode avaliar.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Abrir menu',exact:true}).tap();await page.getByRole('button',{name:'Sair',exact:true}).tap();await page.getByLabel('E-mail',{exact:true}).waitFor();
  await login('tecnico');await nav('Autorizações');await page.getByRole('button',{name:'Autorizar referência',exact:true}).tap();
  await page.getByLabel('Justificativa obrigatória',{exact:true}).fill('Referências conferidas no celular');
  await page.getByRole('button',{name:'Registrar decisão',exact:true}).tap();await page.getByText('Decisão registrada.',{exact:true}).waitFor();await noOverflow();
  await page.getByRole('button',{name:'Abrir menu',exact:true}).tap();await page.locator('.sidebar nav').getByRole('button',{name:'Ajuda',exact:true}).tap();
  const manual=page.getByRole('dialog',{name:'Manual operacional',exact:true});await manual.waitFor();
  await manual.getByRole('searchbox',{name:'Buscar no manual',exact:true}).fill('cancelamento');
  await manual.getByRole('button',{name:'9. Corrigir um laudo já emitido',exact:true}).tap();
  const heading=await manual.locator('#manual-cancelamento-laudo').boundingBox();assert.ok(heading.y>=0&&heading.y<844);
  await manual.getByRole('button',{name:'Fechar manual',exact:true}).tap();
  for(const width of [375,430,768]){await page.setViewportSize({width,height:900});await nav('Laudos');await noOverflow();}
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Abrir menu',exact:true}).waitFor({state:'detached'});
  assert.ok(await page.locator('.sidebar nav').isVisible());assert.equal(await page.locator('.mobile-loading-actions').count(),0);
  record('Mobile real: login, menu/conta/saída, consulta de ciclo, toque no autocomplete, erro visível, rascunho, emissão, solicitação/aprovação, ajuda e retorno ao desktop');
 }finally{await context.close()}
};
