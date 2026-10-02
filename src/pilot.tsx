import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { RecentInput } from "./RecentInput";
import { OperationalManual } from "./OperationalManual";
import { can, roleLabel, type Role } from "./permissions";
import { AuthorizationHistory, UsersManagement, ProductList, CycleHistory, CancellationButton, SpecificationHint, type Request, type ManagedUser, type Version } from "./Management";
import { inspectAnalyses, loadingValidation, cycleValidation, approvalReasons, authorizationNeeds, effectiveLoadingState, errorMessage, type ValidationIssue } from "./flow";
import { Certificate, type CertificateTrace } from "./Certificate";
import { createClient, type Session } from "@supabase/supabase-js";
import {
  Home,
  CircleHelp,
  Droplets,
  FileCheck2,
  FlaskConical,
  LogOut,
  Plus,
  Pencil,
  ShieldCheck,
  Trash2,
  Truck,
  UsersRound,
  X,
} from "lucide-react";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const db = createClient(url || "https://missing.supabase.co", key || "missing");
type ProfileStatus = "Pendente" | "Ativo" | "Rejeitado" | "Bloqueado";
type Profile = {
  id: string;
  name: string;
  role: Role;
  active: boolean;
  status: ProfileStatus;
  destination: string | null;
};
type PendingProfile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "Pendente";
  destination: string | null;
  created_at: string;
};
export type Spec = {
  name: string;
  unit: string;
  min?: number;
  max?: number;
  required: boolean;
  qual?: string[];
};
export type Product = {
  id: number;
  code: string;
  name: string;
  family: string;
  specifications: Spec[];
  version: number;
  active: boolean;
};
export type Tank = { id: number; code: string; family: string; active: boolean };
export type Cycle = {
  id: number;
  tank_id: number;
  product_id: number;
  specifications: Spec[];
  specification_version: number;
  manufactured_at: string;
  lots: string;
  reference_values: string[];
  analyst: string;
  active: boolean;
  status: "Ativo" | "Encerrado" | "Cancelado";
  product_snapshot: {code:string;name:string;family:string;specifications:Spec[];version:number} | null;
  snapshot_provenance: string;
  created_at: string;
  closed_at: string | null;
};
export type Loading = {
  id: number;
  cycle_id: number;
  plate: string;
  trailer: string;
  carrier: string;
  destination: string;
  destination_id?: string | null;
  analyst: string;
  loaded_at: string;
  values: string[];
  source: "own" | "ref";
  observation: string;
  state: string;
  edit_version: number;
  certificate_number: string | null;
  issued_at: string | null;
};
type Approval = {
  loading_id: number;
  edit_version: number;
  kind: "reuse" | "exception";
  decision: string;
  reason: string;
  decided_at: string;
};
type View =
  | "Início"
  | "Carregamentos"
  | "Autorizações"
  | "Laudos"
  | "Ciclos de tanques"
  | "Cadastros"
  | "Usuários";
const views: { name: View; icon: typeof Truck }[] = [
  { name: "Início", icon: Home },
  { name: "Ciclos de tanques", icon: Droplets },
  { name: "Carregamentos", icon: Truck },
  { name: "Autorizações", icon: ShieldCheck },
  { name: "Laudos", icon: FileCheck2 },
  { name: "Cadastros", icon: FlaskConical },
  { name: "Usuários", icon: UsersRound },
];
const localTime = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const localDateTimeToIso = (value: string) => new Date(value).toISOString();
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";
const emptyLoading = (): Omit<
  Loading,
  "id" | "state" | "edit_version" | "certificate_number" | "issued_at"
> => ({
  cycle_id: 0,
  plate: "",
  trailer: "Única",
  carrier: "",
  destination: "",
  analyst: "",
  loaded_at: localTime(),
  values: [],
  source: "own",
  observation: "",
});
const emptySpec = (): Spec => ({ name: "", unit: "", required: true });


