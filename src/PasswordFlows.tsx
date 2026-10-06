import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Mode = "request_reset" | "reset" | "change";
type Reply = { message: string; field?: string; sign_in_required?: boolean };
export function PasswordFlow({ db, initialMode, email: initialEmail = "", mandatory = false, close, done }: {
 db: SupabaseClient; initialMode: Mode; email?: string; mandatory?: boolean; close: () => void; done: (message: string) => void;
}) {
 const [mode,setMode]=useState(initialMode),[email,setEmail]=useState(initialEmail),[current,setCurrent]=useState(""),[code,setCode]=useState(""),[password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
 const [errors,setErrors]=useState<Record<string,string>>({}),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const title=mode==="change"?"Alterar senha":mode==="reset"?"Definir nova senha":"Esqueci minha senha";
 async function submit(e:FormEvent){
  e.preventDefault();if(busy)return;setErrors({});setMessage("");
  const next:Record<string,string>={};
  if(mode!=="change"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))next.email="Informe um e-mail válido.";
  if(mode==="change"&&!current)next.current="Informe sua senha atual.";
  if(mode==="reset"&&!/^[a-f0-9]{32}$/i.test(code.replace(/[\s-]/g,"")))next.code="Informe o código recebido pessoalmente.";
  if(mode!=="request_reset"){
   if(password.length<6||password.length>128)next.password="Use de 6 a 128 caracteres. As demais regras de segurança do Supabase também serão validadas.";
   if(password!==confirmation)next.confirmation="As senhas não coincidem.";
  }
  if(Object.keys(next).length){setErrors(next);return;}
  setBusy(true);
  try{
   const {data:session}=await db.auth.getSession();
   const response=await fetch(import.meta.env.VITE_SUPABASE_URL+"/functions/v1/password-actions",{
    method:"POST",headers:{"Content-Type":"application/json",apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,...(session.session?{Authorization:"Bearer "+session.session.access_token}:{})},
    body:JSON.stringify({action:mode,email:email.trim(),code,password,confirmation,current_password:current})
   });
   const data=await response.json() as Reply;
   if(!response.ok){setErrors({[data.field||"form"]:data.message||"Não foi possível concluir a solicitação."});return;}
   if(mode==="request_reset"){setMessage(data.message);return;}
   setPassword("");setConfirmation("");setCurrent("");setCode("");
   await db.auth.signOut({scope:"local"});done(data.message);
  }catch{setErrors({form:"Serviço de senha indisponível. Tente novamente."});}
  finally{setBusy(false);}
 }
 const input=(name:string,label:string,value:string,change:(s:string)=>void,autoComplete:string,type="password",readOnly=false)=><label className={"field"+(errors[name]?" invalid-field":"")}><span>{label}</span><input aria-label={label} type={type} autoComplete={autoComplete} value={value} readOnly={readOnly} disabled={busy} aria-invalid={!!errors[name]} aria-describedby={errors[name]?"password-error-"+name:undefined} onChange={e=>{change(e.target.value);setErrors(previous=>({...previous,[name]:""}));}}/>{errors[name]&&<small id={"password-error-"+name} className="field-error" role="alert">{errors[name]}</small>}</label>;
 return <section className={mode==="change"?"modal password-dialog":"login-card"} role={mode==="change"?"dialog":undefined} aria-modal={mode==="change"?true:undefined} aria-label={title}>
 {mode!=="change"&&<><img className="brand-logo" src="/dexco-logo.png" alt="Dexco" width={213} height={40}/><small className="eyebrow">Fábricas Químicas - Agudos</small></>}
 <h1>{title}</h1>
 <p>{mode==="request_reset"?"O reset exige aprovação de Supervisor ou Administrador. Nenhum link de redefinição será enviado automaticamente.":mode==="reset"?"Use o código de uso único entregue pessoalmente após a aprovação. Defina sua nova senha para acessar o sistema.":"Salve seus rascunhos antes de continuar. Confirme sua senha atual; após a alteração, você entrará novamente com a nova senha."}</p>
 <form onSubmit={submit} noValidate>
 {mode!=="change"&&input("email","E-mail",email,setEmail,"email","email",mandatory)}
 {mode==="reset"&&input("code","Código autorizado",code,setCode,"one-time-code","text")}
 {mode==="change"&&input("current","Senha atual",current,setCurrent,"current-password")}
 {mode!=="request_reset"&&<>{input("password","Nova senha",password,setPassword,"new-password")}{input("confirmation","Confirmar nova senha",confirmation,setConfirmation,"new-password")}<p className="helper">Mínimo atual: 6 caracteres. Prefira uma senha longa e exclusiva.</p></>}
 {errors.form&&<p role="alert" className="field-error">{errors.form}</p>}
 {message&&<p role="status">{message}</p>}
 <button className="primary" disabled={busy}>{busy?"Aguarde…":mode==="request_reset"?"Solicitar reset":mode==="change"?"Alterar senha":"Salvar nova senha"}</button>
 </form>
 {mode==="request_reset"&&<button className="text-button" disabled={busy} onClick={()=>{setMode("reset");setErrors({});setMessage("");}}>Já tenho um código autorizado</button>}
 <button className="text-button" disabled={busy} onClick={close}>{mandatory?"Sair":"Voltar"}</button>
 </section>;
}
