import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request, Run, ManagedUser } from "./Management";

export function PasswordResetAuthorizations({requests,users,db,run,busy,actorId,canDecide}:{requests:Request[];users:ManagedUser[];db:SupabaseClient;run:Run;busy:boolean;actorId:string;canDecide:boolean}){
 const [selected,setSelected]=useState<{request:Request;approve:boolean}|null>(null),[reason,setReason]=useState(""),[verified,setVerified]=useState(false);
 const [delivery,setDelivery]=useState<{code:string;expires_at:string;recipient:string}|null>(null);
 const recipient=(r:Request)=>{const email=users.find(u=>u.id===r.password_user_id)?.email;return r.requester_name+(email?" · "+email:"");};
 const pending=requests.filter(r=>r.kind==="reset_password"&&!r.completed_at&&["pending","approved"].includes(r.decision));
 if(!pending.length&&!delivery)return null;
 return <>
 <section className="card"><h2>Reset de senha</h2><p>Confirme pessoalmente a identidade do titular. O código permite que ele escolha sua senha e deve ser entregue somente a ele.</p>
 {pending.map(r=><div className="history-row" key={r.id}><div><strong>{recipient(r)} · solicitação #{r.id}</strong><small>{r.requested_at?new Date(r.requested_at).toLocaleString("pt-BR"):"Data não registrada"}</small><p>{r.decision==="approved"?"Autorizado · aguardando definição da nova senha":"Pendente de aprovação"}</p></div>
 {canDecide&&r.password_user_id!==actorId&&<div className="actions">{r.decision==="pending"&&<button disabled={busy} onClick={()=>{setSelected({request:r,approve:false});setReason("");setVerified(false);}}>Rejeitar reset</button>}<button className="primary" disabled={busy} onClick={()=>{setSelected({request:r,approve:true});setReason("");setVerified(false);}}>{r.decision==="approved"?"Renovar código":"Autorizar reset"}</button></div>}</div>)}
 </section>
 {selected&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Decisão de reset de senha"><h2>{selected.approve?"Autorizar reset de senha":"Rejeitar reset de senha"}</h2><p>{recipient(selected.request)}</p>
 {selected.approve&&<label className="check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> Conferi a identidade do titular e entregarei o código pessoalmente.</label>}
 <label className="field"><span>Justificativa da decisão</span><textarea aria-label="Justificativa da decisão" autoFocus value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <div className="actions"><button disabled={busy} onClick={()=>setSelected(null)}>Voltar</button><button className="primary" disabled={busy||reason.trim().length<3||(selected.approve&&!verified)} onClick={()=>run(()=>db.rpc("pilot_decide_password_reset",{p_id:selected.request.id,p_approve:selected.approve,p_reason:reason}),"Decisão de reset registrada.",data=>{const result=data as {code:string|null;expires_at:string|null};setSelected(null);if(result.code&&result.expires_at)setDelivery({code:result.code,expires_at:result.expires_at,recipient:recipient(selected.request)});})}>Registrar decisão de reset</button></div>
 </section></div>}
 {delivery&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Entrega pessoal do código"><h2>Código de uso único</h2><p><strong>{delivery.recipient}</strong></p><p>Entregue pessoalmente ao titular verificado. Este código não é a senha e aparece apenas agora.</p><p className="reset-delivery-code">{delivery.code.match(/.{1,4}/g)?.join("-")}</p><p>Válido até {new Date(delivery.expires_at).toLocaleString("pt-BR")}. Após a nova senha ser definida, o código será consumido.</p><p>Se precisar renovar o código, confira novamente a identidade. A renovação invalida imediatamente o código anterior.</p><button className="primary" onClick={()=>setDelivery(null)}>Código entregue · fechar</button></section></div>}
 </>;
}