async function fetchAll<T>(page: (from:number,to:number)=>PromiseLike<{data:unknown[]|null;error:{message:string}|null}>) {
 const rows:T[]=[];
 for(let from=0;;from+=1000){
  const result=await page(from,from+999);
  if(result.error)return {data:rows,error:result.error};
  rows.push(...(result.data||[]) as T[]);
  if(!result.data||result.data.length<1000)return {data:rows,error:null};
 }
}
function Field({ label, children, error, fieldKey }: { label: string; children: ReactNode; error?: string; fieldKey?: string }) {
  const errorId = useId();
  const controls = Children.map(children, child => {
    if (!isValidElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string; "aria-label"?: string }>(child)) return child;
    if (child.type !== "input" && child.type !== "select" && child.type !== "textarea" && child.type !== RecentInput) return child;
    return cloneElement(child, { "aria-label": child.props["aria-label"] || label, "aria-invalid": !!error, "aria-describedby": error ? errorId : undefined });
  });
  return <label className={"field" + (error ? " invalid-field" : "")} data-field={fieldKey}>
    <span>{label}</span>{controls}
    {error && <span className="field-error" id={errorId}>{error}</span>}
  </label>;
}
function Pill({ state }: { state: string }) {
  return (
    <span
      className={
        "pill " +
        ((state === "Emitido" || state === "Autorizado para emissão")
          ? "green"
          : state === "Aguardando autorização"
            ? "amber"
            : (state === "Em correção" || state === "Cancelado")
              ? "red"
              : "")
      }
    >
      {state}
    </span>
  );
}
function ErrorNotice({ text }: { text: string }) {
  return text ? (
    <div className="notice" role="alert">
      {text}
    </div>
  ) : null;
}
function ValidationNotice({ errors, focus }: { errors: string[]; focus?: () => void }) {
  return errors.length ? <div className="validation-notice" role="alert">
    <strong>Confira os campos abaixo:</strong>
    <ul>{errors.slice(0, 4).map(error => <li key={error}>{error}</li>)}</ul>
    {errors.length > 4 && <p>Há mais {errors.length - 4} campos para revisar.</p>}
    {focus && <button type="button" className="text-button" onClick={focus}>Ir para o primeiro campo</button>}
  </div> : null;
}
function focusValidation(issues: ValidationIssue[]) {
  if (!issues.length) return;
  window.requestAnimationFrame(() => {
    const field = Array.from(document.querySelectorAll<HTMLElement>("[data-field]")).find(el => el.dataset.field === issues[0].field);
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    field?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus({ preventScroll: true });
  });
}
function FloatingNotice({ text, tone, dismiss }: { text: string; tone: "error" | "success" | "info"; dismiss: () => void }) {
  return text ? <div className={"floating-notice " + tone} role={tone === "error" ? "alert" : "status"}>
    <span>{text}</span><button type="button" aria-label="Fechar mensagem" onClick={dismiss}><X size={18} /></button>
  </div> : null;
}
function AuthorizationReasons({ reasons }: { reasons: string[] }) {
  return reasons.length ? <section className="authorization-reasons" aria-label="Motivos da autorização">
    <strong>Motivos da autorização</strong>
    <ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
  </section> : null;
}
function FlowStep({
  number,
  count,
  title,
  description,
  note,
  children,
}: {
  number: string;
  count: string;
  title: string;
  description: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="flow-card">
      <div className="flow-card-top">
        <span className="flow-number">{number}</span>
        <span className="flow-count">{count}</span>
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {note && <p className="flow-note">{note}</p>}
      <div className="flow-actions">{children}</div>
    </section>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loadings, setLoadings] = useState<Loading[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingProfile[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<{id:string;name:string;active:boolean}[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [cycleToOpen, setCycleToOpen] = useState<number | null>(null);
  const [productEditingId, setProductEditingId] = useState<number | null>(null);
  const [view, setView] = useState<View>("Início");
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"error" | "success" | "info">("info");
  const refreshRequest = useRef(0);
  const [certificateTrace, setCertificateTrace] = useState<CertificateTrace | null>(null);
  const [certificateTraceError, setCertificateTraceError] = useState("");
  const [traceRetry, setTraceRetry] = useState(0);
  const inFlight = useRef(false);
  const ownResults = useRef<string[]>([]);
  const [cycleAttempted, setCycleAttempted] = useState(false);
  const [loadingAttempt, setLoadingAttempt] = useState<"draft" | "request" | "issue" | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [newLoading, setNewLoading] = useState(false);
  const [newCycle, setNewCycle] = useState(false);
  const [query, setQuery] = useState("");
  const [loadingForm, setLoadingForm] = useState(emptyLoading());
  const [cycleForm, setCycleForm] = useState({
    tank_id: 0,
    product_id: 0,
    manufactured_at: localTime(),
    lots: "",
    analyst: "",
    reference_values: [] as string[],
  });
  const [productForm, setProductForm] = useState({
    code: "",
    name: "",
    family: "Resina",
    specifications: [emptySpec()],
  });
  const [tankForm, setTankForm] = useState({ code: "", family: "Resina", active: true });
  const [tankEditingId, setTankEditingId] = useState<number | null>(null);
  const [decision, setDecision] = useState<{
    id: number;
    kind: "reuse" | "exception";
    approve: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = db.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  async function refresh() {
    const request = ++refreshRequest.current;
    const profileResult = await db.from("pilot_profiles").select("*").single();
    if (profileResult.error) throw profileResult.error;
    const nextProfile = profileResult.data as Profile;
    if (request !== refreshRequest.current) return;
    const active = nextProfile.active && nextProfile.status === "Ativo";
    if (!active) {
      setProfile(nextProfile);
      setProducts([]);
      setTanks([]);
      setCycles([]);
      setLoadings([]);
      setApprovals([]);
      setPendingUsers([]);
      return;
    }
    const permissionResult = await db.rpc("pilot_permissions");
    if (permissionResult.error) throw permissionResult.error;
    const nextPermissions = (permissionResult.data || []) as string[];
    const canManage = can(nextPermissions, "users.manage");
    const [
      productsResult,
      tanksResult,
      cyclesResult,
      loadingsResult,
      approvalsResult,
      pendingResult, destinationResult, requestsResult, usersResult, versionsResult,
    ] = await Promise.all([
      fetchAll<Product>((from,to)=>db.from("pilot_products").select("*").order("name").order("id").range(from,to)),
      fetchAll<Tank>((from,to)=>db.from("pilot_tanks").select("*").order("code").range(from,to)),
      fetchAll<Cycle>((from,to)=>db.from("pilot_cycles").select("*").order("id", { ascending: false }).range(from,to)),
      fetchAll<Loading>((from,to)=>db.from("pilot_loadings").select("*").order("id", { ascending: false }).range(from,to)),
      fetchAll<Approval>((from,to)=>db.from("pilot_approvals").select("*").order("id").range(from,to)),
      canManage
        ? fetchAll<PendingProfile>((from,to)=>db.rpc("pilot_list_pending_profiles").range(from,to))
        : Promise.resolve({ data: [], error: null }),
      fetchAll<{id:string;name:string;active:boolean}>((from,to)=>db.from("pilot_destinations").select("*").order("display_order").range(from,to)),
      fetchAll<Request>((from,to)=>db.from("pilot_authorization_requests").select("*").order("id", { ascending:false }).range(from,to)),
      canManage ? fetchAll<ManagedUser>((from,to)=>db.rpc("pilot_list_users").range(from,to)) : Promise.resolve({data:[],error:null}),
      can(nextPermissions,"products.manage") ? fetchAll<Version>((from,to)=>db.from("pilot_product_versions").select("*").order("product_id").order("version").range(from,to)) : Promise.resolve({data:[],error:null}),
    ]);
    for (const result of [
      productsResult,
      tanksResult,
      cyclesResult,
      loadingsResult,
      approvalsResult,
      pendingResult, destinationResult, requestsResult, usersResult, versionsResult,
    ])
      if (result.error) throw result.error;
    if (request !== refreshRequest.current) return;
    setProfile(nextProfile);
    setPermissions(nextPermissions);
    setDestinations(destinationResult.data || []);
    setRequests((requestsResult.data || []) as Request[]);
    setUsers((usersResult.data || []) as ManagedUser[]);
    setVersions((versionsResult.data || []) as Version[]);
    setProducts((productsResult.data || []) as Product[]);
    setTanks((tanksResult.data || []) as Tank[]);
    setCycles((cyclesResult.data || []) as Cycle[]);
    setLoadings((loadingsResult.data || []) as Loading[]);
    setApprovals((approvalsResult.data || []) as Approval[]);
    setPendingUsers((pendingResult.data || []) as PendingProfile[]);
  }
  useEffect(() => {
    if (session) refresh().catch((e) => { setNoticeTone("error"); setNotice(errorMessage(e)); });
    else { setProfile(null); setLoadings([]); setApprovals([]); setCertificateTrace(null); }
    return () => { refreshRequest.current += 1; };
  }, [session?.user.id]);
  useEffect(() => {
    if (!session?.user.id || profile?.status !== "Ativo") return;
    const key = `laudos-agudos:onboarding:v1:${session.user.id}`;
    try {
      setView(window.localStorage.getItem(key) ? "Carregamentos" : "Início");
    } catch {
      setView("Início");
    }
  }, [session?.user.id, profile?.status]);
  const hasAwaitingLoadings = loadings.some(l => l.state === "Aguardando autorização") || requests.some(r=>r.decision==="pending");
  useEffect(() => {
    if (!session?.user.id || profile?.status !== "Ativo") return;
    const update = () => {
      if (document.visibilityState !== "visible" || inFlight.current) return;
      refresh().catch(e => { setNoticeTone("error"); setNotice(errorMessage(e)); });
    };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    const interval = hasAwaitingLoadings ? window.setInterval(update, 20000) : undefined;
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [session?.user.id, profile?.status, hasAwaitingLoadings]);
  const issuedLoading = loadings.find(l => l.id === selected && !!l.certificate_number);
  useEffect(() => {
    let cancelled = false;
    setCertificateTrace(null); setCertificateTraceError("");
    if (!session?.user.id || !issuedLoading) return;
    db.rpc("pilot_certificate_details", { p_id: issuedLoading.id }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setCertificateTraceError(errorMessage(error)); return; }
      setCertificateTrace(data as CertificateTrace);
    }, error => { if (!cancelled) setCertificateTraceError(errorMessage(error)); });
    return () => { cancelled = true; };
  }, [issuedLoading?.id, issuedLoading?.edit_version, issuedLoading?.issued_at, issuedLoading?.state, session?.user.id, traceRetry]);

  async function run(
    task: () => PromiseLike<{ error: { message: string } | null; data?: unknown }>,
    message: string,
    after?: (data: unknown) => void,
  ) {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    refreshRequest.current += 1;
    setBusy(true);
    setNotice("");
    try {
      const result = await task();
      if (result.error) throw result.error;
      await refresh();
      after?.(result.data);
      setNoticeTone("success");
      setNotice(message);
    } catch (e) {
      setNoticeTone("error");
      setNotice(errorMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function login(event: FormEvent<HTMLFormElement>, create = false) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (create) {
        if (fullName.trim().length < 3)
          throw new Error("Informe seu nome completo.");
        if (password !== passwordConfirmation)
          throw new Error("As senhas não coincidem.");
      }
      const result = create
        ? await db.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: fullName.trim() } },
          })
        : await db.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (create) {
        setAuthMode("login");
        setPassword("");
        setPasswordConfirmation("");
        setNotice(
          result.data.session
            ? "Cadastro recebido. Seu acesso ficará aguardando aprovação."
            : "Cadastro recebido. Confirme o e-mail enviado; depois um Supervisor ou Administrador deverá aprovar seu acesso.",
        );
      }
    } catch (e) {
      setNoticeTone("error");
      setNotice(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const internal = can(permissions,"loadings.create");
  const canManageUsers = can(permissions,"users.manage");
  const canApproveReuse = can(permissions,"authorizations.reuse");
  const canApproveException = can(permissions,"authorizations.exception");
  const activeCycles = cycles.filter((c) => c.active);
  const hasActiveProductTankPair = tanks.some(
    (tank) =>
      tank.active &&
      products.some(
        (product) => product.active && product.family === tank.family,
      ),
  );
  const canCreateCycle =
    internal &&
    tanks.some(
      (tank) =>
        tank.active &&
        !activeCycles.some((cycle) => cycle.tank_id === tank.id) &&
        products.some(
          (product) => product.active && product.family === tank.family,
        ),
    );
  const ongoingCount = loadings.filter((l) => !["Emitido","Cancelado"].includes(l.state)).length;
  const issuedCount = loadings.filter((l) => l.state === "Emitido").length;
  const cycleFor = (l: Loading) => cycles.find((c) => c.id === l.cycle_id);
  const productFor = (c?: Cycle) => {
    const product = products.find(p=>p.id===c?.product_id);
    return product && c?.product_snapshot ? {...product,...c.product_snapshot,version:c.specification_version} : product;
  };
  const tankFor = (c?: Cycle) => tanks.find((t) => t.id === c?.tank_id);
  const current = loadings.find((l) => l.id === selected);
  const currentCycle = current && cycleFor(current);
  const needs = (l: Loading) => authorizationNeeds(l, cycleFor(l)?.specifications, approvals);
  const stateFor = (l: Loading) => effectiveLoadingState(l, cycleFor(l)?.specifications, approvals);
  const pending = loadings.filter(
    (l) =>
      l.state === "Aguardando autorização" &&
      (needs(l).reuse || needs(l).exception),
  );
  const filtered = loadings.filter((l) => {
    const term = query.toLowerCase();
    return (
      !term ||
      [
        l.plate,
        l.carrier,
        l.destination,
        l.certificate_number || "",
        String(l.id),
      ].some((v) => v.toLowerCase().includes(term))
    );
  });
  const currentValues = (
    c: Cycle,
    values: string[],
    setter: (v: string[]) => void,
    disabled = false,
  ) => (
    <div className="analysis-list">
      {c.specifications.map((s, i) => (
        <Field
          key={i}
          fieldKey={"analysis-" + i}
          error={loadingError("analysis-" + i)}
          label={`${s.name} ${s.unit ? `(${s.unit})` : ""}${s.required ? " *" : ""}`}
        >
          <RecentInput
            label={s.name}
            disabled={disabled}
            options={recentAnalysisValues(c.product_id, s)}
            value={values[i] ?? ""}
            onChange={(value) => {
              const next = [...values];
              next[i] = value;
              setter(next);
            }}
            placeholder="Resultado"
          />
          <SpecificationHint spec={s}/>
        </Field>
      ))}
    </div>
  );

  function markOnboardingSeen() {
    if (!session?.user.id) return;
    try {
      window.localStorage.setItem(
        `laudos-agudos:onboarding:v1:${session.user.id}`,
        "1",
      );
    } catch {
      // A orientação continua acessível em Início mesmo sem armazenamento local.
    }
  }
  function navigateTo(nextView: View) {
    if (showLoading && !confirmLeaveLoading()) return;
    if (nextView !== "Início") markOnboardingSeen();
    setView(nextView);
    requestAnimationFrame(()=>window.scrollTo({top:0}));
    setCycleToOpen(null);
    setSelected(null);
    setNewLoading(false);
    setNewCycle(false);
    setNotice("");
  }
  function startNewCycle() {
    navigateTo("Ciclos de tanques");
    setNewCycle(true);
    setCycleAttempted(false);
    setCycleForm({
      tank_id: 0,
      product_id: 0,
      manufactured_at: localTime(),
      lots: "",
      analyst: profile?.name || "",
      reference_values: [],
    });
  }

  if (!url || !key)
    return (
      <div className="center">
        <h1>Ambiente não configurado</h1>
        <p>Faltam as variáveis públicas de conexão com o Supabase.</p>
      </div>
    );
  if (!session)
    return (
      <main className="login-layout">
        <section className="login-card">
          <img
            className="brand-logo"
            src="/dexco-logo.png"
            alt="Dexco"
            width={213}
            height={40}
          />
          <small className="eyebrow">Fábricas Químicas - Agudos</small>
          <h1>
            {authMode === "login" ? "Laudos de qualidade" : "Solicitar acesso"}
          </h1>
          <p>
            {authMode === "login"
              ? "Entre para registrar carregamentos, autorizar exceções e consultar certificados."
              : "Informe seus dados. O acesso será liberado somente após análise de um Supervisor ou Administrador."}
          </p>
          <form onSubmit={(e) => login(e, authMode === "signup")}>
            {authMode === "signup" && (
              <Field label="Nome completo">
                <input
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>
            )}
            <Field label="E-mail">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Senha">
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {authMode === "signup" && (
              <Field label="Confirme a senha">
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                />
              </Field>
            )}
            <button disabled={busy} className="primary">
              {authMode === "login" ? "Entrar" : "Enviar solicitação"}
            </button>
          </form>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setAuthMode(authMode === "login" ? "signup" : "login");
              setNotice("");
            }}
          >
            {authMode === "login"
              ? "Ainda não tenho acesso"
              : "Já tenho uma conta"}
          </button>
          <ErrorNotice text={notice} />
          <small>
            {authMode === "login"
              ? "Perfis e permissões são definidos pelo responsável pelo Laudos Agudos."
              : "Após confirmar o e-mail, seu cadastro ficará pendente até a aprovação."}
          </small>
        </section>
      </main>
    );
  if (!profile || !profile.active || profile.status !== "Ativo")
    return (
      <div className="center">
        <h1>
          {profile?.status === "Rejeitado"
            ? "Acesso não aprovado"
            : "Aguardando aprovação"}
        </h1>
        <p>
          {profile?.status === "Rejeitado"
            ? "Sua solicitação não foi aprovada. Entre em contato com o responsável pelo Laudos Agudos."
            : "Seu e-mail foi confirmado. Um Supervisor ou Administrador ainda precisa definir seu perfil de acesso."}
        </p>
        <button onClick={() => db.auth.signOut()}>Sair</button>
        <ErrorNotice text={notice} />
      </div>
    );

  function openLoading(c?: Cycle) {
    setLoadingAttempt(null);
    ownResults.current = [];
    markOnboardingSeen();
    const chosen = c || activeCycles.find(c=>products.find(p=>p.id===c.product_id)?.active);
    setLoadingForm({
      ...emptyLoading(),
      cycle_id: chosen?.id || 0,
      values: chosen?.specifications.map(() => "") || [],
      analyst: profile?.name || "",
    });
    setNewLoading(true);
    setSelected(null);
    setView("Carregamentos");
    requestAnimationFrame(()=>window.scrollTo({top:0}));
    setNotice("");
  }
  function openExisting(l: Loading) {
    setLoadingAttempt(null);
    ownResults.current = l.source === "own" ? [...l.values] : [];
    markOnboardingSeen();
    setView("Carregamentos");
    setNewCycle(false);
    setLoadingForm({
      cycle_id: l.cycle_id,
      plate: l.plate,
      trailer: l.trailer,
      carrier: l.carrier,
      destination: l.destination_id || l.destination,
      analyst: l.analyst,
      loaded_at: localTimeFrom(l.loaded_at),
      values: [...l.values],
      source: l.source,
      observation: l.observation,
    });
    setSelected(l.id);
    requestAnimationFrame(()=>window.scrollTo({top:0}));
    setNewLoading(false);
    setNotice("");
  }
  const editLoading =
    current && ["Rascunho", "Em correção"].includes(current.state) && internal;
  const showLoading = newLoading || !!current;
  const hasUnsavedLoadingChanges =
    !!current &&
    !!editLoading &&
    (loadingForm.plate !== current.plate ||
      loadingForm.trailer !== current.trailer ||
      loadingForm.carrier !== current.carrier ||
      loadingForm.destination !== (current.destination_id || current.destination) ||
      loadingForm.analyst !== current.analyst ||
      loadingForm.loaded_at !== localTimeFrom(current.loaded_at) ||
      JSON.stringify(loadingForm.values) !== JSON.stringify(current.values) ||
      loadingForm.source !== current.source ||
      loadingForm.observation !== current.observation);
  const hasNewLoadingInput =
    newLoading &&
    (!!loadingForm.plate.trim() ||
      !!loadingForm.carrier.trim() ||
      !!loadingForm.destination.trim() ||
      !!loadingForm.observation.trim() ||
      loadingForm.values.some((value) => !!value.trim()));
  function confirmLeaveLoading() {
    if (!hasUnsavedLoadingChanges && !hasNewLoadingInput) return true;
    return window.confirm(
      "Há alterações não salvas neste carregamento. Deseja descartá-las?",
    );
  }
  const selectedFormCycle = cycles.find((c) => c.id === loadingForm.cycle_id);
  const selectedCycleProduct = products.find(
    (p) => p.id === cycleForm.product_id,
  );
  const suggestions = (field: keyof Loading) => [
    ...new Set(loadings.map((l) => String(l[field] || "")).filter(Boolean)),
  ];

  function recentAnalysisValues(productId: number, spec: Spec) {
    const fromCycle = (c: Cycle | undefined, values: string[]) => {
      if (!c || c.product_id !== productId) return [];
      const i = c.specifications.findIndex(s => s.name === spec.name && s.unit === spec.unit);
      return i >= 0 && values[i]?.trim() ? [values[i]] : [];
    };
    return [...new Set([
      ...loadings.flatMap(l => fromCycle(cycleFor(l), l.values)),
      ...cycles.flatMap(c => fromCycle(c, c.reference_values)),
    ])];
  }
  const loadingAnalysis = selectedFormCycle
    ? inspectAnalyses(selectedFormCycle.specifications, loadingForm.values)
    : { errors: [] as string[], exception: false };
  const loadingIssues = loadingValidation(loadingForm, selectedFormCycle?.specifications, loadingAttempt !== "draft");
  const cycleIssues = cycleValidation(cycleForm, selectedCycleProduct?.specifications);
  const loadingError = (field: string) => loadingAttempt ? loadingIssues.find(i => i.field === field)?.message : undefined;
  const cycleError = (field: string) => cycleAttempted ? cycleIssues.find(i => i.field === field)?.message : undefined;
  const loadingReasons = selectedFormCycle ? approvalReasons(selectedFormCycle.specifications, loadingForm.values, loadingForm.source) : [];
  const needsFormApproval = current && !hasUnsavedLoadingChanges
    ? needs(current).reuse || needs(current).exception
    : loadingForm.source === "ref" || loadingAnalysis.exception;
  const traceForCurrent = current && certificateTrace?.loading_id === current.id && certificateTrace.edit_version === current.edit_version ? certificateTrace : null;
  const canPrintCertificate = !!(traceForCurrent && currentCycle && productFor(currentCycle) && tankFor(currentCycle));
  const decisionLoading = decision ? loadings.find(l => l.id === decision.id) : undefined;
  const decisionReasons = decisionLoading ? approvalReasons(cycleFor(decisionLoading)?.specifications ?? [], decisionLoading.values, decisionLoading.source) : [];
  function submitCycle() {
    setCycleAttempted(true);
    if (cycleIssues.length) {
      setNoticeTone("error"); setNotice(cycleIssues[0].message);
      focusValidation(cycleIssues); return;
    }
    run(() => db.rpc("pilot_create_cycle", {
      p_tank_id: cycleForm.tank_id, p_product_id: cycleForm.product_id,
      p_manufactured_at: localDateTimeToIso(cycleForm.manufactured_at),
      p_lots: cycleForm.lots.trim(), p_reference: cycleForm.reference_values,
      p_analyst: cycleForm.analyst.trim(),
    }), "Ciclo de tanque criado.", () => { setNewCycle(false); setCycleAttempted(false); requestAnimationFrame(()=>window.scrollTo({top:0})); });
  }
  function submitLoading(action: "draft" | "request" | "issue") {
    setLoadingAttempt(action);
    const issues = loadingValidation(loadingForm, selectedFormCycle?.specifications, action !== "draft");
    if (issues.length) {
      setNoticeTone("error"); setNotice(issues[0].message);
      focusValidation(issues); return;
    }
    const form = { ...loadingForm, plate: loadingForm.plate.trim().toUpperCase(),
      trailer: loadingForm.trailer.trim(), carrier: loadingForm.carrier.trim(),
      destination: loadingForm.destination.trim(), analyst: loadingForm.analyst.trim(),
      values: loadingForm.source === "ref" ? [...selectedFormCycle!.reference_values] : [...loadingForm.values],
    };
    const message = action === "draft" ? "Rascunho salvo." : action === "request"
      ? "Solicitação enviada. O responsável já pode avaliar." : "Laudo emitido.";
    const unchanged = !!current && !hasUnsavedLoadingChanges && action !== "draft";
    run(() => unchanged
      ? db.rpc(action === "request" ? "pilot_request_approval" : "pilot_issue", { p_id: current!.id })
      : db.rpc("pilot_submit_loading", {
          p_loading: { ...form, loaded_at: localDateTimeToIso(form.loaded_at) },
          p_action: action, p_id: newLoading ? null : current!.id,
        }), message, data => {
      const id = unchanged ? current!.id : Number(data);
      setSelected(id); setNewLoading(false); setLoadingAttempt(null); setLoadingForm(form);
    });
  }

  const analysisSuggestions = [
    ...new Set(
      products.flatMap((product) =>
        product.specifications
          .map((specification) => specification.name.trim())
          .filter(Boolean),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <>
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/dexco-logo.png"
            alt="Dexco"
            width={213}
            height={40}
          />
          <div>
            <strong>Fábricas Químicas - Agudos</strong>
            <small>Laudos de qualidade</small>
          </div>
        </div>
        <nav>
          {views
            .filter(
              (v) =>
                (v.name !== "Cadastros" || can(permissions,"products.manage")) &&
                (v.name !== "Usuários" || canManageUsers),
            )
            .map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.name}
                  aria-label={v.name}
                  className={view === v.name ? "active" : ""}
                  onClick={() => navigateTo(v.name)}
                >
                  <Icon size={18} />
                  {v.name}
                  {v.name === "Autorizações" && pending.length > 0 && (
                    <b>{pending.length}</b>
                  )}
                  {v.name === "Usuários" && pendingUsers.length > 0 && (
                    <b>{pendingUsers.length}</b>
                  )}
                </button>
              );
            })}
          <button type="button" className="help-nav" aria-label="Ajuda" title="Manual operacional" onClick={() => setManualOpen(true)}><CircleHelp size={18} aria-hidden="true" /> Ajuda</button>
        </nav>
        <div className="account">
          <strong>{profile.name || session.user.email}</strong>
          <small>{roleLabel(profile.role)}</small>
          <button onClick={() => db.auth.signOut()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topline">
          <span>
            DEXCO <span className="slash">/</span> FÁBRICAS QUÍMICAS{" "}
            <span className="slash">/</span> AGUDOS
          </span>
          <span>{new Date().toLocaleDateString("pt-BR")}</span>
        </header>
        <FloatingNotice text={notice} tone={noticeTone} dismiss={() => setNotice("")} />
        {view === "Início" ? (
          <>
            <div className="heading home-heading">
              <div>
                <span className="eyebrow">COMECE POR AQUI</span>
                <h1>Do Ciclo de tanque ao laudo</h1>
                <p>
                  Siga estas etapas para registrar uma análise e emitir o
                  certificado de qualidade.
                </p>
              </div>
              <div className="home-header-actions">
                <button type="button" aria-label="Ajuda" title="Manual operacional" onClick={() => setManualOpen(true)}><CircleHelp size={16} aria-hidden="true" /> Ajuda</button>
                <button className="home-skip" onClick={() => navigateTo("Carregamentos")}>Ir direto para carregamentos</button>
              </div>
            </div>
            <section
              className="flow-grid"
              aria-label="Etapas do fluxo de trabalho"
            >
              <FlowStep
                number="01"
                count={`${activeCycles.length} ${activeCycles.length === 1 ? "Ciclo de tanque ativo" : "Ciclos de tanques ativos"}`}
                title="Prepare o Ciclo de tanque"
                description="Selecione tanque e produto e informe fabricação, lotes e valores de referência."
                note={
                  !activeCycles.length
                    ? can(permissions,"products.manage")
                      ? hasActiveProductTankPair
                        ? undefined
                        : "Antes do primeiro Ciclo de tanque, configure produtos e tanques em Cadastros."
                      : "Sem Ciclo de tanque ativo? Peça ao responsável para abrir um Ciclo de tanque."
                    : undefined
                }
              >
                {can(permissions,"products.manage") &&
                !hasActiveProductTankPair ? (
                  <button
                    className="flow-link"
                    onClick={() => navigateTo("Cadastros")}
                  >
                    Configurar produtos e tanques
                  </button>
                ) : (
                  <button
                    className="flow-link"
                    onClick={() =>
                      canCreateCycle
                        ? startNewCycle()
                        : navigateTo("Ciclos de tanques")
                    }
                  >
                    {canCreateCycle ? "Iniciar novo Ciclo de tanque" : "Ver Ciclos de tanques"}
                  </button>
                )}
              </FlowStep>
              <FlowStep
                number="02"
                count={`${ongoingCount} em andamento`}
                title="Registre o carregamento"
                description="Informe os dados do caminhão e os resultados das análises do produto."
                note={
                  internal && !activeCycles.length
                    ? "É necessário haver um Ciclo de tanque ativo para registrar."
                    : undefined
                }
              >
                <button
                  className="flow-link"
                  onClick={() =>
                    internal && activeCycles.length
                      ? openLoading()
                      : navigateTo("Carregamentos")
                  }
                >
                  {internal && activeCycles.length
                    ? "Novo carregamento"
                    : "Ver carregamentos"}
                </button>
              </FlowStep>
              <FlowStep
                number="03"
                count={`${pending.length} pendente${pending.length === 1 ? "" : "s"}`}
                title="Trate as autorizações"
                description="Se uma análise exigir aprovação, o supervisor decide se o carregamento pode seguir."
                note="Esta etapa só se aplica quando houver uma exceção."
              >
                <button
                  className="flow-link"
                  onClick={() => navigateTo("Autorizações")}
                >
                  Ver autorizações
                </button>
              </FlowStep>
              <FlowStep
                number="04"
                count={`${issuedCount} emitido${issuedCount === 1 ? "" : "s"}`}
                title="Emita e consulte o laudo"
                description="Emita o laudo dentro do carregamento, após validar as análises e concluir as autorizações necessárias. Depois, ele ficará disponível para consulta e impressão."
              >
                <button
                  className="flow-link"
                  onClick={() => navigateTo("Laudos")}
                >
                  <FileCheck2 size={16} aria-hidden="true" /> Ver laudos
                </button>
              </FlowStep>
            </section>
          </>
        ) : showLoading && view === "Carregamentos" ? (
          <>
            <div className="heading">
              <div>
                <button
                  className="back"
                  onClick={() => navigateTo("Carregamentos")}
                >
                  ← Carregamentos
                </button>
                <h1>
                  {newLoading
                    ? "Novo carregamento"
                    : `Carregamento ${String(current!.id).padStart(4, "0")}`}
                </h1>
                <p>
                  {newLoading
                    ? "Informe os dados do caminhão e os resultados da análise."
                    : `Ciclo de tanque ${current!.cycle_id} · ${productFor(currentCycle)?.name || ""}`}
                </p>
              </div>
              {current && <Pill state={stateFor(current)} />}
            </div>
            <div className="two-col">
              <section className="card">
                <h2>Identificação e análise</h2>
                {loadingAttempt && <ValidationNotice errors={loadingIssues.map(i => i.message)} focus={() => focusValidation(loadingIssues)} />}
                <div className="form-grid">
                  <Field fieldKey="cycle_id" error={loadingError("cycle_id")} label="Ciclo de tanque">
                    <select
                      disabled={!newLoading}
                      value={loadingForm.cycle_id}
                      onChange={(e) => {
                        const c = cycles.find(
                          (x) => x.id === Number(e.target.value),
                        );
                        ownResults.current = [];
                        setLoadingForm((f) => ({
                          ...f,
                          cycle_id: c?.id || 0,
                          values: f.source === "ref" ? [...(c?.reference_values || [])] : c?.specifications.map(() => "") || [],
                        }));
                      }}
                    >
                      <option value={0}>Selecione</option>
                      {(newLoading ? activeCycles.filter(c=>products.find(p=>p.id===c.product_id)?.active) : cycles).map((c) => (
                        <option key={c.id} value={c.id}>
                          {tankFor(c)?.code} · {productFor(c)?.name} · Ciclo de tanque{" "}
                          {c.id}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field fieldKey="loaded_at" error={loadingError("loaded_at")} label="Data e hora">
                    <input
                      type="datetime-local"
                      disabled={!newLoading && !editLoading}
                      value={loadingForm.loaded_at}
                      onChange={(e) =>
                        setLoadingForm((f) => ({
                          ...f,
                          loaded_at: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field fieldKey="plate" error={loadingError("plate")} label="Placa *">
                    <RecentInput label="Placa" disabled={!newLoading && !editLoading}
                      value={loadingForm.plate} options={suggestions("plate")} placeholder="Digite a placa"
                      onChange={plate => setLoadingForm(f => ({ ...f, plate: plate.toUpperCase() }))} />
                  </Field>
                  <Field fieldKey="trailer" error={loadingError("trailer")} label="Carreta *">
                    <select disabled={!newLoading && !editLoading} value={loadingForm.trailer}
                      onChange={e => setLoadingForm(f => ({ ...f, trailer: e.target.value }))}>
                      {[...new Set(["Única", "1ª carreta", "2ª carreta", ...suggestions("trailer"), loadingForm.trailer])].filter(Boolean)
                        .map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </Field>
                  <Field fieldKey="carrier" error={loadingError("carrier")} label="Transportadora *">
                    <RecentInput label="Transportadora" disabled={!newLoading && !editLoading}
                      value={loadingForm.carrier} options={suggestions("carrier")} placeholder="Digite a transportadora"
                      onChange={carrier => setLoadingForm(f => ({ ...f, carrier }))} />
                  </Field>
                  <Field fieldKey="destination" error={loadingError("destination")} label="Unidade / destino *">
                    <select disabled={!newLoading && !editLoading} value={loadingForm.destination}
                      onChange={e => setLoadingForm(f => ({ ...f, destination: e.target.value }))}>
                      <option value="">Selecione a unidade</option>
                      {loadingForm.destination && !destinations.some(d=>d.id===loadingForm.destination) &&
                        <option value={loadingForm.destination}>{loadingForm.destination} · destino histórico</option>}
                      {destinations.filter(d=>d.active).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field fieldKey="analyst" error={loadingError("analyst")} label="Responsável pela análise *">
                    <RecentInput label="Responsável pela análise" disabled={!newLoading && !editLoading}
                      value={loadingForm.analyst} options={[...suggestions("analyst"), ...cycles.map(c => c.analyst)]}
                      placeholder="Digite o nome" onChange={analyst => setLoadingForm(f => ({ ...f, analyst }))} />
                  </Field>
                  <Field label="Origem dos resultados">
                    <select
                      disabled={!newLoading && !editLoading}
                      value={loadingForm.source}
                      onChange={(e) => {
                        const source = e.target.value as "own" | "ref";
                        if (source === "ref") ownResults.current = [...loadingForm.values];
                        setLoadingForm((f) => ({
                          ...f,
                          source,
                          values:
                            source === "ref"
                              ? [...(selectedFormCycle?.reference_values || [])]
                              : selectedFormCycle?.specifications.map((_, i) => ownResults.current[i] ?? "") || [],
                        }));
                      }}
                    >
                      <option value="own">Análise do caminhão</option>
                      <option value="ref">
                        Referência do tanque (requer autorização)
                      </option>
                    </select>
                  </Field>
                </div>
                {selectedFormCycle && (
                  <>
                    <h3>Resultados</h3>
                    {loadingForm.source === "ref" && <p className="helper">Resultados do Ciclo de tanque selecionado. O uso exige autorização e os valores são preservados.</p>}
                    {currentValues(selectedFormCycle, loadingForm.values, (v) =>
                      setLoadingForm((f) => ({ ...f, values: v })),
                      loadingForm.source === "ref" || (!newLoading && !editLoading),
                    )}
                  </>
                )}
                <Field label="Observações">
                  <RecentInput label="Observações" multiline disabled={!newLoading && !editLoading}
                    value={loadingForm.observation} options={suggestions("observation")}
                    onChange={observation => setLoadingForm(f => ({ ...f, observation }))} />
                </Field>
              </section>
              <aside className="action-column">
                <section className="card">
                  <h2>Próxima ação</h2>
                  {current && <p className="muted">{current.certificate_number ? `Laudo ${current.certificate_number}` : stateFor(current)}</p>}
                  <AuthorizationReasons reasons={loadingReasons} />
                  {loadingAttempt && <ValidationNotice errors={loadingIssues.map(i => i.message)} focus={() => focusValidation(loadingIssues)} />}
                  {(newLoading || editLoading) && (
                    <>
                      <button disabled={busy} onClick={() => submitLoading("draft")}>Salvar rascunho</button>
                      <button className="primary" disabled={busy}
                        onClick={() => submitLoading(needsFormApproval ? "request" : "issue")}>
                        {needsFormApproval ? "Solicitar autorização" : "Emitir laudo"}
                      </button>
                      <p className="helper">
                        {needsFormApproval
                          ? "Salva os dados e envia a solicitação de autorização."
                          : "Salva os dados e emite o laudo após validar as análises."}
                      </p>
                      <p className="helper">O rascunho pode ser salvo com análises ainda não preenchidas.</p>
                    </>
                  )}
                  {current && internal && current.state === "Aguardando autorização" &&
                    !needs(current).invalid && !needs(current).exception && !needs(current).reuse && (
                      <button className="primary" disabled={busy} onClick={() => submitLoading("issue")}>Emitir laudo</button>
                    )}
                  {current && current.state === "Aguardando autorização" && (
                    <p className="muted">
                      {needs(current).exception
                        ? "Aguardando supervisor. "
                        : ""}
                      {needs(current).reuse
                        ? "Aguardando autorização da referência."
                        : ""}
                      {stateFor(current) === "Autorizado para emissão" ? "Autorizações concedidas para esta versão. O laudo já pode ser emitido." : ""}
                    </p>
                  )}
                  {current?.state === "Emitido" && can(permissions,"cancellations.request") && <CancellationButton kind="cancel_certificate" id={current.id} requests={requests} db={db} run={run} busy={busy}/>}
                  {current?.certificate_number && (
                    <button disabled={!canPrintCertificate} onClick={() => window.print()}>
                      Imprimir laudo
                    </button>
                  )}
                  <p className="helper">
                    Após salvar uma alteração, autorizações anteriores deixam de
                    valer para esta versão.
                  </p>
                </section>
              </aside>
            </div>
            {current?.certificate_number && (
              <Certificate loading={current} cycle={currentCycle} product={productFor(currentCycle)} tank={tankFor(currentCycle)}
                cancellation={requests.find(r=>r.loading_id===current.id&&r.kind==="cancel_certificate"&&r.decision==="approved")} trace={traceForCurrent} traceError={certificateTraceError} retry={() => setTraceRetry(n => n + 1)} />
            )}
          </>
        ) : view === "Carregamentos" ? (
          <>
            <div className="heading">
              <div>
                <h1>Carregamentos</h1>
                <p>Registre análises e acompanhe cada laudo até a emissão.</p>
              </div>
              {internal && (
                <button
                  className="primary"
                  disabled={!activeCycles.length}
                  onClick={() => openLoading()}
                >
                  <Plus size={18} /> Novo carregamento
                </button>
              )}
            </div>
            <div className="metrics">
              <div>
                <strong>
                  {loadings.filter((l) => !["Emitido","Cancelado"].includes(l.state)).length}
                </strong>
                <span>Em andamento</span>
              </div>
              <div>
                <strong>{pending.length}</strong>
                <span>Aguardando decisão</span>
              </div>
              <div>
                <strong>
                  {loadings.filter((l) => l.state === "Emitido").length}
                </strong>
                <span>Laudos emitidos</span>
              </div>
            </div>
            {internal && !activeCycles.length && (
              <p className="empty">
                Cadastre um produto, um tanque e um Ciclo de tanque para iniciar.
              </p>
            )}
            <section className="card">
              <div className="section-head">
                <h2>Lista de carregamentos</h2>
                <input
                  aria-label="Buscar carregamentos"
                  placeholder="Buscar placa, transportadora, destino…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <LoadingTable
                rows={filtered}
                cycleFor={cycleFor}
                productFor={productFor}
                stateFor={stateFor}
                open={openExisting}
              />
            </section>
          </>
        ) : view === "Autorizações" ? (
          <>
            <div className="heading">
              <div>
                <h1>Autorizações</h1>
                <p>Pendências para decisão e histórico permanente de autorizações.</p>
              </div>
            </div>
            <section className="card">
              <LoadingTable
                rows={pending}
                cycleFor={cycleFor}
                productFor={productFor}
                stateFor={stateFor}
                open={(l) => {
                  setView("Carregamentos");
                  openExisting(l);
                }}
              />
              {pending.length === 0 && (
                <p className="empty">Nenhuma solicitação pendente.</p>
              )}
            </section>
            {pending.map((l) => (
              <section className="card approval-card" key={l.id}>
                <div>
                  <strong>
                    Carregamento {l.id} · {l.plate}
                  </strong>
                  <p>
                    {productFor(cycleFor(l))?.name} · {l.carrier}
                  </p>
                  <AuthorizationReasons reasons={approvalReasons(cycleFor(l)?.specifications ?? [], l.values, l.source)} />
                </div>
                <div className="actions">
                  {needs(l).reuse &&
                    (canApproveReuse ? (
                      <>
                        <button
                          onClick={() => {
                            setDecision({
                              id: l.id,
                              kind: "reuse",
                              approve: true,
                            });
                            setReason("");
                          }}
                        >
                          Autorizar referência
                        </button>
                        <button
                          onClick={() => {
                            setDecision({
                              id: l.id,
                              kind: "reuse",
                              approve: false,
                            });
                            setReason("");
                          }}
                        >
                          Devolver
                        </button>
                      </>
                    ) : (
                      <span>Referência: operador técnico ou superior</span>
                    ))}
                  {needs(l).exception &&
                    (canApproveException ? (
                      <>
                        <button
                          className="primary"
                          onClick={() => {
                            setDecision({
                              id: l.id,
                              kind: "exception",
                              approve: true,
                            });
                            setReason("");
                          }}
                        >
                          Autorizar exceção
                        </button>
                        <button
                          onClick={() => {
                            setDecision({
                              id: l.id,
                              kind: "exception",
                              approve: false,
                            });
                            setReason("");
                          }}
                        >
                          Rejeitar
                        </button>
                      </>
                    ) : (
                      <span>Exceção: supervisor ou administrador</span>
                    ))}
                </div>
              </section>
            ))}
            <AuthorizationHistory requests={requests} db={db} run={run} busy={busy} canDecide={can(permissions,"cancellations.decide")}
              open={r=>{
                if(r.cycle_id){setCycleToOpen(r.cycle_id);setView("Ciclos de tanques");setSelected(null);}
                else {const l=loadings.find(l=>l.id===r.loading_id);if(l)openExisting(l);}
              }}/>
            {decision && (
              <div className="modal-backdrop">
                <section className="modal">
                  <h2>
                    {decision.approve
                      ? "Confirmar autorização"
                      : "Devolver para correção"}
                  </h2>
                  <p>
                    Carregamento {decision.id} ·{" "}
                    {decision.kind === "exception"
                      ? "resultado fora da especificação"
                      : "referência do tanque"}
                  </p>
                  <AuthorizationReasons reasons={decisionReasons} />
                  <Field label="Justificativa obrigatória">
                    <textarea
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  <div className="actions">
                    <button onClick={() => setDecision(null)}>Cancelar</button>
                    <button
                      className="primary"
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        run(
                          () =>
                            db.rpc("pilot_decide", {
                              p_id: decision.id,
                              p_kind: decision.kind,
                              p_approve: decision.approve,
                              p_reason: reason,
                            }),
                          "Decisão registrada.",
                          () => setDecision(null),
                        )
                      }
                    >
                      Registrar decisão
                    </button>
                  </div>
                </section>
              </div>
            )}
          </>
        ) : view === "Usuários" ? (
          <UsersManagement users={users} actorRole={profile.role} db={db} run={run} busy={busy}/>
        ) : view === "Laudos" ? (
          <>
            <div className="heading">
              <div>
                <h1>Laudos emitidos</h1>
                <p>
                  Consulte os certificados de qualidade por placa, destino ou
                  número.
                </p>
              </div>
            </div>
            <section className="card">
              <div className="section-head">
                <h2>Certificados</h2>
                <input
                  aria-label="Buscar laudos"
                  placeholder="Buscar laudo, placa ou destino…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <LoadingTable
                rows={filtered.filter((l) => !!l.certificate_number)}
                cycleFor={cycleFor}
                productFor={productFor}
                stateFor={stateFor}
                open={(l) => {
                  setView("Carregamentos");
                  openExisting(l);
                }}
              />
            </section>
          </>
        ) : view === "Ciclos de tanques" ? (
          <>
            <div className="heading">
              <div>
                <h1>Ciclos de tanques</h1>
                <p>Acompanhe os Ciclos de tanques ativos e a referência de cada tanque.</p>
              </div>
              {internal && (
                <button
                  className="primary"
                  onClick={() => {
                    setNewCycle(true);
                    setCycleForm({
                      tank_id: 0,
                      product_id: 0,
                      manufactured_at: localTime(),
                      lots: "",
                      analyst: profile.name || "",
                      reference_values: [],
                    });
                  }}
                >
                  <Plus size={18} /> Novo Ciclo de tanque
                </button>
              )}
            </div>
            {newCycle && (
              <section className="card">
                <h2>Novo Ciclo de tanque</h2>
                {cycleAttempted && <ValidationNotice errors={cycleIssues.map(i => i.message)} focus={() => focusValidation(cycleIssues)} />}
                <div className="form-grid">
                  <Field fieldKey="tank_id" error={cycleError("tank_id")} label="Tanque">
                    <select
                      value={cycleForm.tank_id}
                      onChange={(e) =>
                        setCycleForm((f) => ({
                          ...f,
                          tank_id: Number(e.target.value),
                          product_id: 0,
                          reference_values: [],
                        }))
                      }
                    >
                      <option value={0}>Selecione</option>
                      {tanks
                        .filter(
                          (t) =>
                            t.active &&
                            !activeCycles.some((c) => c.tank_id === t.id),
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} · {t.family}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field fieldKey="product_id" error={cycleError("product_id")} label="Produto">
                    <select
                      value={cycleForm.product_id}
                      onChange={(e) => {
                        const p = products.find(
                          (x) => x.id === Number(e.target.value),
                        );
                        setCycleForm((f) => ({
                          ...f,
                          product_id: p?.id || 0,
                          reference_values:
                            p?.specifications.map(() => "") || [],
                        }));
                      }}
                    >
                      <option value={0}>Selecione</option>
                      {products
                        .filter(
                          (p) =>
                            p.active &&
                            p.family ===
                              tanks.find((t) => t.id === cycleForm.tank_id)
                                ?.family,
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · v{p.version}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field fieldKey="manufactured_at" error={cycleError("manufactured_at")} label="Fabricação · data e hora">
                    <input
                      type="datetime-local"
                      value={cycleForm.manufactured_at}
                      onChange={(e) =>
                        setCycleForm((f) => ({
                          ...f,
                          manufactured_at: e.target.value,
                        }))
                      }
                    />
                  </Field>
                  <Field fieldKey="lots" error={cycleError("lots")} label="Lotes *">
                    <RecentInput label="Lotes" value={cycleForm.lots} options={cycles.map(c => c.lots)}
                      onChange={lots => setCycleForm(f => ({ ...f, lots }))} />
                  </Field>
                  <Field fieldKey="analyst" error={cycleError("analyst")} label="Responsável pela análise *">
                    <RecentInput label="Responsável pela análise" value={cycleForm.analyst}
                      options={[...loadings.map(l => l.analyst), ...cycles.map(c => c.analyst)]}
                      onChange={analyst => setCycleForm(f => ({ ...f, analyst }))} />
                  </Field>
                </div>
                {selectedCycleProduct && (
                  <>
                    <h3>Referência do tanque</h3>
                    {selectedCycleProduct.specifications.map((s, i) => (
                      <Field key={i} fieldKey={"reference-" + i} error={cycleError("reference-" + i)} label={`${s.name} ${s.unit}${s.required !== false ? " *" : ""}`}>
                        <RecentInput
                          label={s.name}
                          options={recentAnalysisValues(selectedCycleProduct.id, s)}
                          placeholder="Resultado"
                          value={cycleForm.reference_values[i] || ""}
                          onChange={(value) =>
                            setCycleForm((f) => ({
                              ...f,
                              reference_values: f.reference_values.map(
                                (v, j) => (j === i ? value : v),
                              ),
                            }))
                          }
                        />
                        <SpecificationHint spec={s}/>
                      </Field>
                    ))}
                  </>
                )}
                <div className="actions">
                  <button onClick={() => setNewCycle(false)}>Cancelar</button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={submitCycle}
                  >
                    Criar Ciclo de tanque
                  </button>
                </div>
              </section>
            )}
            <CycleHistory cycles={cycles} tanks={tanks} products={products} loadings={loadings} requests={requests}
              db={db} run={run} busy={busy} initialId={cycleToOpen}
              createLoading={openLoading} closeCycle={c=>{if(window.confirm(`Encerrar o Ciclo de tanque ${c.id}?`)) run(()=>db.rpc("pilot_close_cycle",{p_id:c.id}),"Ciclo de tanque encerrado.");}}
              canCreate={internal} canClose={can(permissions,"cycles.close")} canCancel={can(permissions,"cancellations.request")}/>
          </>
        ) : (
          <>
            <div className="heading">
              <div>
                <h1>Cadastros</h1>
                <p>
                  Configure produtos e tanques antes de registrar Ciclos de tanques.
                </p>
              </div>
            </div>
            <div className="two-col">
              <section className="card">
                <h2>{productEditingId ? "Editar produto · nova versão" : "Produto e especificação"}</h2>
                {products.some(p=>p.id!==productEditingId && p.code.trim().toLowerCase()===productForm.code.trim().toLowerCase()) && <div className="validation-notice" role="alert"><p>Este código já pertence a um produto cadastrado.</p><button onClick={()=>{const existing=products.find(p=>p.code.trim().toLowerCase()===productForm.code.trim().toLowerCase());if(existing){setProductEditingId(existing.id);setProductForm({code:existing.code,name:existing.name,family:existing.family,specifications:existing.specifications.map(s=>({...s}))});}}}>Abrir / editar produto existente</button></div>}

                <div className="form-grid">
                  <Field label="Código">
                    <input
                      value={productForm.code}
                      onChange={(e) =>
                        setProductForm((f) => ({ ...f, code: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Produto">
                    <RecentInput label="Descrição do produto" value={productForm.name} options={products.map(p=>p.name)} onChange={name=>setProductForm(f=>({...f,name}))}/>
                  </Field>
                  <Field label="Família">
                    <select
                      value={productForm.family}
                      onChange={(e) =>
                        setProductForm((f) => ({
                          ...f,
                          family: e.target.value,
                        }))
                      }
                    >
                      <option>Resina</option>
                      <option>Emulsão</option>
                    </select>
                  </Field>
                </div>
                <h3>Análises</h3>
                <p className="helper analysis-helper">
                  Comece a digitar para reutilizar uma análise já cadastrada ou
                  informe um nome novo.
                </p>
                {productForm.specifications.map((s, i) => (
                  <div className="spec-row" key={i}>
                    <RecentInput label="Nome da análise" placeholder="Nome da análise" options={analysisSuggestions} value={s.name}
                      onChange={name=>setProductForm(f=>({...f,specifications:f.specifications.map((x,j)=>j===i?{...x,name}:x)}))}/>
                    <RecentInput label="Unidade" placeholder="Unidade" options={products.flatMap(p=>p.specifications.map(s=>s.unit))} value={s.unit}
                      onChange={unit=>setProductForm(f=>({...f,specifications:f.specifications.map((x,j)=>j===i?{...x,unit}:x)}))}/>
                    <input
                      aria-label="Mínimo"
                      placeholder="Mínimo"
                      type="number"
                      step="any"
                      value={s.min ?? ""}
                      onChange={(e) =>
                        setProductForm((f) => ({
                          ...f,
                          specifications: f.specifications.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  min:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                }
                              : x,
                          ),
                        }))
                      }
                    />
                    <input
                      aria-label="Máximo"
                      placeholder="Máximo"
                      type="number"
                      step="any"
                      value={s.max ?? ""}
                      onChange={(e) =>
                        setProductForm((f) => ({
                          ...f,
                          specifications: f.specifications.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  max:
                                    e.target.value === ""
                                      ? undefined
                                      : Number(e.target.value),
                                }
                              : x,
                          ),
                        }))
                      }
                    />
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={s.required}
                        onChange={(e) =>
                          setProductForm((f) => ({
                            ...f,
                            specifications: f.specifications.map((x, j) =>
                              j === i
                                ? { ...x, required: e.target.checked }
                                : x,
                            ),
                          }))
                        }
                      />{" "}
                      Obrigatória
                    </label>
                    <button
                      type="button"
                      className="remove-analysis"
                      aria-label={`Remover análise ${i + 1}`}
                      disabled={productForm.specifications.length === 1}
                      onClick={() =>
                        setProductForm((f) => ({
                          ...f,
                          specifications: f.specifications.filter(
                            (_, j) => j !== i,
                          ),
                        }))
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <div className="actions">
                  <button
                    onClick={() =>
                      setProductForm((f) => ({
                        ...f,
                        specifications: [...f.specifications, emptySpec()],
                      }))
                    }
                  >
                    Adicionar análise
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          db.rpc("pilot_save_product", {
                            p_code: productForm.code,
                            p_name: productForm.name,
                            p_family: productForm.family,
                            p_specs: productForm.specifications,
                            p_id: productEditingId,
                          }),
                        "Produto salvo.",
                        () => {
                          setProductEditingId(null);
                          setProductForm({
                            code: "",
                            name: "",
                            family: "Resina",
                            specifications: [emptySpec()],
                          });
                        },
                      )
                    }
                  >
                    {productEditingId ? "Salvar nova versão" : "Salvar produto"}
                  </button>
                </div>
                {productEditingId&&<button className="text-button" disabled={busy} onClick={()=>{setProductEditingId(null);setProductForm({code:"",name:"",family:"Resina",specifications:[emptySpec()]});}}>Cancelar edição / novo produto</button>}
                <hr />
                <ProductList products={products} versions={versions} busy={busy}
                  edit={p=>{setProductEditingId(p.id);setProductForm({code:p.code,name:p.name,family:p.family,specifications:p.specifications.map(s=>({...s}))});window.scrollTo({top:0,behavior:"smooth"});}}
                  inactivate={p=>{if(window.confirm(`Inativar ${p.code} · ${p.name}? O histórico será preservado e o produto deixará de aceitar novos registros.`))run(()=>db.rpc("pilot_set_product_active",{p_id:p.id,p_active:false}),"Produto inativado; histórico preservado.");}}/>
              </section>
              <section className="card tank-management">
                <div className="tank-header">
                  <div>
                    <h2>Tanques</h2>
                    <p>Gerencie os cadastros usados para abrir Ciclos de tanques.</p>
                  </div>
                  <span className="tank-count">{tanks.length} cadastrados</span>
                </div>
                <div className="tank-form">
                  <Field label="Código">
                    <input
                      required
                      autoComplete="off"
                      disabled={busy}
                      value={tankForm.code}
                      onChange={(e) =>
                        setTankForm((f) => ({ ...f, code: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Família">
                    <select
                      disabled={busy}
                      value={tankForm.family}
                      onChange={(e) =>
                        setTankForm((f) => ({ ...f, family: e.target.value }))
                      }
                    >
                      <option>Resina</option>
                      <option>Emulsão</option>
                    </select>
                  </Field>
                  {tankEditingId !== null && (
                    <Field label="Situação">
                      <select
                        disabled={busy}
                        value={String(tankForm.active)}
                        onChange={(e) =>
                          setTankForm((f) => ({
                            ...f,
                            active: e.target.value === "true",
                          }))
                        }
                      >
                        <option value="true">Ativo</option>
                        <option value="false">Inativo</option>
                      </select>
                    </Field>
                  )}
                </div>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy || !tankForm.code.trim()}
                    onClick={() => {
                      const code = tankForm.code.trim();
                      if (tankEditingId !== null) {
                        run(
                          () =>
                            db.rpc("pilot_update_tank", {
                              p_id: tankEditingId,
                              p_code: code,
                              p_family: tankForm.family,
                              p_active: tankForm.active,
                            }),
                          "Tanque atualizado.",
                          () => {
                            setTankEditingId(null);
                            setTankForm({
                              code: "",
                              family: "Resina",
                              active: true,
                            });
                          },
                        );
                        return;
                      }
                      run(
                        () =>
                          db.rpc("pilot_save_tank", {
                            p_code: code,
                            p_family: tankForm.family,
                          }),
                        "Tanque cadastrado.",
                        () =>
                          setTankForm({
                            code: "",
                            family: "Resina",
                            active: true,
                          }),
                      );
                    }}
                  >
                    {tankEditingId !== null
                      ? "Salvar alterações"
                      : "Cadastrar tanque"}
                  </button>
                  {tankEditingId !== null && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        setTankEditingId(null);
                        setTankForm({
                          code: "",
                          family: "Resina",
                          active: true,
                        });
                      }}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>
                <hr />
                {tanks.length === 0 ? (
                  <p className="muted">Nenhum tanque cadastrado.</p>
                ) : (
                  <div className="tank-list" aria-label="Tanques cadastrados">
                    {tanks.map((t) => (
                      <div className="tank-row" key={t.id}>
                        <div className="tank-details">
                          <strong>{t.code}</strong>
                          <small>{t.family}</small>
                        </div>
                        <span className={"pill " + (t.active ? "green" : "red")}>
                          {t.active ? "Ativo" : "Inativo"}
                        </span>
                        <div className="actions">
                          <button
                            type="button"
                            className="icon-button"
                            disabled={busy}
                            aria-label={`Editar tanque ${t.code}`}
                            title={`Editar tanque ${t.code}`}
                            onClick={() => {
                              setTankEditingId(t.id);
                              setTankForm({
                                code: t.code,
                                family: t.family,
                                active: t.active,
                              });
                              setNotice("");
                            }}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button danger"
                            disabled={busy}
                            aria-label={`Excluir tanque ${t.code}`}
                            title={`Excluir tanque ${t.code}`}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Excluir o tanque ${t.code}? Tanques com Ciclos de tanques associados não podem ser excluídos.`,
                                )
                              )
                                return;
                              run(
                                () =>
                                  db.rpc("pilot_delete_tank", { p_id: t.id }),
                                "Tanque excluído.",
                                () => {
                                  if (tankEditingId === t.id) {
                                    setTankEditingId(null);
                                    setTankForm({
                                      code: "",
                                      family: "Resina",
                                      active: true,
                                    });
                                  }
                                },
                              );
                            }}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="helper">
                  Para preservar o histórico, tanques com Ciclos de tanques associados só podem ser desativados.
                </p>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
    <OperationalManual open={manualOpen} onClose={() => setManualOpen(false)} role={profile.role} destinations={destinations} />
    </>
  );
}
function localTimeFrom(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function LoadingTable({
  rows,
  cycleFor,
  productFor,
  stateFor,
  open,
}: {
  rows: Loading[];
  cycleFor: (l: Loading) => Cycle | undefined;
  productFor: (c?: Cycle) => Product | undefined;
  stateFor: (l: Loading) => string;
  open: (l: Loading) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Registro</th>
            <th>Placa</th>
            <th>Produto</th>
            <th>Destino</th>
            <th>Data</th>
            <th>Situação</th>
            <th aria-label="Ações"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr
              key={l.id}
              onClick={() => open(l)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  open(l);
                }
              }}
            >
              <td>
                <strong>
                  {l.certificate_number ||
                    `CAR-${String(l.id).padStart(4, "0")}`}
                </strong>
              </td>
              <td>{l.plate}</td>
              <td>{productFor(cycleFor(l))?.name || "—"}</td>
              <td>{l.destination}</td>
              <td>{date(l.loaded_at)}</td>
              <td>
                <Pill state={stateFor(l)} />
              </td>
              <td>
                <button
                  type="button"
                  className="table-action"
                  aria-label={`Abrir carregamento ${l.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    open(l);
                  }}
                >
                  Abrir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="empty">Nenhum registro encontrado.</p>
      )}
    </div>
  );
}
