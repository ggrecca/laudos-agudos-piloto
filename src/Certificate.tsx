import { analysisResult } from "./flow";
import type { Loading, Cycle, Product, Tank } from "./pilot";

type Identity = { name: string; role: string | null; identity_source: "snapshot" | "profile" | "unavailable" };
export type CertificateTrace = {
  loading_id: number;
  edit_version: number;
  issuer: Identity;
  approvals: (Identity & { kind: "reuse" | "exception"; reason: string; decided_at: string })[];
};
const date = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";
export function Certificate({ loading, cycle, product, tank, trace, traceError, retry }: {
  loading: Loading; cycle: Cycle | undefined; product: Product | undefined; tank: Tank | undefined;
  trace: CertificateTrace | null; traceError: string; retry: () => void;
}) {
  const rows = cycle?.specifications.map((spec, i) => ({ spec, value: loading.values[i] ?? "", result: analysisResult(spec, loading.values[i]) })) ?? [];
  const deviations = rows.filter(row => row.result.status === "nonconforming");
  const incomplete = !rows.length || rows.some(row => ["missing", "invalid"].includes(row.result.status));
  const exceptional = trace?.approvals.some(a => a.kind === "exception");
  const legacy = trace && (trace.issuer.identity_source === "profile" || trace.approvals.some(a => a.identity_source === "profile"));
  return <section className="card certificate" aria-label={"Laudo " + loading.certificate_number}>
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
      <span>Especificação<strong>Versão {cycle?.specification_version ?? "—"}</strong></span>
      <span>Tanque / ciclo<strong>{tank?.code || "—"} · ciclo {loading.cycle_id}</strong></span>
      <span>Lotes<strong>{cycle?.lots || "—"}</strong></span>
      <span>Fabricação<strong>{date(cycle?.manufactured_at ?? null)}</strong></span>
      <span>Placa / carreta<strong>{loading.plate} · {loading.trailer}</strong></span>
      <span>Unidade / destino<strong>{loading.destination}</strong></span>
      <span>Transportadora<strong>{loading.carrier}</strong></span>
      <span>Carregamento<strong>{date(loading.loaded_at)}</strong></span>
      <span>Emissão<strong>{date(loading.issued_at)}</strong></span>
      <span>Origem dos resultados<strong>{loading.source === "ref" ? "Análises de referência do ciclo" : "Análises do caminhão"}</strong></span>
    </div>
    <h3>Resultados e situação por variável</h3>
    <div className="table-wrap">
      <table>
        <thead><tr><th>Análise</th><th>Unidade</th><th>Resultado</th><th>Especificação</th><th>Situação</th></tr></thead>
        <tbody>{rows.map(({ spec, value, result }, i) => <tr key={i}>
          <td>{spec.name}</td><td>{spec.unit || "—"}</td><td>{value.trim() || "—"}</td><td>{result.expected}</td>
          <td><span className={"result-state " + result.status}>{result.label}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    <section className="cert-responsibles">
      <h3>Responsáveis</h3>
      <dl>
        <div><dt>{loading.source === "ref" ? "Responsável pelas análises de referência" : "Responsável pelas análises do caminhão"}</dt>
          <dd>{loading.source === "ref" ? cycle?.analyst || "Não informado" : loading.analyst}</dd></div>
        {loading.source === "ref" && <div><dt>Responsável informado no carregamento</dt><dd>{loading.analyst}</dd></div>}
        <div><dt>Emissão do laudo</dt><dd>{trace ? trace.issuer.name + (trace.issuer.role ? " · " + trace.issuer.role : "") : "Identificação pendente de consulta"}</dd></div>
      </dl>
    </section>
    <section className="cert-authorizations">
      <h3>Autorizações desta versão</h3>
      {trace ? trace.approvals.length ? trace.approvals.map((a, i) => <div className="cert-authorization" key={i}>
        <strong>{a.kind === "exception" ? "Liberação em caráter de exceção" : "Autorização de uso das análises do ciclo"}</strong>
        <p>{a.name}{a.role ? " · " + a.role : ""} · {date(a.decided_at)}</p>
        <p><b>Justificativa:</b> {a.reason}</p>
      </div>) : <p>Não houve autorização excepcional ou uso de referência nesta versão.</p>
        : <p role={traceError ? "alert" : "status"}>{traceError || "Carregando identificação e autorizações…"}
          {traceError && <button className="no-print" onClick={retry}>Tentar novamente</button>}</p>}
      {deviations.length > 0 && <p className="cert-exception-note">A autorização permite a emissão e mantém os resultados fora da especificação identificados como não conformes.</p>}
      {legacy && <p className="cert-legacy-note">Em registros anteriores a esta atualização, a identificação dos responsáveis foi consultada no cadastro atual.</p>}
    </section>
    <section className="cert-observations"><h3>Observações</h3><p>{loading.observation.trim() || "Sem observações adicionais."}</p></section>
    <footer className="cert-footer">Registro CAR-{String(loading.id).padStart(4, "0")} · Ciclo {loading.cycle_id} · Versão dos dados {loading.edit_version}</footer>
  </section>;
}
