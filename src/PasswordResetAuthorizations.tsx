import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Request, Run } from "./Management";

export function PasswordResetAuthorizations({requests,db,run,busy,actorId,canDecide}:{requests:Request[];db:SupabaseClient;run:Run;busy:boolean;actorId:string;canDecide:boolean}){
 const [selected,setSelected]=useState<{request:Request;approve:boolean}|null>(null),[reason,setReason]=useState(""),[verified,setVerified]=useState(false);
 const [delivery,setDelivery]=useState<{code:string;expires_at:string}|null>(null);
 const pending=requests.filter(r=>r.kind==="reset_password"&&!r.completed_at&&["pending","approved"].includes(r.decision));
 if(!pending.length&&!delivery)return null;
 return <>
 <section className="card"><h2>Reset de senha</h2><p>Confirme pessoalmente a identidade do titular. O código permite que ele escolha sua senha e deve ser entregue somente a ele.</p>
 {pending.map(r=><div className="history-row" key={r.id}><div><strong>{r.requester_name} · solicitação #{r.id}</strong><small>{r.requested_at?new Date(r.requested_at).toLocaleString("pt-BR"):"Data não registrada"}</small><p>{r.decision==="approved"?"Autorizado · aguardando definição da nova senha":"Pendente de aprovação"}</p></div>
 {canDecide&&r.password_user_id!==actorId&&<div className="actions">{r.decision==="pending"&&<button disabled={busy} onClick={()=>{setSelected({request:r,approve:false});setReason("");setVerified(false);}}>Rejeitar reset</button>}<button className="primary" disabled={busy} onClick={()=>{setSelected({request:r,approve:true});setReason("");setVerified(false);}}>{r.decision==="approved"?"Renovar código expirado / bloqueado":"Autorizar reset"}</button></div>}</div>)}
 </section>
 {selected&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Decisão de reset de senha"><h2>{selected.approve?"Autorizar reset de senha":"Rejeitar reset de senha"}</h2><p>{selected.request.requester_name}</p>
 {selected.approve&&<label className="check"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> Conferi a identidade do titular e entregarei o código pessoalmente.</label>}
 <label className="field"><span>Justificativa da decisão</span><textarea aria-label="Justificativa da decisão" autoFocus value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <div className="actions"><button disabled={busy} onClick={()=>setSelected(null)}>Voltar</button><button className="primary" disabled={busy||reason.trim().length<3||(selected.approve&&!verified)} onClick={()=>run(()=>db.rpc("pilot_decide_password_reset",{p_id:selected.request.id,p_approve:selected.approve,p_reason:reason}),"Decisão de reset registrada.",data=>{const result=data as {code:string|null;expires_at:string|null};setSelected(null);if(result.code&&result.expires_at)setDelivery({code:result.code,expires_at:result.expires_at});})}>Registrar decisão de reset</button></div>
 </section></div>}
 {delivery&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Entrega pessoal do código"><h2>Código de uso único</h2><p>Entregue pessoalmente ao titular verificado. Este código não é a senha e aparece apenas agora.</p><p className="reset-delivery-code">{delivery.code.match(/.{1,4}/g)?.join("-")}</p><p>Válido até {new Date(delivery.expires_at).toLocaleString("pt-BR")}. Após a nova senha ser definida, o código será consumido.</p><p>Se o código expirar ou for bloqueado após 5 tentativas incorretas, confira novamente a identidade antes de renová-lo.</p><button className="primary" onClick={()=>setDelivery(null)}>Código entregue · fechar</button></section></div>}
 </>;
}
