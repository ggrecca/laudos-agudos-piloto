// Real Auth, Edge Function, RLS and browser checks against the disposable CI stack.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createClient}=require('@supabase/supabase-js');
module.exports=async ({browser,users,password,sql,record,rpc,denied,root,consoleErrors,cycle,loadingArgs})=>{
 const url=process.env.API_URL,anon=process.env.ANON_KEY;
 const admin=users.admin.client,sup=users.supervisor.client,operator=users.operador.client;
 const email='senha@laudos.example.test',nextPassword='New-local-test-73!';
 const created=await root.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Titular senha'}});assert.ifError(created.error);
 const uid=created.data.user.id;
 sql("update public.pilot_profiles set role='Operador A',active=true,status='Ativo' where id='"+uid+"'");
 const user=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.ifError((await user.auth.signInWithPassword({email,password})).error);
 const endpoint=async body=>{
  const session=(await user.auth.getSession()).data.session;
  const response=await fetch(url+'/functions/v1/password-actions',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},body:JSON.stringify(body)});
  return {status:response.status,...await response.json()};
 };
 for(let i=0;i<60;i++){
  try{const probe=await fetch(url+'/functions/v1/password-actions',{method:'OPTIONS'});if(probe.status===200)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 page.on('pageerror',e=>consoleErrors.push(e.message));
 await page.goto('http://127.0.0.1:5173');
 await page.getByRole('button',{name:'Esqueci minha senha',exact:true}).click();
 await page.getByLabel('E-mail',{exact:true}).fill(email);
 const [resetResponse]=await Promise.all([page.waitForResponse(response=>response.url().includes('/functions/v1/password-actions')&&response.request().method()==='POST'),page.getByRole('button',{name:'Solicitar reset',exact:true}).click()]);
 const resetReply=await resetResponse.json();assert.equal(resetResponse.status(),200,JSON.stringify(resetReply));
 await page.getByRole('status').filter({hasText:'Se houver uma conta ativa'}).waitFor();
 const req=Number(sql("select id from public.pilot_authorization_requests where password_user_id='"+uid+"' and decision='pending'"));assert.ok(req);
 assert.equal((await endpoint({action:'request_reset',email})).status,200);
 assert.equal(sql("select count(*) from public.pilot_authorization_requests where password_user_id='"+uid+"'"),'1');
 assert.equal((await endpoint({action:'reset',email,code:'a'.repeat(32),password:nextPassword,confirmation:nextPassword})).status,400);
 assert.ok((await user.auth.resetPasswordForEmail(email)).error,'Native email recovery must not bypass the authorization queue');
 assert.ok((await user.auth.updateUser({password:nextPassword})).error,'Native Auth update must not bypass the protected flows');
 await denied(operator,'pilot_decide_password_reset',{p_id:req,p_approve:true,p_reason:'Tentativa indevida'},/Acesso/);
 const deniedService=await user.rpc('pilot_prepare_password_change',{p_user_id:uid,p_email:email,p_code_hash:null,p_nonce_hash:'forged'});assert.ok(deniedService.error);
 const visible=await operator.from('pilot_authorization_requests').select('id').eq('id',req);assert.ifError(visible.error);assert.equal(visible.data.length,0);
 record('Senha: solicitação real pelo login, autorização pendente, deduplicação, reset antes da aprovação e chamadas diretas bloqueados');
 // Reject, preserve history, then allow a new request.
 await rpc(sup,'pilot_decide_password_reset',{p_id:req,p_approve:false,p_reason:'Identidade ainda não comprovada'});
 assert.equal(sql('select decision from public.pilot_authorization_requests where id='+req),'rejected');
 assert.equal((await endpoint({action:'request_reset',email})).status,200);
 const approvedReq=Number(sql("select id from public.pilot_authorization_requests where password_user_id='"+uid+"' and decision='pending'"));
 const supVisible=await sup.from('pilot_authorization_requests').select('id').eq('id',approvedReq);assert.ifError(supVisible.error);assert.equal(supVisible.data.length,1,'Supervisor must see subordinate reset requests despite profile RLS');
 await page.getByRole('button',{name:'Voltar',exact:true}).click();
 await page.getByLabel('E-mail',{exact:true}).fill(users.supervisor.email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.locator('.sidebar').waitFor();
 await page.locator('.sidebar nav').getByRole('button',{name:'Autorizações',exact:true}).click();
 await page.getByRole('button',{name:'Autorizar reset',exact:true}).click();
 const decisionDialog=page.getByRole('dialog',{name:'Decisão de reset de senha',exact:true});
 await decisionDialog.getByRole('checkbox').check();await decisionDialog.getByLabel('Justificativa da decisão',{exact:true}).fill('Identidade conferida pessoalmente');await decisionDialog.getByRole('button',{name:'Registrar decisão de reset',exact:true}).click();
 const delivery=page.getByRole('dialog',{name:'Entrega pessoal do código',exact:true});await delivery.waitFor();
 let authorization={code:(await delivery.locator('.reset-delivery-code').innerText()).replace(/-/g,'')};assert.match(authorization.code,/^[a-f0-9]{32}$/);
 await delivery.getByRole('button',{name:'Código entregue · fechar',exact:true}).click();
 await page.getByRole('button',{name:'Sair',exact:true}).click();await page.getByLabel('E-mail',{exact:true}).waitFor();
 assert.ifError((await sup.auth.signInWithPassword({email:users.supervisor.email,password})).error);

 assert.equal((await user.from('pilot_products').select('id')).data.length,0);
 assert.deepEqual(await rpc(user,'pilot_permissions',{}),[]);
 const previousCode=authorization.code;
 authorization=await rpc(sup,'pilot_decide_password_reset',{p_id:approvedReq,p_approve:true,p_reason:'Renovação após conferência pessoal; código perdido'});assert.notEqual(authorization.code,previousCode);
 assert.equal((await endpoint({action:'reset',email,code:previousCode,password:nextPassword,confirmation:nextPassword})).status,400);
 assert.equal((await endpoint({action:'change',current_password:password,password:nextPassword,confirmation:nextPassword})).status,403);
 await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.getByRole('heading',{name:'Definir nova senha',exact:true}).waitFor();
 assert.equal(await page.locator('.sidebar').count(),0);assert.equal(await page.getByLabel('Senha atual',{exact:true}).count(),0);
 await page.getByLabel('Código autorizado',{exact:true}).fill(authorization.code);
 await page.getByLabel('Nova senha',{exact:true}).fill(nextPassword);await page.getByLabel('Confirmar nova senha',{exact:true}).fill('different');
 await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();await page.getByText('As senhas não coincidem.',{exact:true}).waitFor();
 assert.equal(sql('select completed_at is null from public.pilot_authorization_requests where id='+approvedReq),'t');
 await page.getByLabel('Confirmar nova senha',{exact:true}).fill(nextPassword);
 const [passwordResponse]=await Promise.all([page.waitForResponse(response=>response.url().includes('/functions/v1/password-actions')&&response.request().method()==='POST'),page.getByRole('button',{name:'Salvar nova senha',exact:true}).click()]);
 assert.equal(passwordResponse.status(),200,JSON.stringify(await passwordResponse.json()));
 await page.getByLabel('Senha',{exact:true}).waitFor();
 await page.reload();await page.getByLabel('Senha',{exact:true}).waitFor();assert.equal(await page.locator('.sidebar').count(),0);
 assert.equal(sql('select completed_at is not null from public.pilot_authorization_requests where id='+approvedReq),'t');
 assert.equal(sql("select raw_app_meta_data ? 'laudos_password_permit' from auth.users where id='"+uid+"'"),'f');
 assert.equal((await endpoint({action:'reset',email,code:authorization.code,password:'Another-local-83!',confirmation:'Another-local-83!'})).status,400);
 assert.deepEqual(await rpc(user,'pilot_permissions',{}),[],'Revoked access tokens must not retain operational permissions');
 assert.ok((await user.auth.signInWithPassword({email,password})).error);assert.ifError((await user.auth.signInWithPassword({email,password:nextPassword})).error);
 assert.ok((await rpc(user,'pilot_permissions',{})).length);
 record('Reset: rejeição preservada, aprovação do Supervisor, bloqueio no banco/na tela, nova senha obrigatória sem senha antiga e consumo atômico sem reuso');
 // Both Admin and Supervisor decisions; preserve existing user hierarchy.
 assert.equal((await endpoint({action:'request_reset',email:users.admin2.email})).status,200);
 const adminReq=Number(sql("select id from public.pilot_authorization_requests where password_user_id='"+users.admin2.id+"' and decision='pending'"));
 await denied(sup,'pilot_decide_password_reset',{p_id:adminReq,p_approve:true,p_reason:'Tentativa contra Administrador'},/Acesso/);
 await rpc(admin,'pilot_decide_password_reset',{p_id:adminReq,p_approve:false,p_reason:'Solicitação de teste rejeitada pelo Administrador'});
 record('Reset: Administrador decide; Supervisor não amplia poderes sobre Administradores; histórico inclui decisão, ator, datas e conclusão');
 // Expiration, five attempts, renewal and one-use permit concurrency.
 sql('truncate pilot_private.password_rate_limits');
 assert.equal((await endpoint({action:'request_reset',email})).status,200);
 const lockedReq=Number(sql("select id from public.pilot_authorization_requests where password_user_id='"+uid+"' and decision='pending'"));
 const firstCode=await rpc(sup,'pilot_decide_password_reset',{p_id:lockedReq,p_approve:true,p_reason:'Conferência presencial para teste de bloqueio'});
 const decisionTime=sql('select decided_at::text from public.pilot_authorization_requests where id='+lockedReq);
 for(let i=0;i<5;i++)assert.equal((await endpoint({action:'reset',email,code:'f'.repeat(32),password:'Locked-local-81!',confirmation:'Locked-local-81!'})).status,400);
 assert.equal((await endpoint({action:'reset',email,code:firstCode.code,password:'Locked-local-81!',confirmation:'Locked-local-81!'})).status,400);
 const renewed=await rpc(sup,'pilot_decide_password_reset',{p_id:lockedReq,p_approve:true,p_reason:'Identidade novamente conferida; renovação'});
 assert.notEqual(renewed.code,firstCode.code);assert.equal(sql('select decided_at::text from public.pilot_authorization_requests where id='+lockedReq),decisionTime);
 sql("update pilot_private.password_reset_secrets set expires_at=now()-interval '1 second' where request_id="+lockedReq);
 assert.equal((await endpoint({action:'reset',email,code:renewed.code,password:'Locked-local-81!',confirmation:'Locked-local-81!'})).status,400);
 const finalCode=await rpc(admin,'pilot_decide_password_reset',{p_id:lockedReq,p_approve:true,p_reason:'Administrador conferiu novamente o titular'});
 assert.equal((await endpoint({action:'reset',email,code:finalCode.code,password:nextPassword,confirmation:nextPassword})).status,400,'Same password must fail without consuming authorization');
 assert.equal(sql('select completed_at is null from public.pilot_authorization_requests where id='+lockedReq),'t');
 assert.equal((await endpoint({action:'reset',email,code:finalCode.code,password:'Unlocked-local-92!',confirmation:'Unlocked-local-92!'})).status,200);
 assert.ifError((await user.auth.signInWithPassword({email,password:'Unlocked-local-92!'})).error);
 // Restore the reference password for the normal-change UI test through the protected API.
 assert.equal((await endpoint({action:'change',current_password:'Unlocked-local-92!',password:nextPassword,confirmation:nextPassword})).status,200);
 assert.ifError((await user.auth.signInWithPassword({email,password:nextPassword})).error);
 sql('truncate pilot_private.password_rate_limits'); // Isolated test housekeeping only.
 record('Reset: validade de 24h, bloqueio após 5 códigos incorretos, renovação auditada, decisão original preservada e falha do Auth sem consumo');
 const wrong=await endpoint({action:'change',current_password:'wrong',password:'Changed-local-95!',confirmation:'Changed-local-95!'});assert.equal(wrong.status,400);assert.equal(wrong.field,'current');
 const mismatch=await endpoint({action:'change',current_password:nextPassword,password:'Changed-local-95!',confirmation:'other'});assert.equal(mismatch.field,'confirmation');
 assert.ok((await user.auth.updateUser({password:'Bypass-local-12!'})).error);
 await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(nextPassword);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.locator('.sidebar').waitFor();
 await page.getByRole('button',{name:'Alterar senha',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Alterar senha',exact:true});
 await dialog.getByLabel('Senha atual',{exact:true}).fill(nextPassword);await dialog.getByLabel('Nova senha',{exact:true}).fill('Changed-local-95!');await dialog.getByLabel('Confirmar nova senha',{exact:true}).fill('Changed-local-95!');await dialog.getByRole('button',{name:'Alterar senha',exact:true}).click();
 await page.getByLabel('Senha',{exact:true}).waitFor();
 assert.ifError((await user.auth.signInWithPassword({email,password:'Changed-local-95!'})).error);
 assert.equal(sql("select count(*) from public.pilot_authorization_requests where password_user_id='"+uid+"'"),'3');
 assert.equal(sql("select count(*) from public.pilot_audit where actor_id='"+uid+"' and action='alterou a própria senha'"),'2');
 record('Alterar senha: senha atual validada no servidor, erros locais, confirmação, sucesso no navegador, sem autorização e sessões encerradas');
 // Resin snapshot + stable destination jointly determine the pipe exception.
 const pipe=await rpc(operator,'pilot_create_loading',{...loadingArgs(cycle,'agudos-mdf2'),p_plate:'',p_carrier:''});
 await rpc(operator,'pilot_save_loading',{p_id:pipe,...Object.fromEntries(Object.entries({...loadingArgs(cycle,'agudos-mdf2'),p_plate:'',p_carrier:''}).filter(([k])=>k!=='p_cycle_id'))});
 await rpc(operator,'pilot_issue',{p_id:pipe});
 assert.equal(sql('select plate||carrier from public.pilot_loadings where id='+pipe),'');
 await denied(operator,'pilot_create_loading',{...loadingArgs(cycle,'agudos-mdf1'),p_plate:'',p_carrier:''},/transportadora/);
 const em=await rpc(admin,'pilot_save_product',{p_code:'EM-PIPE-TEST',p_name:'Emulsão teste',p_family:'Emulsão',p_specs:[{name:'pH',unit:'',min:6,max:8,required:true}]});
 const tank=await rpc(admin,'pilot_save_tank',{p_code:'EM-PIPE-TEST',p_family:'Emulsão'});
 const emCycle=await rpc(operator,'pilot_create_cycle',{p_tank_id:tank,p_product_id:em,p_manufactured_at:new Date().toISOString(),p_lots:'EM-CI',p_reference:['7'],p_analyst:'Analista'});
 await denied(operator,'pilot_create_loading',{...loadingArgs(emCycle,'agudos-mdf2','',['7']),p_carrier:''},/transportadora/);
 record('Tubulação: Resina → MDF2 cria/edita/emite sem placa ou transportadora e sem dados fictícios; MDF1 e Emulsão → MDF2 continuam exigindo ambos');
 await page.getByLabel('E-mail',{exact:true}).fill(users.operador.email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.locator('.sidebar').waitFor();
 await page.locator('.sidebar nav').getByRole('button',{name:'Laudos',exact:true}).click();
 const certNumber=sql('select certificate_number from public.pilot_loadings where id='+pipe);
 await page.locator('tbody tr').filter({hasText:certNumber}).click();await page.locator('.certificate').waitFor();await page.locator('.cert-responsibles').getByText('Operador atualizado',{exact:true}).waitFor();
 const cert=page.locator('.certificate');assert.ok((await cert.innerText()).includes('Por tubulação'));assert.ok(!(await cert.innerText()).includes('Data do carregamento'));
 const fields=await cert.locator('.cert-grid > span').allTextContents();assert.ok(fields[0].startsWith('Família'));assert.ok(fields[1].startsWith('Produto / código'));assert.ok(fields[2].startsWith('Lotes'));assert.ok(fields[3].startsWith('Fabricação'));assert.ok(fields[4].startsWith('Tanque / Ciclo de tanque'));
 assert.match(await cert.locator('.cert-footer').innerText(),/Data de emissão[\s\S]*Origem dos resultados[\s\S]*Análises da transferência por tubulação/);
 const pdfPages=async name=>{const bytes=await page.pdf({path:'test-results/'+name+'.pdf',preferCSSPageSize:true,printBackground:true});assert.equal((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1,'Certificate PDF must have exactly one page: '+name);};
 await pdfPages('pipeline-certificate');
 // Exercise nine (current production maximum) and thirty complete rows, without truncation.
 for(const count of [9,30,60]){
  await cert.locator('tbody').evaluate((tbody,count)=>{const first=tbody.rows[0].cloneNode(true);tbody.innerHTML='';for(let i=0;i<count;i++){const row=first.cloneNode(true);row.cells[0].textContent='Análise completa '+(i+1);tbody.append(row);}},count);
  await pdfPages('certificate-'+count+'-analyses');assert.equal(await cert.locator('tbody tr').count(),count);
 }
 await page.screenshot({path:'test-results/certificate-identification.png',fullPage:true});
 record('Laudo: nova ordem, tubulação coerente, rodapé com emissão/origem, sem data do carregamento e PDFs de 1 página com 9, 30 e 60 análises completas');
 await context.close();
};
