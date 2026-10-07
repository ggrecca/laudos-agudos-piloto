# Laudos Agudos — login, abertura e impressão

Correções incrementais de 07/10/2026. Frontend e impressão; nenhum schema, dado histórico, RPC, Edge Function, policy/RLS ou permissão foi alterado.

## Mudanças

- Login: recuperação em bloco próprio, seguida pela mensagem original de perfis/permissões em outra linha. CSS explícito de bloco e espaçamento em todas as larguras.
- Inicialização: Início permanece o estado inicial do App. Removida a leitura do marcador antigo de onboarding que direcionava quem já tinha visto a orientação para Carregamentos. O efeito depende apenas da identidade autenticada, sem depender do status do perfil, consultas ou refresh. Novo acesso/login inicia em Início; navegação e atualizações durante a visita preservam a tela.
- Impressão nativa: A4 com margem de página zero; espaçamento de 10 mm pertence ao layout do certificado. Não há faixas/elementos brancos para ocultar cabeçalhos. Conteúdo externo ao certificado segue escondido pelas regras existentes. O ajuste à página e os dados oficiais são preservados.
- PDF controlado: ação Baixar PDF no mesmo contexto do laudo, desktop e mobile, sujeita ao mesmo estado de disponibilidade da impressão. Reutiliza uma cópia do DOM e o CSS de impressão do Certificate; não consulta nem interpreta novamente produtos, análises, versões, origem ou autorizações. O aplicativo gera um PDF A4 com uma única página contendo somente esse certificado.
- Exportação local: não há envio a outro serviço, consulta privilegiada, upload ou alteração do histórico. Bibliotecas jsPDF 4.2.1 e html2canvas 1.4.1 com carregamento sob demanda. Resoluções das 135 dependências anteriores preservadas; configuração do pnpm permite apenas o build necessário do esbuild e desativa o script informativo de core-js.
- Manual operacional: orientação sobre Baixar PDF, impressão nativa e configuração real de cabeçalhos/rodapés.

## Arquivos

- src/pilot.tsx
- src/style.css
- src/Certificate.tsx
- src/certificatePrint.ts (novo)
- src/manual.ts, docs/manual-operacional.md
- package.json, pnpm-lock.yaml, pnpm-workspace.yaml (novo)
- tests/login-home-print.cjs (novo)
- tests/verify.cjs, tests/mobile-ui.cjs, tests/production-smoke.cjs
- .github/workflows/verify.yml
- docs/login-home-print-report.md

A workflow temporária usada para resolver dependências foi removida antes da entrega; não integra a configuração final.

## Impressão: garantia e limites reais

Baixar PDF gera o próprio documento final; portanto título da página, URL, data automática e número automático não são inseridos no certificado. O arquivo pode ser aberto e impresso pelo leitor de PDF.

Imprimir laudo continua oferecendo a caixa nativa. O CSS elimina o espaço reservado aos cabeçalhos/rodapés em Chromium, validado com a opção de cabeçalhos/rodapés habilitada. Outros navegadores/drivers podem impor configurações próprias; quando isso ocorrer, use o PDF controlado ou desative Cabeçalhos e rodapés. A aplicação não altera preferências do navegador e não promete fazê-lo.

O PDF controlado preserva a apresentação através de uma imagem de alta resolução do documento. O texto dessa nova alternativa não é selecionável/pesquisável; o fluxo nativo existente permanece disponível para PDF textual. Conteúdo extremo exige redução proporcional para caber em uma página; a impressão física e outros motores de navegador precisam de conferência manual.

## Banco, segurança e preservação

Sem migration. Nenhuma chamada de escrita em produção para validação. Mantidos Supabase Auth, reset autorizado, mudança de senha, perfis, RLS, emissão/cancelamento, versões e snapshots históricos, família+destino para tubulação, origens e campos do certificado.

## Testes e build

Validação completa pré-publicação: [GitHub Actions 37652859220](https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37652859220), resultado SUCCESS.

- 38 grupos de fluxos passaram em Chromium + Supabase Auth/Edge/PostgreSQL/RLS reais em ambiente isolado, sem vínculo com produção.
- Login: mensagem abaixo da recuperação, separação mínima verificada a 320, 375, 430, 768, 900, 1280, 1440 e 1920 px; sem overflow.
- Início: login, três reaberturas a partir de Carregamentos/Autorizações/Cadastros, marcador antigo de onboarding e abertura de outra aba com sessão existente. Navegação, refresh de dados/foco e evento de refresh da sessão permanecem na tela atual.
- Impressão nativa: PDFs com a configuração de headers ativa e desativa têm o mesmo texto, comprovando ausência de título, URL, data automática e numeração; rodapé oficial preservado, uma página. Verificação com Poppler.
- PDF controlado: downloads reais no navegador, A4 e uma página com 9, 30 e 60 análises; download mobile sem ação duplicada; certificado na tela não é alterado pela exportação. PDFs renderizados com Poppler e conferidos visualmente; nove análises estão legíveis, todas as 60 e o rodapé permanecem no caso extremo.
- Regressão: 36 grupos anteriores preservados, incluindo autenticação/perfis, produtos/versionamento, unidades, ciclos, carregamentos/rascunhos/emissão, referências, exceções/cancelamentos, usuários, Consulta global, RLS, auditoria, reset autorizado, mudança de senha e tubulação.
- Desktop: comparação exata de pixels em sete telas a 1280/1440/1920, normalizando somente alterações solicitadas. Mobile: 320/375/390/430/768/900 px e fluxos reais de operação.
- Sem erros inesperados nos testes de navegador. Rejeições intencionais de segurança são resultados esperados.
- `pnpm install --frozen-lockfile` e `pnpm build` (TypeScript + Vite): aprovados em CI.
- [Validação de main 37653494782](https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37653494782): SUCCESS, incluindo os 38 grupos, regressão desktop/mobile e smoke somente de leitura de produção (HTTP 200, título oficial, login, recuperação/código/cadastro, oito larguras na separação das mensagens e console sem erros).

A execução local deixou de responder durante a preparação das dependências. Builds/testes finais foram executados em CI reproduzível; não se declara execução local de testes que não ocorreu.

## Publicação

Aplicação: https://laudos-agudos-piloto.vercel.app/

Vercel: produção, READY; fonte funcional validada `2f653a8ce330258d34b29778d8571c91cf3eb1a4`. A implantação de produção `dpl_4QWGBurhJYx2HCk7vMbiwGxLdt42` foi conferida nesse commit. O relatório e o manual são integrados em commit posterior somente de documentação; o código funcional permanece idêntico.

Nenhum fluxo de escrita foi executado contra produção para testes. Impressora física, outros navegadores/leitores e legibilidade de conteúdo fora do volume normal ainda exigem conferência manual.
