import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), b => b.toString(16).padStart(2, "0")).join("");
const randomNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
const url = Deno.env.get("SUPABASE_URL")!;
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secret, options);
// No request bodies, passwords, codes or Auth responses are ever logged.
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return reply({ message: "Método não permitido." }, 405);
  let nonceHash: string | null = null;
  try {
    if (Number(request.headers.get("content-length") || 0) > 12000) return reply({ message: "Solicitação inválida." }, 400);
    const body = await request.json();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = await admin.rpc("pilot_password_rate_limit", { p_key: await digest(secret + ":" + ip) });
    if (rate.error) return reply({ message: "Serviço de senha indisponível. Tente novamente." }, 503);
    if (!rate.data) return reply({ message: "Muitas tentativas. Aguarde antes de tentar novamente." }, 429);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (body.action === "request_reset") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply({ field: "email", message: "Informe um e-mail válido." }, 400);
      const result = await admin.rpc("pilot_request_password_reset", { p_email: email });
      if (result.error) return reply({ message: "Não foi possível registrar a solicitação. Tente novamente." }, 503);
      return reply({ message: "Se houver uma conta ativa com este e-mail, a solicitação estará em Autorizações. Procure um Supervisor ou Administrador para conferir sua identidade e receber o código pessoalmente." });
    }
    if (body.action !== "reset" && body.action !== "change") return reply({ message: "Solicitação inválida." }, 400);
    if (typeof body.password !== "string" || body.password.length < 6 || body.password.length > 128) return reply({ field: "password", message: "A nova senha deve ter entre 6 e 128 caracteres. As demais regras de segurança do Supabase também serão validadas." }, 400);
    if (body.password !== body.confirmation) return reply({ field: "confirmation", message: "As senhas não coincidem." }, 400);
    let userId: string | null = null;
    let codeHash: string | null = null;
    if (body.action === "change") {
      const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
      if (!token) return reply({ message: "Entre novamente para alterar sua senha." }, 401);
      const identity = await admin.auth.getUser(token);
      if (identity.error || !identity.data.user?.email) return reply({ message: "Sessão inválida. Entre novamente." }, 401);
      const authenticated = createClient(url, anon, { ...options, global: { headers: { Authorization: "Bearer " + token } } });
      const access = await authenticated.rpc("pilot_permissions");
      if (access.error || !access.data?.length) return reply({ message: "Acesso indisponível ou reset autorizado pendente. Use o código entregue pelo responsável." }, 403);
      if (typeof body.current_password !== "string" || !body.current_password) return reply({ field: "current", message: "Informe sua senha atual." }, 400);
      const verifier = createClient(url, anon, options);
      const proof = await verifier.auth.signInWithPassword({ email: identity.data.user.email, password: body.current_password });
      if (proof.error || proof.data.user?.id !== identity.data.user.id) return reply({ field: "current", message: "Senha atual incorreta." }, 400);
      await verifier.auth.signOut({ scope: "local" });
      userId = identity.data.user.id;
    } else {
      const code = typeof body.code === "string" ? body.code.replace(/[\s-]/g, "").toLowerCase() : "";
      if (!email || !/^[a-f0-9]{32}$/.test(code)) return reply({ field: "code", message: "Informe o e-mail e o código de uso único recebido pessoalmente." }, 400);
      codeHash = await digest(code);
    }
    const nonce = randomNonce();
    nonceHash = await digest(nonce);
    const permit = await admin.rpc("pilot_prepare_password_change", { p_user_id: userId, p_email: email, p_code_hash: codeHash, p_nonce_hash: nonceHash });
    if (permit.error || !permit.data?.ok) return reply({ field: body.action === "reset" ? "code" : undefined, message: body.action === "reset" ? "Código inválido, expirado, bloqueado ou já utilizado. Procure o responsável pela autorização." : "Não foi possível autorizar a alteração. Tente novamente." }, 400);
    const changed = await admin.auth.admin.updateUserById(permit.data.user_id, { password: body.password, app_metadata: { laudos_password_permit: nonce } });
    if (changed.error) {
      await admin.rpc("pilot_release_password_permit", { p_nonce_hash: nonceHash });
      const known = changed.error.code === "same_password" ? "A nova senha deve ser diferente da senha atual." : changed.error.code === "weak_password" ? "A nova senha não atende às regras de segurança do Supabase. Escolha uma senha mais forte." : "Não foi possível alterar a senha. Tente novamente; o código ainda não foi consumido.";
      return reply({ field: "password", message: known }, 400);
    }
    return reply({ message: "Senha alterada com sucesso. Entre com sua nova senha.", sign_in_required: true });
  } catch {
    if (nonceHash) await admin.rpc("pilot_release_password_permit", { p_nonce_hash: nonceHash });
    return reply({ message: "Não foi possível concluir a solicitação. Tente novamente." }, 400);
  }
});
