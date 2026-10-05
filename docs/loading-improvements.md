# Laudos Agudos — melhorias de carregamento (05/10/2026)

## Alterações
1. Resumo do tanque e do Ciclo de tanque no formulário de criação/edição de carregamento: produto/tipo, lotes e fabricação; utiliza o snapshot do ciclo.
2. Agudos - MDF1/MDF2/Revestidos: reaproveitamento de referências dispensado de autorização específica. Não conformidades continuam exigindo Supervisor/Administrador. Destinos genéricos não recebem classificação presumida.
3. Resinas: aviso informativo após mais de 120 horas desde a fabricação, usando o instante armazenado; fabricação exibida em America/Sao_Paulo. Ausências/valores inválidos não produzem idade inventada. Não bloqueia emissão.
4. Painéis laterais desktop: sticky com rolagem interna quando excederem a altura disponível; barra mobile preservada.
5. Laudo: faixa de conclusão removida; situações por variável, responsáveis, autorizações, justificativas e CANCELADO preservados.
6. Análises em carregamento/Ciclo de tanque: destaque vermelho imediato e mensagem textual; mesma avaliação de conformidade, tratamento de entradas parciais e preservação do foco.

## Backend e dados
- pilot_destinations: nova coluna reference_reuse_requires_approval, obrigatória e true por padrão; false apenas nos três IDs de Agudos.
- helper privado requires_reuse_authorization; RPCs pilot_request_approval/pilot_issue/pilot_decide reutilizam a regra.
- Matriz de permissões, RLS, acesso anônimo e grants existentes preservados.
- Usuários não podem editar a regra da unidade diretamente.
- Nenhuma alteração de laudos, ciclos, decisões já concluídas ou destinos históricos pela migration.
- Se uma solicitação antiga de reaproveitamento para Agudos ainda estiver pendente, a emissão mantém a solicitação como Substituída, registra motivo e data e preserva solicitante/ID/data original; não é uma aprovação automática.
- Aprovações já concedidas continuam no laudo e no histórico.
- Contagem de idade adotada: tempo decorrido, mais de cinco períodos completos de 24 horas. O critério foi sinalizado durante a execução.

## Arquivos principais
src/pilot.tsx, src/flow.ts, src/style.css, src/Certificate.tsx, src/manual.ts, docs/manual-operacional.md, migration de reaproveitamento, tests/loading-improvements.cjs, tests/verify.cjs, tests/mobile-ui.cjs e workflow de verificação.


## Banco e migration aplicada

- Migration: `supabase/migrations/20261005225810_agudos_reference_reuse.sql`, registrada no Supabase como `agudos_reference_reuse`.
- O SQL aplicado é idêntico ao SQL validado pelo workflow isolado. O nome do arquivo foi alinhado à versão registrada pelo Supabase.
- Tabela alterada: `public.pilot_destinations`; coluna booleana `reference_reuse_requires_approval NOT NULL DEFAULT true`.
- Regra dispensada somente para `agudos-mdf1`, `agudos-mdf2` e `agudos-revestidos`. As demais unidades e destinos desconhecidos continuam exigindo autorização de reaproveitamento.
- Função privada criada: `pilot_private.requires_reuse_authorization(text,text)`, sem execução para `anon` ou `authenticated`.
- RPCs atualizadas: `pilot_request_approval`, `pilot_issue` e `pilot_decide`; assinaturas, validação central de permissões e acesso autenticado preservados. Execução anônima negada.
- RLS permanece habilitada; nenhuma policy foi removida ou ampliada. Matriz de permissões existente preservada.
- Nenhum novo índice necessário: a consulta da regra utiliza a chave primária já existente de destinos.
- Nenhuma exclusão de dados, alteração de laudo histórico ou conversão de destino genérico.
- Advisor de segurança antes/depois: os mesmos 20 avisos de RPCs SECURITY DEFINER autenticadas e o aviso preexistente de proteção contra senhas vazadas. Nenhum novo aviso.

## Compatibilidade e preservação dos dados

As contagens e os hashes abaixo permaneceram idênticos imediatamente antes/depois da migration. Não foram criados registros operacionais de teste em produção.

