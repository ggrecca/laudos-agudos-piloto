export type AnalysisSpec = { name: string; required?: boolean; min?: number; max?: number; qual?: string[] };
export function inspectAnalyses(specifications: AnalysisSpec[], values: string[], complete = true): { errors: string[]; exception: boolean } {
  const errors: string[] = [];
  let exception = false;
  if (!specifications.length) errors.push("O produto não possui análises configuradas.");
  specifications.forEach((spec, i) => {
    const value = String(values[i] ?? "").trim();
    if (!value) {
      if (complete && spec.required !== false) errors.push("Preencha a análise obrigatória: " + spec.name + ".");
      return;
    }
    if (spec.qual) {
      if (!spec.qual.includes(value)) exception = true;
      return;
    }
    const normalized = value.replace(",", ".");
    const number = Number(normalized);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized) || !Number.isFinite(number)) {
      errors.push("Informe um resultado numérico válido para " + spec.name + ".");
      return;
    }
    if ((spec.min != null && number < spec.min) || (spec.max != null && number > spec.max)) exception = true;
  });
  return { errors, exception };
}
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  if (typeof error === "string") return error;
  return "Não foi possível concluir a operação. Tente novamente.";
}
