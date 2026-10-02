import { Children, cloneElement, isValidElement, useEffect, useState, type ReactNode } from "react";
import { Eye, CircleX } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RecentInput } from "./RecentInput";
import { analysisResult, specificationText } from "./flow";
import { roleLabel, roles, roleRank, type Role } from "./permissions";
import type { Product, Cycle, Tank, Loading, Spec } from "./pilot";

export type Request = {
 id:number; kind:"reuse"|"exception"|"cancel_cycle"|"cancel_certificate"; cycle_id:number|null; loading_id:number|null;
 edit_version:number|null; requester_name:string|null; requested_at:string|null; reason:string;
 decision:"pending"|"approved"|"rejected"|"superseded"; actor_name:string|null; actor_role:string|null;
 decision_reason:string|null; decided_at:string|null; legacy:boolean;
};
export type ManagedUser = {id:string;name:string;email:string;role:Role;status:string;active:boolean;created_at:string};
export type Run = (task:()=>PromiseLike<{error:{message:string}|null;data?:unknown}>,message:string,after?:(data:unknown)=>void)=>Promise<void>;
const date = (s:string|null|undefined) => s ? new Date(s).toLocaleString("pt-BR") : "Não registrado";
const kindLabel = (kind:Request["kind"]) => ({reuse:"Uso das análises do tanque",exception:"Exceção de especificação",cancel_cycle:"Cancelamento de Ciclo de tanque",cancel_certificate:"Cancelamento de laudo"})[kind];
const decisionLabel = (d:Request["decision"]) => ({pending:"Pendente",approved:"Aprovada",rejected:"Rejeitada",superseded:"Substituída"})[d];
function Field({label,children}:{label:string;children:ReactNode}) {
 const controls=Children.map(children,c=>isValidElement<{"aria-label"?:string}>(c)&&typeof c.type==="string"?cloneElement(c,{"aria-label":c.props["aria-label"]||label}):c);
 return <label className="field"><span>{label}</span>{controls}</label>;
}
export function SpecificationHint({spec}:{spec:Spec}) {return <span className="spec-hint">Especificação: {specificationText(spec)} {spec.unit}</span>}
export function CancellationButton({kind,id,requests,db,run,busy,disabled=false,compact=false}:{kind:"cancel_cycle"|"cancel_certificate";id:number;requests:Request[];db:SupabaseClient;run:Run;busy:boolean;disabled?:boolean;compact?:boolean}) {
 const [open,setOpen]=useState(false),[reason,setReason]=useState("");
 const pending=requests.find(r=>r.kind===kind && (r.cycle_id===id||r.loading_id===id) && r.decision==="pending");
 return <>{pending ? <span className="pill amber">Cancelamento pendente</span> : <button type="button" className={compact?"cycle-action icon-button danger":undefined} aria-label="Solicitar cancelamento" title={disabled?"Cancelamento bloqueado: há carregamentos vinculados.":"Solicitar cancelamento"} disabled={busy||disabled} onClick={()=>{setReason("");setOpen(true)}}>{compact?<CircleX size={16} aria-hidden="true"/>:"Solicitar cancelamento"}</button>}
 {open && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Solicitar cancelamento">
 <h2>Solicitar cancelamento</h2><p>O registro original será preservado. A decisão exige Operador Técnico ou superior.</p>
 <Field label="Motivo obrigatório"><textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)}/></Field>
 <div className="actions"><button disabled={busy} onClick={()=>setOpen(false)}>Voltar</button><button className="primary" disabled={busy||reason.trim().length<3} onClick={()=>run(()=>db.rpc("pilot_request_cancellation",{p_kind:kind,p_id:id,p_reason:reason}),"Cancelamento solicitado.",()=>setOpen(false))}>Enviar solicitação</button></div>
 </section></div>}</>;
}
export function AuthorizationHistory({requests,open,db,run,busy,canDecide}:{requests:Request[];open:(r:Request)=>void;db:SupabaseClient;run:Run;busy:boolean;canDecide:boolean}) {
 const [query,setQuery]=useState(""),[status,setStatus]=useState("treated"),[kind,setKind]=useState("all"),[from,setFrom]=useState(""),[to,setTo]=useState("");
 const [decision,setDecision]=useState<{r:Request;approve:boolean}|null>(null),[reason,setReason]=useState("");
 const filtered=requests.filter(r=>(status==="all"||(status==="treated"?r.decision!=="pending":r.decision===status))&&(kind==="all"||r.kind===kind)&&(!from||!!r.requested_at&&r.requested_at.slice(0,10)>=from)&&(!to||!!r.requested_at&&r.requested_at.slice(0,10)<=to)&&[r.requester_name,r.actor_name,r.reason,String(r.loading_id??r.cycle_id)].join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
 const cancellations=requests.filter(r=>r.decision==="pending"&&r.kind.startsWith("cancel_"));
 return <>
 {cancellations.length>0 && <section className="card"><h2>Cancelamentos pendentes</h2>{cancellations.map(r=><div className="history-row" key={r.id}><div><strong>{kindLabel(r.kind)} · #{r.cycle_id??r.loading_id}</strong><p>{r.reason}</p><small>{r.requester_name||"Não registrado"} · {date(r.requested_at)}</small></div><div className="actions"><button onClick={()=>open(r)}>Abrir registro</button>{canDecide&&<><button disabled={busy} onClick={()=>{setDecision({r,approve:false});setReason("")}}>Rejeitar</button><button className="primary" disabled={busy} onClick={()=>{setDecision({r,approve:true});setReason("")}}>Autorizar</button></>}</div></div>)}</section>}
 <section className="card"><h2>Histórico de autorizações</h2><div className="filter-bar">
 <Field label="Buscar solicitante, autorizador ou registro"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, motivo ou referência…"/></Field>
 <Field label="Decisão"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="treated">Concluídas</option><option value="all">Todas</option>{["pending","approved","rejected","superseded"].map(d=><option key={d} value={d}>{decisionLabel(d as Request["decision"])}</option>)}</select></Field>
 <Field label="Tipo"><select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">Todos</option>{["reuse","exception","cancel_cycle","cancel_certificate"].map(k=><option key={k} value={k}>{kindLabel(k as Request["kind"])}</option>)}</select></Field>
 <Field label="De"><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Até"><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
 </div><div className="table-wrap"><table><thead><tr><th>Solicitação / registro</th><th>Solicitante / motivo</th><th>Decisão</th><th>Responsável / justificativa</th><th>Datas</th></tr></thead><tbody>
 {filtered.map(r=><tr key={r.id}><td><button className="text-button" onClick={()=>open(r)}>{kindLabel(r.kind)} · #{r.cycle_id??r.loading_id}</button><small>Solicitação #{r.id}{r.edit_version ? " · versão "+r.edit_version : ""}</small></td>
 <td>{r.requester_name||"Não registrado"}<small>{r.reason}</small></td><td><span className={"pill "+(r.decision==="pending"?"amber":r.decision==="rejected"?"red":"")}>{decisionLabel(r.decision)}</span></td>
 <td>{r.actor_name||"—"}{r.actor_role&&<small>{roleLabel(r.actor_role)}</small>}<small>{r.decision_reason||"—"}</small></td><td><small>Solicitada: {date(r.requested_at)}</small><small>Decidida: {date(r.decided_at)}</small></td></tr>)}
 </tbody></table></div>{filtered.length===0&&<p className="empty">Nenhuma autorização neste filtro.</p>}</section>
 {decision&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Decisão de cancelamento"><h2>{decision.approve?"Autorizar cancelamento":"Rejeitar cancelamento"}</h2><p>{decision.r.reason}</p>
 <Field label="Justificativa obrigatória"><textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)}/></Field><div className="actions"><button disabled={busy} onClick={()=>setDecision(null)}>Voltar</button><button className="primary" disabled={busy||reason.trim().length<3} onClick={()=>run(()=>db.rpc("pilot_decide_cancellation",{p_request_id:decision.r.id,p_approve:decision.approve,p_reason:reason}),"Decisão registrada.",()=>setDecision(null))}>Registrar decisão</button></div></section></div>}
 </>;
}
export function UsersManagement({users,actorRole,db,run,busy}:{users:ManagedUser[];actorRole:Role;db:SupabaseClient;run:Run;busy:boolean}) {
 const [query,setQuery]=useState(""),[roleFilter,setRoleFilter]=useState("all"),[statusFilter,setStatusFilter]=useState("all");
 const [selected,setSelected]=useState<ManagedUser|null>(null),[name,setName]=useState(""),[role,setRole]=useState<Role>("Consulta"),[status,setStatus]=useState("Ativo"),[reason,setReason]=useState("");
 const allowedRoles=roles.filter(r=>actorRole==="Administrador"||roleRank(r)<roleRank(actorRole));
 const filtered=users.filter(u=>(roleFilter==="all"||u.role===roleFilter)&&(statusFilter==="all"||u.status===statusFilter)&&[u.name,u.email].join(" ").toLowerCase().includes(query.toLowerCase()));
 function edit(u:ManagedUser){setSelected(u);setName(u.name);setRole(u.role);setStatus(u.status==="Pendente"?"Ativo":u.status);setReason("")}
 return <><div className="heading"><div><h1>Usuários</h1><p>{actorRole==="Administrador"?"Gerencie todos os usuários cadastrados.":"Gerencie somente perfis abaixo do seu."} Consulta acessa laudos de todas as unidades.</p></div></div>
 <section className="card"><div className="filter-bar"><Field label="Buscar usuário"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome ou e-mail…"/></Field>
 <Field label="Perfil"><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">Todos</option>{allowedRoles.map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}</select></Field>
 <Field label="Situação"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">Todas</option>{["Pendente","Ativo","Bloqueado","Rejeitado"].map(s=><option key={s}>{s}</option>)}</select></Field></div>
 <div className="user-list">{filtered.map(u=><div className="user-row" key={u.id}><div><strong>{u.name||"Nome não informado"}</strong><small>{u.email} · {roleLabel(u.role)} · cadastro {date(u.created_at)}</small></div><div className="actions"><span className={"pill "+(u.status==="Pendente"?"amber":u.active?"green":"red")}>{u.status}</span><button onClick={()=>edit(u)}>{u.status==="Pendente"?"Avaliar":"Abrir / editar"}</button></div></div>)}</div>{!filtered.length&&<p className="empty">Nenhum usuário neste filtro.</p>}</section>
 {selected&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Editar usuário"><h2>{selected.status==="Pendente"?"Avaliar acesso":"Editar usuário"}</h2><p>{selected.email}</p>
 <Field label="Nome completo"><input disabled={selected.status==="Pendente"} value={name} onChange={e=>setName(e.target.value)}/></Field>
 <Field label="Perfil"><select value={role} onChange={e=>setRole(e.target.value as Role)}>{allowedRoles.map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}</select></Field>
 <Field label="Situação"><select value={status} onChange={e=>setStatus(e.target.value)}>{(selected.status==="Pendente"?["Ativo","Rejeitado"]:["Ativo","Bloqueado","Rejeitado"]).map(s=><option key={s}>{s}</option>)}</select></Field>
 {role==="Consulta"&&<p className="muted">Consulta de todas as unidades receptoras.</p>}
 <Field label="Motivo da decisão / alteração"><textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)}/></Field><div className="actions"><button disabled={busy} onClick={()=>setSelected(null)}>Voltar</button>
 <button className="primary" disabled={busy||reason.trim().length<3||name.trim().length<3} onClick={()=>run(()=>selected.status==="Pendente"
 ?db.rpc("pilot_decide_profile",{p_user_id:selected.id,p_approve:status==="Ativo",p_role:role,p_destination:null,p_reason:reason})
 :db.rpc("pilot_update_user",{p_id:selected.id,p_name:name,p_role:role,p_status:status,p_reason:reason}),"Usuário atualizado.",()=>setSelected(null))}>Salvar decisão</button></div></section></div>}</>;
}
export type Version={product_id:number;version:number;data:Partial<Product>;author_name:string|null;changed_at:string|null;captured_at:string;provenance:string;changes:{before?:Partial<Product>;after?:Partial<Product>}};
export function ProductList({products,versions,edit,inactivate,busy}:{products:Product[];versions:Version[];edit:(p:Product)=>void;inactivate:(p:Product)=>void;busy:boolean}) {
 const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[selected,setSelected]=useState<number|null>(null);
 const filtered=products.filter(p=>(status==="all"||p.active===(status==="active"))&&[p.code,p.name].join(" ").toLowerCase().includes(query.toLowerCase()));
 const product=products.find(p=>p.id===selected);
 return <section className="product-list"><h3>Produtos cadastrados</h3><div className="filter-bar"><Field label="Buscar produto"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Código ou descrição…"/></Field><Field label="Situação do produto"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></Field></div>
 {filtered.map(p=><div className="history-row" key={p.id}><div><strong>{p.code} · {p.name}</strong><small>{p.family} · v{p.version} · {p.specifications.length} análises · {p.active?"Ativo":"Inativo"}</small></div><div className="actions"><button onClick={()=>setSelected(p.id)}>Detalhes / versões</button><button disabled={busy} onClick={()=>edit(p)}>Editar</button>{p.active&&<button disabled={busy} onClick={()=>inactivate(p)}>Inativar</button>}</div></div>)}
 {!filtered.length&&<p className="empty">Nenhum produto neste filtro.</p>}
 {product&&<div className="modal-backdrop"><section className="modal wide-modal" role="dialog" aria-modal="true" aria-label="Versões do produto"><div className="section-head"><h2>{product.code} · {product.name}</h2><button onClick={()=>setSelected(null)}>Fechar</button></div><p>Alterações geram novas versões. Ciclos de tanques e laudos preservam os dados originais.</p>
 {versions.filter(v=>v.product_id===product.id).sort((a,b)=>b.version-a.version).map(v=><details key={v.version}><summary>Versão {v.version} · {v.provenance==="recorded"?date(v.changed_at)+" · "+(v.author_name||"Não identificado"):"Dados anteriores capturados em "+date(v.captured_at)+"; autoria/data da alteração não registradas"}</summary>
 <p>{v.data.code||"Código não registrado"} · {v.data.name||"Nome não registrado"} · {v.data.active===false?"Inativo":"Ativo"}</p>
 <dl>{v.data.specifications?.map((s,i)=><div key={i}><dt>{s.name} {s.unit}</dt><dd>{specificationText(s)}{s.required?" · obrigatório":""}</dd></div>)}</dl>
 {v.changes.before&&<p className="muted">Campos alterados: {["code","name","family","specifications","active"].filter(k=>JSON.stringify(v.changes.before?.[k as keyof Product])!==JSON.stringify(v.data[k as keyof Product])).join(", ")||"Nova versão sem mudança de valores"}</p>}</details>)}
 </section></div>}</section>;
}
export function CycleHistory({cycles,tanks,products,loadings,requests,db,run,busy,createLoading,closeCycle,canCreate,canClose,canCancel,initialId}:{initialId?:number|null;cycles:Cycle[];tanks:Tank[];products:Product[];loadings:Loading[];requests:Request[];db:SupabaseClient;run:Run;busy:boolean;createLoading:(c:Cycle)=>void;closeCycle:(c:Cycle)=>void;canCreate:boolean;canClose:boolean;canCancel:boolean}) {
 const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[tank,setTank]=useState("all"),[product,setProduct]=useState("all"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[selected,setSelected]=useState<number|null>(null);
 const tankFor=(c:Cycle)=>tanks.find(t=>t.id===c.tank_id);
 const productFor=(c:Cycle)=>c.product_snapshot?.name||products.find(p=>p.id===c.product_id)?.name;
 const filtered=cycles.filter(c=>(status==="all"||c.status===status)&&(tank==="all"||c.tank_id===Number(tank))&&(product==="all"||c.product_id===Number(product))&&(!from||c.manufactured_at.slice(0,10)>=from)&&(!to||c.manufactured_at.slice(0,10)<=to)&&[c.id,c.lots,tankFor(c)?.code,productFor(c)].join(" ").toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{if(initialId)setSelected(initialId)},[initialId]);
 const current=cycles.find(c=>c.id===selected);
 function actions(c:Cycle,compact=false){
 const dependencies=loadings.filter(l=>l.cycle_id===c.id),pending=requests.some(r=>r.cycle_id===c.id&&r.decision==="pending");
 const secondary=<>
 <button type="button" className={compact?"cycle-action icon-button":undefined} aria-label="Consultar" title="Consultar ciclo de tanque" onClick={()=>setSelected(c.id)}>{compact?<Eye size={16} aria-hidden="true"/>:"Consultar"}</button>
 {c.active&&canCancel&&<CancellationButton kind="cancel_cycle" id={c.id} requests={requests} db={db} run={run} busy={busy} disabled={dependencies.length>0} compact={compact}/>}
 </>;
 return <div className={"actions"+(compact?" cycle-card-actions":"")}>
 {c.active&&canCreate&&<button type="button" className={compact?"cycle-action cycle-loading-action":undefined} disabled={busy||pending||!products.find(p=>p.id===c.product_id)?.active} onClick={()=>createLoading(c)}>Novo carregamento</button>}
 {c.active&&canClose&&<button type="button" className={compact?"cycle-action":undefined} disabled={busy||pending} onClick={()=>closeCycle(c)}>Encerrar ciclo</button>}
 {compact?<div className="cycle-secondary-actions">{secondary}</div>:secondary}
 {c.active&&canCancel&&dependencies.length>0&&<small className={compact?"cycle-action-note":undefined}>Cancelamento bloqueado: há carregamentos vinculados.</small>}
 </div>
 }
 return <><section className="card"><div className="filter-bar"><Field label="Buscar Ciclo de tanque"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tanque, lote, produto ou número…"/></Field>
 <Field label="Status"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todos</option>{["Ativo","Encerrado","Cancelado"].map(s=><option key={s}>{s}</option>)}</select></Field>
 <Field label="Tanque"><select value={tank} onChange={e=>setTank(e.target.value)}><option value="all">Todos</option>{tanks.map(t=><option key={t.id} value={t.id}>{t.code}</option>)}</select></Field>
 <Field label="Produto"><select value={product} onChange={e=>setProduct(e.target.value)}><option value="all">Todos</option>{products.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></Field>
 <Field label="Fabricação de"><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="Até"><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field></div></section>
 <div className="card-grid">{filtered.filter(c=>c.active).map(c=><section className="card" key={c.id}><div className="section-head"><h2>{tankFor(c)?.code} · Ciclo de tanque {c.id}</h2><span className="pill green">Ativo</span></div><strong>{productFor(c)}</strong><p className="muted">Lotes {c.lots} · fabricação {date(c.manufactured_at)}</p><p className="muted">Especificação v{c.specification_version} · {c.analyst}</p>{actions(c,true)}</section>)}</div>
 <section className="card"><h2>Ciclos de tanques encerrados</h2><p className="muted">Histórico de encerrados e cancelados.</p><div className="table-wrap"><table><thead><tr><th>Ciclo de tanque</th><th>Produto / lotes</th><th>Fabricação</th><th>Status</th><th>Consulta</th></tr></thead><tbody>{filtered.filter(c=>!c.active).map(c=><tr key={c.id}><td>#{c.id} · {tankFor(c)?.code}</td><td>{productFor(c)}<small>{c.lots} · v{c.specification_version}</small></td><td>{date(c.manufactured_at)}</td><td><span className={"pill "+(c.status==="Cancelado"?"red":"")}>{c.status}</span></td><td><button onClick={()=>setSelected(c.id)}>Consultar</button></td></tr>)}</tbody></table></div>{!filtered.some(c=>!c.active)&&<p className="empty">Nenhum Ciclo de tanque encerrado neste filtro.</p>}</section>
 {current&&<div className="modal-backdrop"><section className="modal wide-modal" role="dialog" aria-modal="true" aria-label="Consultar Ciclo de tanque"><div className="section-head"><h2>Ciclo de tanque #{current.id} · {current.status}</h2><button onClick={()=>setSelected(null)}>Fechar</button></div>
 <p>{tankFor(current)?.code} · {productFor(current)} · v{current.specification_version}</p><p>Lotes {current.lots} · fabricação {date(current.manufactured_at)} · análises: {current.analyst}</p>
 <div className="table-wrap"><table><thead><tr><th>Análise</th><th>Referência</th><th>Especificação</th><th>Situação</th></tr></thead><tbody>{current.specifications.map((s,i)=><tr key={i}><td>{s.name} {s.unit}</td><td>{current.reference_values[i]||"—"}</td><td>{specificationText(s)}</td><td>{analysisResult(s,current.reference_values[i]).label}</td></tr>)}</tbody></table></div>
 <h3>Histórico e vínculos</h3><p>Cadastro: {date(current.created_at)} · encerramento: {date(current.closed_at)}</p>
 {requests.filter(r=>r.cycle_id===current.id).map(r=><p key={r.id}>Solicitado por {r.requester_name||"Não registrado"} · {date(r.requested_at)} · {r.reason}<br/>{decisionLabel(r.decision)} · {r.actor_name||"—"} · {date(r.decided_at)} · {r.decision_reason||"—"}</p>)}
 {loadings.filter(l=>l.cycle_id===current.id).map(l=><p key={l.id}>Carregamento #{l.id} · {l.plate} · {l.destination} · {l.state} · {l.certificate_number||"Sem laudo"}</p>)}
 {actions(current)}</section></div>}</>;
}
// The existing RecentInput is used in the product form, including historical analysis names and units.
export { RecentInput };
