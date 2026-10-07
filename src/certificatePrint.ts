// Rendering only: reuse the official certificate DOM and its existing print CSS.
// No queries, authorization decisions, specification rules or historical data changes.
export const CERTIFICATE_PAGE = { width: 210, height: 297, margin: 10 } as const;

function certificateStyles() {
  const base: string[] = [];
  const print: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; } // Cross-origin font sheets.
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        if (rule.conditionText.includes("print")) print.push(...Array.from(rule.cssRules, child => child.cssText));
      } else {
        base.push(rule.cssText);
      }
    }
  }
  return base.join("\n") + "\n" + print.join("\n");
}

export async function downloadCertificatePdf(element: HTMLElement, number: string) {
  // Load the PDF tools only on demand; login and operational screens retain their bundle.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"), import("jspdf"),
  ]);
  const css = certificateStyles();
  const canvas = await html2canvas(element, {
    scale: 3, backgroundColor: "#ffffff", logging: false, useCORS: true,
    windowWidth: 794, windowHeight: 1123, scrollX: 0, scrollY: 0,
    onclone: async (doc, certificate) => {
      // A private clone contains only the official document. The live screen is untouched.
      doc.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => node.remove());
      const style = doc.createElement("style");
      style.textContent = css + "\nhtml,body {margin:0;padding:0;width:190mm;background:#fff;} .certificate {width:190mm;max-width:none;margin:0;padding:0;zoom:1;transform:none;}";
      doc.head.append(style);
      certificate.style.zoom = "1";
      certificate.style.removeProperty("--certificate-print-width");
      doc.body.className = "";
      doc.body.replaceChildren(certificate);
      await doc.fonts.ready;
      await Promise.all(Array.from(certificate.querySelectorAll("img"), image => image.decode()));
    },
  });
  if (!canvas.width || !canvas.height) throw new Error("Empty certificate");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const width = CERTIFICATE_PAGE.width - CERTIFICATE_PAGE.margin * 2;
  const height = CERTIFICATE_PAGE.height - CERTIFICATE_PAGE.margin * 2;
  const scale = Math.min(width / canvas.width, height / canvas.height);
  // One page, preserving every row and official footer; no browser print templates.
  pdf.addImage(canvas, "PNG", CERTIFICATE_PAGE.margin, CERTIFICATE_PAGE.margin,
    canvas.width * scale, canvas.height * scale, undefined, "FAST");
  pdf.setProperties({ title: "Laudo " + number, creator: "Laudos Agudos" });
  pdf.save("Laudo-" + number.replace(/[^a-zA-Z0-9_-]/g, "-") + ".pdf");
}
