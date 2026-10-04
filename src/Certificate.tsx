import { analysisResult } from "./flow";
import { roleLabel } from "./permissions";
import type { Request } from "./Management";
import type { Loading, Cycle, Product, Tank } from "./pilot";

type Identity = { name: string; role: string | null; identity_source: "snapshot" | "profile" | "account" | "unavailable" };
export type CertificateTrace = {
  loading_id: number;
  edit_version: number;
  issuer: Identity;
  approvals: (Identity & { kind: "reuse" | "exception"; reason: string; decided_at: string })[];
};
const date = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
export function Certificate({ loading, cycle, product, tank, trace, traceError, retry, cancellation }: {
  loading: Loading; cycle: Cycle | undefined; product: Product | undefined; tank: Tank | undefined;
  trace: CertificateTrace | null; traceError: string; retry: () => void; cancellation?: Request;
}) {
  const rows = cycle?.specifications.map((spec, i) => ({ spec, value: loading.values[i] ?? "", result: analysisResult(spec, loading.values[i]) })) ?? [];
  const deviations = rows.filter(row => row.result.status === "nonconforming");
  const incomplete = !rows.length || rows.some(row => ["missing", "invalid"].includes(row.result.status));
  const exceptional = trace?.approvals.some(a => a.kind === "exception");
  return <section className={"card certificate" + (loading.state==="Cancelado"?" cancelled-certificate":"")} aria-label={"Laudo " + loading.certificate_number}>
    {loading.state==="Cancelado"&&<div className="cancelled-banner">CANCELADO</div>}
    <div className="cert-head">
      <div><img src="/dexco-logo.png" alt="Dexco" width={160} /><strong>Fábricas Químicas - Agudos</strong></div>
      <span>Certificado de qualidade</span>
    </div>
    <h2>Laudo {loading.certificate_number}</h2>
    <p className={"cert-conclusion " + (deviations.length || incomplete ? "exception" : "conforming")}>
      {incomplete ? "Resultados incompletos: verificar o registro."
        : deviations.length ? "Produto com resultados não conformes" + (exceptional ? " — emissão autorizada em caráter de exceção." : ".")
        : rows.some(row => row.result.status === "conforming") ? "Resultados conformes às especificações avaliadas." : "Resultados informativos, sem limites de conformidade definidos."}
    </p>
    <div className="cert-grid">
      <span>Produto / código<strong>{product?.name || "Não disponível"} · {product?.code || "—"}</strong></span>
      <span>Família<strong>{product?.family || "—"}</strong></span>
      <span>Tanque / Ciclo de tanque<strong>{tank?.code || "—"} · Ciclo de tanque {loading.cycle_id}</strong></span>
      <span>Lotes<strong>{cycle?.lots || "—"}</strong></span>
      <span>Fabricação<strong>{date(cycle?.manufactured_at ?? null)}</strong></span>
      <span>Placa / carreta<strong>{loading.plate} · {loading.trailer}</strong></span>
      <span>Unidade / destino<strong>{loading.destination}</strong></span>
      <span>Transportadora<strong>{loading.carrier}</strong></span>
      <span>Carregamento<strong>{new Date(loading.loaded_at).toLocaleDateString("pt-BR")}</strong></span>
      <span>Emissão<strong>{date(loading.issued_at)}</strong></span>
      <span>Origem dos resultados<strong>{loading.source === "ref" ? "Análises de referência do Ciclo de tanque" : "Análises do caminhão"}</strong></span>
    </div>
    <h3>Resultados e situação por variável</h3>
    <div className="table-wrap">
      <table className="mobile-record-table analysis-record-table">
        <thead><tr><th>Análise</th><th>Unidade</th><th>Resultado</th><th>Especificação</th><th>Situação</th></tr></thead>
        <tbody>{rows.map(({ spec, value, result }, i) => <tr key={i}>
          <td data-label="Análise">{spec.name}</td><td data-label="Unidade">{spec.unit || "—"}</td><td data-label="Resultado">{value.trim() || "—"}</td><td data-label="Especificação">{result.expected}</td>
          <td data-label="Situação"><span className={"result-state " + result.status}>{result.label}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    <section className="cert-responsibles">
      <h3>Responsáveis</h3>
      <dl>
        <div><dt>{loading.source === "ref" ? "Responsável pelas análises de referência" : "Responsável pelas análises do caminhão"}</dt>
          <dd>{loading.source === "ref" ? cycle?.analyst || "Não informado" : loading.analyst}</dd></div>
        {loading.source === "ref" && <div><dt>Responsável informado no carregamento</dt><dd>{loading.analyst}</dd></div>}
        <div><dt>Emissão do laudo</dt><dd>{trace ? trace.issuer.name : "Identificação pendente de consulta"}</dd></div>
      </dl>
    </section>
    <section className="cert-authorizations">
      {trace ? trace.approvals.length ? trace.approvals.map((a, i) => <div className="cert-authorization" key={i}>
        <p><b>{a.kind === "exception" ? "Exceção autorizada por:" : "Uso das análises do Ciclo de tanque autorizado por:"}</b> {a.name}{a.role ? " · " + roleLabel(a.role) : ""} · {date(a.decided_at)}</p>
        <p><b>Justificativa:</b> {a.reason}</p>
      </div>) : null
        : <p role={traceError ? "alert" : "status"}>{traceError || "Carregando identificação e autorizações…"}
          {traceError && <button className="no-print" onClick={retry}>Tentar novamente</button>}</p>}
    </section>
    {cancellation&&<section className="cert-cancellation"><h3>Registro do cancelamento</h3><p>Solicitado por {cancellation.requester_name||"Não registrado"} · {date(cancellation.requested_at)}</p><p>Motivo: {cancellation.reason}</p><p>Autorizado por {cancellation.actor_name||"Não registrado"} · {date(cancellation.decided_at)}</p><p>Justificativa: {cancellation.decision_reason}</p></section>}
    <section className="cert-observations"><h3>Observações</h3><p>{loading.observation.trim() || "Sem observações adicionais."}</p></section>
    <footer className="cert-footer">Registro CAR-{String(loading.id).padStart(4, "0")} · Ciclo de tanque {loading.cycle_id} · Versão dos dados {loading.edit_version}</footer>
  </section>;
}
