export type AnalysisSpec = { name: string; unit?: string; required?: boolean; min?: number; max?: number; qual?: string[] };
export type AnalysisResult = { status: "conforming" | "nonconforming" | "missing" | "invalid" | "optional" | "informative"; label: string; expected: string; error?: string; reason?: string };
export type ValidationIssue = { field: string; message: string };
type LoadingInput = { cycle_id: number; loaded_at: string; plate: string; trailer: string; carrier: string; destination: string; analyst: string; values: string[]; productFamily?: string };
type CycleInput = { tank_id: number; product_id: number; manufactured_at: string; lots: string; analyst: string; reference_values: string[] };
type ApprovalRecord = { loading_id: number; edit_version: number; kind: "reuse" | "exception"; decision: string };
type LoadingRecord = { id: number; state: string; edit_version: number; source: string; values: string[]; destination_id?: string | null };
export type Destination = { id: string; name: string; active: boolean; reference_reuse_requires_approval?: boolean };
export function isPipelineTransfer(family: string | undefined, destinationId: string | null | undefined): boolean {
  return family === "Resina" && destinationId === "agudos-mdf2";
}
export function requiresReferenceApproval(destinationId: string | null | undefined, destinations: Destination[]): boolean {
  return destinations.find(d => d.id === destinationId)?.reference_reuse_requires_approval !== false;
}
// Do not classify unfinished input as a deviation while the operator is typing.
export function liveAnalysisResult(spec: AnalysisSpec, raw: string | undefined): AnalysisResult | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (spec.qual) {
    if (!spec.qual.includes(value) && spec.qual.some(allowed => allowed.startsWith(value))) return null;
  } else if (/[.,]$/.test(value) || /e[+-]?$/i.test(value) || /^[+-]$/.test(value)) return null;
  const result = analysisResult(spec, value);
  return result.status === "invalid" ? null : result;
}
export function resinAge(manufacturedAt: string | null | undefined, family: string | undefined, now = Date.now()): { days: number; overFiveDays: boolean } | null {
  if (family !== "Resina" || !manufacturedAt) return null;
  const manufactured = Date.parse(manufacturedAt);
  if (!Number.isFinite(manufactured) || manufactured > now) return null;
  const elapsedDays = (now - manufactured) / 86400000;
  return { days: Math.floor(elapsedDays), overFiveDays: elapsedDays > 5 };
}
export function specificationText(spec: AnalysisSpec): string {
  if (spec.qual) return spec.qual.join(" / ");
  const limits = [spec.min != null ? "≥ " + spec.min : "", spec.max != null ? "≤ " + spec.max : ""].filter(Boolean);
  return limits.join(" · ") || "Informativo";
}
export function analysisResult(spec: AnalysisSpec, raw: string | undefined): AnalysisResult {
  const value = String(raw ?? "").trim();
  const unit = spec.unit ? " " + spec.unit : "";
  const expected = specificationText(spec);
  if (!value) return spec.required !== false
    ? { status: "missing", label: "Não preenchido", expected, error: "Preencha a análise obrigatória: " + spec.name + "." }
    : { status: "optional", label: "Não analisado (opcional)", expected };
  if (spec.qual) return spec.qual.includes(value)
    ? { status: "conforming", label: "Conforme", expected }
    : { status: "nonconforming", label: "Não conforme", expected, reason: spec.name + ": resultado “" + value + "”; esperado: " + expected + "." };
  const normalized = value.replace(",", ".");
  const number = Number(normalized);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized) || !Number.isFinite(number))
    return { status: "invalid", label: "Resultado inválido", expected, error: "Informe um resultado numérico válido para " + spec.name + "." };
  if (spec.min != null && number < spec.min)
    return { status: "nonconforming", label: "Não conforme", expected, reason: spec.name + ": resultado " + value + unit + " abaixo do mínimo de " + spec.min + unit + "." };
  if (spec.max != null && number > spec.max)
    return { status: "nonconforming", label: "Não conforme", expected, reason: spec.name + ": resultado " + value + unit + " acima do máximo de " + spec.max + unit + "." };
  return spec.min == null && spec.max == null
    ? { status: "informative", label: "Informativo", expected }
    : { status: "conforming", label: "Conforme", expected };
}
export function inspectAnalyses(specifications: AnalysisSpec[], values: string[], complete = true): { errors: string[]; issues: { index: number; message: string }[]; exception: boolean } {
  const issues: { index: number; message: string }[] = [];
  if (!specifications.length) issues.push({ index: -1, message: "O produto não possui análises configuradas." });
  let exception = false;
  specifications.forEach((spec, index) => {
    const result = analysisResult(spec, values[index]);
    if (result.status === "nonconforming") exception = true;
    if (result.error && (complete || result.status !== "missing")) issues.push({ index, message: result.error });
  });
  return { errors: issues.map(i => i.message), issues, exception };
}
export function loadingValidation(form: LoadingInput, specifications: AnalysisSpec[] | undefined, complete = true): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!form.cycle_id || !specifications) issues.push({ field: "cycle_id", message: "Selecione um ciclo." });
  if (!form.loaded_at || !Number.isFinite(Date.parse(form.loaded_at))) issues.push({ field: "loaded_at", message: "Informe a data e hora do carregamento." });
  const pipeline = isPipelineTransfer(form.productFamily, form.destination);
  if ((!pipeline || form.plate.trim()) && form.plate.trim().length < 7) issues.push({ field: "plate", message: "Informe uma placa válida (mínimo de 7 caracteres)." });
  if (!pipeline && !form.carrier.trim()) issues.push({ field: "carrier", message: "Informe a transportadora." });
  const required = { trailer: "Selecione a carreta.", destination: "Selecione a unidade.", analyst: "Informe o responsável pela análise." };
  Object.entries(required).forEach(([field, message]) => {
    if (!String(form[field as keyof typeof required] ?? "").trim()) issues.push({ field, message });
  });
  if (specifications) inspectAnalyses(specifications, form.values, complete).issues.forEach(i => issues.push({ field: i.index < 0 ? "cycle_id" : "analysis-" + i.index, message: i.message }));
  return issues;
}
export function cycleValidation(form: CycleInput, specifications: AnalysisSpec[] | undefined): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!form.tank_id) issues.push({ field: "tank_id", message: "Selecione um tanque." });
  if (!form.product_id || !specifications) issues.push({ field: "product_id", message: "Selecione um produto." });
  if (!form.manufactured_at || !Number.isFinite(Date.parse(form.manufactured_at))) issues.push({ field: "manufactured_at", message: "Informe a data e hora de fabricação." });
  if (!form.lots.trim()) issues.push({ field: "lots", message: "Informe os lotes." });
  if (!form.analyst.trim()) issues.push({ field: "analyst", message: "Informe o responsável pela análise." });
  if (specifications) inspectAnalyses(specifications, form.reference_values).issues.forEach(i => issues.push({ field: i.index < 0 ? "product_id" : "reference-" + i.index, message: i.message }));
  return issues;
}
export function approvalReasons(specifications: AnalysisSpec[], values: string[], source: string, reuseRequired = true): string[] {
  const reasons = source === "ref" && reuseRequired
    ? ["Uso das análises de referência do Ciclo de tanque em vez de análises do caminhão. Requer autorização de Operador Técnico, Supervisor ou Administrador."] : [];
  const deviations = specifications.map((spec, i) => analysisResult(spec, values[i])).filter(r => r.status === "nonconforming");
  reasons.push(...deviations.map(r => r.reason!));
  if (deviations.length) reasons.push("Resultados fora da especificação exigem liberação em caráter de exceção por Supervisor ou Administrador.");
  return reasons;
}
export function authorizationNeeds(loading: LoadingRecord, specifications: AnalysisSpec[] | undefined, approvals: ApprovalRecord[], destinations: Destination[] = []): { invalid: boolean; exception: boolean; reuse: boolean } {
  const analysis = specifications ? inspectAnalyses(specifications, loading.values) : null;
  const granted = (kind: "reuse" | "exception") => approvals.some(a => a.loading_id === loading.id && a.edit_version === loading.edit_version && a.kind === kind && a.decision === "approved");
  return {
    invalid: !analysis || analysis.errors.length > 0,
    exception: !!analysis?.exception && !granted("exception"),
    reuse: loading.source === "ref" && requiresReferenceApproval(loading.destination_id, destinations) && !granted("reuse"),
  };
}
export function effectiveLoadingState(loading: LoadingRecord, specifications: AnalysisSpec[] | undefined, approvals: ApprovalRecord[], destinations: Destination[] = []): string {
  if (loading.state !== "Aguardando autorização") return loading.state;
  const needed = authorizationNeeds(loading, specifications, approvals, destinations);
  return !needed.invalid && !needed.exception && !needed.reuse ? "Autorizado para emissão" : loading.state;
}
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const code = "code" in error ? error.code : undefined;
    if (code === "42501") return "Seu perfil não tem permissão para esta ação.";
    if (code === "23505") return "Já existe um registro com esta identificação. Abra o cadastro existente.";
    if (code === "23503") return "O registro tem vínculos que precisam ser preservados.";
    if (typeof code === "string" && /^(22|23|42|PGRST)/.test(code)) return "Não foi possível concluir a operação. Revise os dados ou entre em contato com o responsável.";
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  if (typeof error === "string") return error;
  return "Não foi possível concluir a operação. Tente novamente.";
}