| Tabela | Registros | Hash MD5 antes/depois |
| --- | ---: | --- |
| pilot_cycles | 5 | 41fedf1a32af859cc7a0b15e174e4dfd |
| pilot_loadings | 7 | 21aa92a961a76c69113e612af67793e4 |
| pilot_products | 3 | b526e2c0a95b0a41200e80202d5e28fd |
| pilot_profiles | 6 | 0f3618ccde22422f3989d91f95d6fece |
| pilot_approvals | 4 | 0e8de75ec1d67c7b6f334dd928aa6847 |
| pilot_product_versions | 5 | 0de73193dbc5812e02149d8cb5133e2e |
| pilot_authorization_requests | 5 | 6e7aa886b373dfdeac61932db77edb58 |

Não foi necessário migrar registros operacionais. Destinos antigos sem setor definido, como Uberaba, continuam com a informação original; não foram atribuídos arbitrariamente a MDF, MDP ou Revestidos.

Solicitações anteriores para Agudos continuam armazenadas. Ao emitir um laudo elegível, uma solicitação pendente de reaproveitamento daquela versão passa a Substituída com motivo/data, preservando ID, solicitante e solicitação original. Decisões já concluídas permanecem intactas.

## Permissões mantidas

A dispensa de reaproveitamento depende da unidade, não de privilégio novo do usuário. Todos os bloqueios críticos continuam no banco.

| Ação | Administrador | Supervisor | Operador Técnico | Operador | Consulta |
| --- | --- | --- | --- | --- | --- |
| Consultar laudos emitidos/cancelados de todas as unidades | Sim | Sim | Sim | Sim | Sim |
| Criar Ciclos de tanques e carregamentos; editar rascunhos/correções; emitir | Sim | Sim | Sim | Sim | Não |
| Solicitar autorização/cancelamento; consultar autorizações | Sim | Sim | Sim | Sim | Não |
| Encerrar Ciclo de tanque; decidir cancelamento | Sim | Sim | Sim | Não | Não |
| Autorizar reaproveitamento quando exigido | Sim | Sim | Sim | Não | Não |
| Autorizar resultado fora da especificação | Sim | Sim | Não | Não | Não |
| Administrar usuários | Todos | Somente perfis inferiores | Não | Não | Não |
| Gerenciar produtos e tanques | Sim | Não | Não | Não | Não |

Consulta continua com acesso aos registros permitidos pelo RLS, incluindo laudos emitidos/cancelados de todas as unidades; não recebe acesso a rascunhos nem poderes operacionais. Cancelar continua sendo uma solicitação sujeita a decisão, nunca exclusão ou edição silenciosa de laudo emitido.

## Testes funcionais e regressão

Workflow isolado aprovado: https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37385366236  
Commit validado: `a70ab9496cd74ebde14e625e4818a343fa33fffa`.

Build TypeScript/Vite passou localmente, inclusive com configuração de conexão de teste para incluir a aplicação completa no bundle. Build de preview Vercel também passou. Os testes usam Supabase descartável, autenticação real, chamadas RPC/RLS e Chromium; não usam o banco de produção.

