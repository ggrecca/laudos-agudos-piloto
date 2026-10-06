import { useEffect, useRef } from "react";
import { analysisResult, isPipelineTransfer, resultOrigin } from "./flow";
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
  const certificate = useRef<HTMLElement>(null);
  useEffect(() => {
    const fit = () => {
      const element = certificate.current;
      if (!element || document.body.classList.contains("manual-printing")) return;
      element.style.zoom = "1";
      element.style.removeProperty("--certificate-print-width");
      // Some browsers dispatch beforeprint before applying print media styles.
      // Measure using the existing print rules, so screen paddings do not cause
      // an unnecessary reduction. This temporary sheet does not duplicate CSS.
      const printRules: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSMediaRule && rule.conditionText === "print")
              printRules.push(...Array.from(rule.cssRules, child => child.cssText));
          }
        } catch { /* Cross-origin font sheets have no application print rules. */ }
      }
      const measuringStyles = document.createElement("style");
      measuringStyles.textContent = printRules.join("\n");
      document.head.append(measuringStyles);
      // A4, 10mm margins: 277mm available height, with a small rounding reserve.
      const page = document.createElement("div");
      page.style.cssText = "position:absolute;visibility:hidden;height:277mm;width:0";
      document.body.append(page);
      const available = page.getBoundingClientRect().height - 6;
      page.remove();
      const scale = Math.min(1, available / Math.max(element.scrollHeight, element.getBoundingClientRect().height));
      element.style.zoom = String(scale);
      element.style.setProperty("--certificate-print-width", `${190 / scale}mm`);
      measuringStyles.remove();
    };
    const restore = () => { if (certificate.current) { certificate.current.style.zoom = ""; certificate.current.style.removeProperty("--certificate-print-width"); } };
    window.addEventListener("beforeprint", fit);
    window.addEventListener("afterprint", restore);
    return () => { window.removeEventListener("beforeprint", fit); window.removeEventListener("afterprint", restore); };
  }, []);
  const pipeline = isPipelineTransfer(cycle?.product_snapshot?.family, loading.destination_id);
  const origin = resultOrigin(loading.source, pipeline);
  const rows = cycle?.specifications.map((spec, i) => ({ spec, value: loading.values[i] ?? "", result: analysisResult(spec, loading.values[i]) })) ?? [];
  return <section ref={certificate} className={"card certificate" + (loading.state==="Cancelado"?" cancelled-certificate":"")} aria-label={"Laudo " + loading.certificate_number}>
    {loading.state==="Cancelado"&&<div className="cancelled-banner">CANCELADO</div>}
    <div className="cert-head">
      <div><img src="/dexco-logo.png" alt="Dexco" width={160} /><strong>Fábricas Químicas - Agudos</strong></div>
      <span>Certificado de qualidade</span>
    </div>
    <h2>Laudo {loading.certificate_number}</h2>
    <div className="cert-grid cert-product-row">
      <span>Família<strong>{product?.family || "—"}</strong></span>
      <span>Produto / código<strong>{product?.name || "Não disponível"} · {product?.code || "—"}</strong></span>
    </div>
    <div className="cert-grid">
      <span>Lotes<strong>{cycle?.lots || "—"}</strong></span>
      <span>Fabricação<strong>{date(cycle?.manufactured_at ?? null)}</strong></span>
      <span>Tanque / Ciclo de tanque<strong>{tank?.code || "—"} · Ciclo de tanque {loading.cycle_id}</strong></span>
    </div>
    <div className={"cert-grid" + (pipeline && !loading.carrier && !loading.plate ? " cert-pipeline-row" : "")}>
      {pipeline && !loading.carrier && !loading.plate ? <span>Transferência<strong>Por tubulação</strong></span> : <>
        <span>Transportadora<strong>{loading.carrier || (pipeline ? "Transferência por tubulação" : "Não informada")}</strong></span>
        <span>Placa do veículo / carreta<strong>{loading.plate ? loading.plate + " · " + loading.trailer : pipeline ? "Transferência por tubulação" : "Não informada"}</strong></span>
      </>}
      <span>Unidade / destino<strong>{loading.destination}</strong></span>
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
        <div><dt>{loading.source === "ref" ? "Responsável pelas análises de referência" : pipeline ? "Responsável pelas análises da transferência" : "Responsável pelas análises do caminhão"}</dt>
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
    <footer className="cert-footer"><span>Data de emissão<strong>{date(loading.issued_at)}</strong></span><span>Origem dos resultados<strong>{origin}</strong></span></footer>
  </section>;
}