| Grupo efetivamente executado | Resultado |
| --- | --- |
| Auth: login real nos cinco perfis | Passou |
| Matriz central de permissões nos cinco perfis | Passou |
| Migração: destino genérico Uberaba preservado e Consulta global | Passou |
| Migração: autorizações antigas concluídas/pendentes preservadas e fluxo legado continua funcionando | Passou |
| Produto: criação, unicidade normalizada e bloqueio no backend | Passou |
| Ciclo de tanque: validação obrigatória, criação e snapshot | Passou |
| Ciclo: cancelamento autorizado, tentativa sem permissão, histórico e encerramento | Passou |
| Todas as onze unidades: seleção, identificação estável e texto armazenado | Passou |
| Dependências: encerramento com pendências e cancelamento com vínculos bloqueados | Passou |
| Laudo: emissão normal e proibição de edição por RPC/chamada direta | Passou |
| Uso de análises do tanque: solicitação, Operador Técnico, emissão e rastreabilidade | Passou |
| Exceção: autorização restrita, rejeição, correção, aprovação e histórico permanente | Passou |
| Cancelamento de laudo: rejeição/aprovação, original consultável, nova emissão correta | Passou |
| Produtos: versões completas, inativação, bloqueio de novos usos e histórico imutável | Passou |
| Usuários: lista hierárquica, edição, aprovação Consulta global e bloqueio de acesso direto/escalada | Passou |
| RLS: Consulta global sem rascunhos, ações bloqueadas e auditoria antes/depois | Passou |
| Navegador: card final, ajuda inicial, sumário, busca sem acento, download completo e impressão | Passou |
| Navegador: login/navegação, Ciclo de tanque, limites compartilhados e erro obrigatório visível | Passou |
| Navegador: carregamento, erro localizado, unidade estruturada, rascunho e emissão real | Passou |
| Navegador: laudo sem perfil do emissor/versão da especificação, carregamento só com data, emissão com horário e histórico encerrado sem botão redundante | Passou |
| Navegador: consulta de Ciclo cancelado, solicitação de referência, aprovação, estado sincronizado, emissão e cancelamento autorizado | Passou |
| Navegador: duplicidade direciona ao produto, autocomplete, edição gera versão, usuários e histórico | Passou |
| Orientação: limites inclusivos, vírgula decimal, entrada parcial, qualitativos, informativos e idade em 120 horas/fuso/ausência | Passou |
| Agudos: três unidades emitem referências sem aprovação; chamada direta, troca de destino, destino externo, dados ausentes e referências divergentes protegidos | Passou |
| Agudos: exceção mantém Supervisor, Operador Técnico bloqueado e solicitação anterior preservada como substituída na emissão | Passou |
| Navegador: resumo histórico, troca de tanque, aviso não bloqueante, destaque imediato/foco, destino/origem, sticky 1280/1440/1920 e laudo/PDF sem faixa | Passou |
| Navegador: mesma regra de destaque no Ciclo de tanque/mobile, resumo/aviso legíveis e barra mobile preservada | Passou |
| Mobile real: login, menu/conta/saída, consulta de ciclo, toque no autocomplete, erro visível, rascunho, emissão, solicitação/aprovação, ajuda e retorno ao desktop | Passou |
| Navegador: Consulta global, laudo CANCELADO consultável, desktop 1280/1440/1920 e console sem erros | Passou |

## Verificação visual

- Desktop: 1280, 1440 e 1920 px. Sete telas principais, formulário de carregamento, laudo e manual comparados ao commit de produção anterior.
- Comparação exata de pixels após normalizar somente mudanças solicitadas: novo resumo, remoção da faixa, data do manual e sticky/rolagem interna dos painéis. Dimensões originais dos painéis conferidas antes da normalização.
- Painel de tanques testado com lista longa; painel de ações testado em tela de menor altura, conteúdo alto e navegação por teclado. Sticky permanece limitado ao contêiner, conforme o comportamento normal do CSS.
- Mobile: 320, 375, 390, 430, 768 e 900 px, com telas, diálogo de ciclo, formulário, toque em autocomplete, laudo e manual sem transbordamento horizontal.
- Fluxos mobile reais: login, navegação, erro visível, rascunho, emissão, autorização, ajuda e retorno ao desktop passaram.
- Capturas de orientação, laudo, manual e PDF revisadas. Faixa global removida; situações por variável, responsáveis, rastreabilidade e CANCELADO preservados.
- Console sem erros nos fluxos testados.

## Publicação

Migration aplicada e código integrado em main sem force push. Vercel confirmou produção READY no commit funcional `552af4f902917b50e31ee7186c6ac9fec32d8084`.

Aplicação publicada: https://laudos-agudos-piloto.vercel.app/

Workflow final de main aprovado: https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37385823698

O workflow final repetiu os 29 grupos funcionais, as comparações desktop em três larguras e os testes mobile em seis larguras. O smoke test público passou: HTTP 200, título oficial, formulário de login, formulário de solicitação de acesso, desktop 1280/1440/1920 e console sem erros, sem login nem escrita em produção.

## Conclusão e acompanhamento

As seis melhorias desta entrega estão concluídas e verificadas. Não há pendência funcional conhecida deste pedido nem regressão conhecida nos fluxos testados.

- Critério de idade adotado: mais de 120 horas desde o instante de fabricação. É um aviso informativo, sem bloqueio e sem autorização adicional.
- A revisão de segurança não introduziu novos avisos. As RPCs SECURITY DEFINER são intencionais e validam permissões internamente; chamadas não autorizadas foram testadas. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Proteção contra senhas vazadas permanece uma configuração preexistente de Auth para acompanhamento, fora desta alteração: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Testes operacionais ocorreram no ambiente isolado. Em produção, a verificação é de schema, permissões, preservação dos dados e acesso público, sem inventar carregamentos/laudos.
