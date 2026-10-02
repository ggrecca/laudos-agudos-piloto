# Laudos Agudos — relatório de evolução

## Implementado

| Requisito | Implementação / evidência |
|---|---|
| 1. Levantamento antes de alterar | Revisados React/Vite, Supabase Auth, tabelas, FKs, índices, funções, RLS e dependências entre produtos, tanques, Ciclos de tanque, carregamentos, laudos, usuários e autorizações. Produção não foi usada para gerar dados de teste. |
| 2. Nome oficial | Login, orientação, metadados, textos e README usam Laudos Agudos. IDs técnicos, nome do repositório e URL foram preservados. |
| 3. Ciclo de tanque | Menu, títulos, formulários, mensagens, orientação, filtros, consulta e laudo usam a nomenclatura. Estruturas internas estáveis foram mantidas. |
| 4. Unidades receptoras | Onze registros em pilot_destinations, ID estável, seleção alimentada pelo banco, FK no carregamento e texto histórico preservado. Laudo/consultas usam o destino gravado. |
| 5. Consulta global | Removida exigência de unidade na aprovação/edição; RLS e certificate_details permitem laudos de todas as unidades. Coluna antiga do perfil preservada sem participação na autorização. |
| 6. Hierarquia e matriz | Matriz em pilot_private.permissions; RPC pilot_permissions para UX; assert_permission no backend. Operador A é o identificador técnico preservado, exibido como Operador. |
| 7. Usuários | Listagem de pendentes e cadastrados, busca por nome/e-mail, perfil/status, abertura/edição. Supervisor vê e administra somente perfis inferiores; RPC protege acesso direto. |
| 8. Referências + especificações | SpecificationHint e specificationText compartilhados entre formulário de Ciclo de tanque e carregamento, usando as mesmas especificações e validação existentes. |
| 9. Ativos / encerrados | Cards para ativos e tabela compacta para encerrados/cancelados. |
| 10. Consulta por status | Detalhes de Ciclos de tanque ativos, encerrados e cancelados, análises/referências/especificações, autorizações e carregamentos relacionados. Ações condicionadas ao estado/permissão. |
| 11. Cancelamento de Ciclo de tanque | Solicitação com motivo e aprovação de Operador Técnico ou superior, sem exclusão. Bloqueado quando houver qualquer carregamento vinculado, conforme decisão de Gustavo. Travas de linha e nova verificação na decisão evitam inconsistência. |
| 12. Cancelamento de laudo | Solicitação/aprovação, motivo e responsáveis permanentes. Original identificado CANCELADO, consultável/imprimível. RPC e trigger impedem edição de emitidos/cancelados; correção exige novo registro. |
| 13. Autorizações | Pendências e histórico separado, decisões permanentes, tipo/objeto/versão, solicitante/motivo, decisor/justificativa e datas. Links abrem o objeto. Rejeição/edição registra pendências substituídas. |
| 14. Produtos | Lista com busca e situação, detalhes/especificações/versões, edição e inativação. |
| 15. Versionamento | Cada edição/inativação cria versão com dados, autor, data e antes/depois. Ciclos de tanque vinculados à versão e snapshot do produto; laudos antigos não consultam metadados mutáveis para sua identificação. |
| 16. Exclusão de produtos | Inativação lógica consistente; nada é apagado. Históricos permanecem e novos Ciclos de tanque/carregamentos com produto inativo são bloqueados. |
| 17. Código duplicado | UNIQUE existente mantido e índice UNIQUE lower(btrim(code)) adicionado. Frontend identifica duplicidade e oferece abrir/editar o existente. Backend impede corrida/duplicidade. |
| 18. Autocomplete | RecentInput reaproveitado para descrição do produto, nomes de análises e unidades. Código único e limites numéricos não recebem sugestões. |
| 19. Filtros | Ciclos: busca/status/tanque/produto/período. Autorizações: pessoas/referência/motivo, decisão/tipo/período. Produtos: código/nome/situação. Usuários: nome/e-mail/perfil/status. Leituras paginadas evitam truncamento a 1.000 registros. |
| 20. Auditoria | Antes/depois e ator/data para produtos, Ciclos de tanque, carregamentos e autorizações; versões identificam alterações; edição de usuário e decisões de acesso registradas no audit/profile_audit. |
| 21. Integridade | Histórico preservado, laudo emitido imutável, códigos únicos no banco, cancelamento separado de exclusão, autorizações permanentes e dependências verificadas. |
| 22. UX | Identidade Dexco preservada; histórico secundário, estados legíveis, especificação junto ao resultado, mensagens visíveis, navegação ao topo e ações de contexto. |
| 23. Migrations | Migration aditiva reproduzida em banco local descartável, com constraints, índices, FKs, RLS e privilégios revisados. |
| 24. Compatibilidade | Destinos ambíguos sem conversão; especificações anteriores preservadas; snapshots legados identificados como captura, sem inventar autoria/data. Autorizações anteriores reconstruídas apenas com evidência gravada. |
| 25. Segurança | Supabase Auth, RLS e RPCs verificados com perfis reais e chamadas diretas. Supervisor não edita pares/superiores nem promove usuários para esses perfis. Usuário não altera seu próprio perfil/status; último Administrador ativo é preservado. |
| 26. Testes obrigatórios | Resultado detalhado abaixo, com login/Auth/RPC/RLS e navegador reais em Supabase descartável. |
| 27. Regressão | Login, orientação/navegação, carregamentos, emissão, análise própria/referência, autorizações antigas, consultas, encerramento, sugestões e desktop verificados. |
| 28. Qualidade técnica | Componentes/validações existentes reutilizados, build TypeScript estrito, sem dependência nova no bundle de produção, erros técnicos traduzidos e permissões centralizadas. |
| 29. Critério de conclusão | Verificações e publicação registradas abaixo; nenhuma emissão de teste feita no banco industrial. |
| 30. Entrega | Este relatório, matriz de permissões, arquivos, banco, migração, evidências e limitações. |
| 31. Princípios | Evolução incremental: banco aditivo, histórico imutável, segurança do lado confiável e regras existentes preservadas onde não foram alteradas. |

## Arquivos

- src/pilot.tsx: integração da matriz/destinos, formulários, navegação, ações e leitura paginada.
- src/Management.tsx: produtos/versões, usuários, histórico de Ciclos de tanque, autorizações e cancelamentos.
- src/permissions.ts: tipos/nomes da hierarquia e consulta às permissões fornecidas pelo banco.
- src/Certificate.tsx: nomenclatura, identificação CANCELADO e rastreabilidade do cancelamento.
- src/flow.ts: nomenclatura e mensagens de erro compreensíveis.
- src/style.css: filtros, históricos, consultas e estados críticos.
- index.html e README.md: nomenclatura oficial e documentação operacional.
- supabase/migrations/20261002180915_official_product_evolution.sql: evolução do banco/RPCs/RLS.
- tests/migration-legacy.sql e tests/verify.cjs: fixtures descartáveis e verificação.
- tests/production-smoke.cjs: verificação do site publicado sem login/escrita.
- .github/workflows/verify.yml: execução isolada de build/migrations/Auth/RLS/Chromium.

## Banco

Criados:
- pilot_private.permissions: matriz funcional por perfil.
- public.pilot_destinations: unidade receptora estruturada.
- public.pilot_product_versions: dados e mudanças de cada versão.
- public.pilot_authorization_requests: solicitações/decisões permanentes.

Alterados:
- pilot_cycles: status, fechamento, snapshot/proveniência e vínculo com versão do produto.
- pilot_loadings: destination_id; original emitido protegido por trigger.
- pilot_products: versionamento automático e código normalizado único.
- RPCs de cadastro/edição/emissão/autorizações/acesso: verificação central de permissões.
- pilot_audit e pilot_profile_audit: estruturas existentes reutilizadas.

Constraints e índices:
- UNIQUE lower(btrim(pilot_products.code)); UNIQUE original mantido.
- PK (product_id,version), FK do Ciclo de tanque para essa versão.
- FK do carregamento para unidade receptora.
- CHECK de status do Ciclo de tanque coerente com active.
- CHECK de tipo/decisão/objeto de autorização.
- UNIQUE de solicitação pendente por tipo/objeto/versão.
- Índices para versões/atores/destinos, status/período e FKs de solicitação.
- Índices anteriores e unicidade de um Ciclo de tanque ativo por tanque preservados.

Índices novos: pilot_loadings_destination_id_idx, pilot_products_normalized_code_key, pilot_product_versions_author_id_idx, pilot_cycles_product_version_idx, pilot_cycles_status_created_at_idx, pilot_cycles_closed_by_idx, pilot_authorization_pending_object, pilot_authorization_loading_idx, pilot_authorization_cycle_idx, pilot_authorization_requester_idx, pilot_authorization_actor_idx e pilot_authorization_history_idx.

RLS/privilégios:
- RLS habilitada nas três tabelas públicas novas.
- Policies criadas: pilot_destination_read, pilot_version_read e pilot_request_read. Alteradas: pilot_loading_read, pilot_cycle_read e pilot_approval_read. Policies de perfil próprio e auditoria anteriores preservadas.
- Leitura de destinos/versões para usuários ativos autorizados.
- Histórico operacional para perfis internos; Consulta recebe histórico associado aos laudos que pode consultar.
- Consulta lê emitidos/cancelados de todas as unidades e seus Ciclos de tanque associados.
- Escritas diretas das novas tabelas revogadas; ações ocorrem por RPC verificada.
- EXECUTE de funções novas revogado de PUBLIC/anon; RPCs públicas disponíveis a authenticated com validação interna; helper privado de RLS autorizado explicitamente.
- SECURITY DEFINER existente mantido onde a operação precisa escrever além dos privilégios do cliente; search_path vazio e autorização explícita.

## Permissões

| Ação | Administrador | Supervisor | Operador Técnico | Operador | Consulta |
|---|---|---|---|---|---|
| Visualizar registros operacionais | Todos | Todos | Todos | Todos | Laudos emitidos/cancelados e Ciclos vinculados, de todas as unidades |
| Criar Ciclo de tanque / carregamento | Sim | Sim | Sim | Sim | Não |
| Editar rascunho / registro em correção | Sim | Sim | Sim | Sim | Não |
| Emitir laudo após validações | Sim | Sim | Sim | Sim | Não |
| Editar laudo emitido/cancelado | Não | Não | Não | Não | Não |
| Encerrar Ciclo de tanque | Sim | Sim | Sim | Não | Não |
| Solicitar autorizações/cancelamentos | Sim | Sim | Sim | Sim | Não |
| Autorizar uso de referência | Sim | Sim | Sim | Não | Não |
| Autorizar exceção de especificação | Sim | Sim | Não | Não | Não |
| Aprovar/rejeitar cancelamento | Sim | Sim | Sim | Não | Não |
| Consultar histórico de autorizações | Todos | Todos | Todos | Todos | Associado aos laudos disponíveis |
| Criar/editar/inativar produtos e administrar tanques | Sim | Não | Não | Não | Não |
| Visualizar/administrar usuários | Todos | Somente abaixo de Supervisor | Não | Não | Não |
| Atribuir perfil de Supervisor/Administrador | Sim | Não | Não | Não | Não |
| Consultar auditoria operacional | Sim | Sim | Não | Não | Não |

A matriz preserva a gestão de produtos/tanques no Administrador e a autorização de exceções no Supervisor/Administrador. Hierarquia não concede automaticamente todas as funções do perfil inferior.

## Migração

Migration official_product_evolution aplicada com sucesso ao Supabase de produção em 02/10/2026, registrada como 20261002180915. O arquivo do projeto usa o mesmo identificador e o mesmo SQL validado na suíte.

Comparação antes/depois: quantidades e hashes do conteúdo original coincidem para 3 produtos, 14 tanques, 2 Ciclos de tanque, 3 carregamentos, 4 perfis e 2 aprovações. A comparação desconsiderou somente as colunas novas; nenhum campo original mudou.

Criados 11 destinos, 3 versões de legado e 2 registros de decisões anteriores no novo histórico.

Os advisors do Supabase não indicaram ausência de RLS nem novos problemas de índices de FK. Permanecem os avisos documentados abaixo sobre RPCs SECURITY DEFINER, proteção de senhas vazadas e índices ainda sem uso.

Registros que não puderam receber setor automaticamente:
- Carregamento #4: Itapetininga; destination_id permanece NULL.
- Carregamento #5: Itapetininga; destination_id permanece NULL.
- Carregamento #21: Itapetininga/SP; destination_id permanece NULL.

As 3 versões capturadas do legado permanecem sem autor e sem data de alteração original, pois essas informações não estavam registradas. Nenhum valor foi inventado.

Aplicação publicada em https://laudos-agudos-piloto.vercel.app/ pelo commit funcional 9a82dfa555f01b377718aa5512c8c17477b959ed. [Deploy de produção Vercel](https://vercel.com/ggrecca/laudos-agudos-piloto/A2aUpU4KuUX5FKNJECo6woTdxius).

[Verificação do branch principal e da produção](https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37045742620): build aprovado, todos os 21 grupos repetidos com sucesso e verificação pública adicional aprovada — HTTP 200, título Laudos Agudos, formulários de login/solicitação de acesso, desktop 1280/1440/1920 e zero erros de console. Essa verificação de produção foi somente de leitura, sem login nem escrita de registros.

Inspeção do banco aplicado: zero tabelas pilot_* sem RLS, zero RPCs pilot_* executáveis por anon e zero tabelas novas com INSERT/UPDATE/DELETE direto para authenticated. Matriz de permissões de produção conferida.

- Destinos genéricos não foram convertidos para setores.
- Versões atuais anteriores à evolução foram capturadas com provenance=legacy_capture e autoria/data real desconhecidas em NULL.
- Especificações já existentes nos Ciclos de tanque foram conservadas, com sua versão.
- Nomes/códigos/famílias disponíveis na implantação foram congelados no snapshot de cada Ciclo de tanque. Para legado, isso representa a informação disponível na captura; não uma reconstrução fictícia do texto original da emissão.
- Aprovações antigas continuam em pilot_approvals; suas decisões também aparecem no novo histórico. Solicitante/data da solicitação só são preenchidos quando o audit existente permite identificar o evento. Campos ausentes permanecem identificados como não registrados.
- Datas de encerramento antigas não são inventadas.
- Destino antigo do perfil permanece como dado legado, sem limitar Consulta.
- Nenhuma tabela histórica foi apagada ou recriada.

## Testes efetivamente executados

A suíte usa autenticação real dos cinco perfis, RPCs, RLS e PostgreSQL local descartável, além de Chromium contra o frontend real, sem mocks de rede. Nenhum dado de teste foi criado em produção.

**Resultado: build sem erros e 21 grupos de fluxos aprovados, repetidos com sucesso após a integração em main.** [Execução completa](https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37045215077). A execução final em main validou o commit 9a82dfa555f01b377718aa5512c8c17477b959ed, incluindo a migration com seu identificador definitivo e o smoke da publicação.

| Grupo | O que foi verificado |
|---|---|
| Auth e matriz | Login dos cinco perfis e permissões efetivamente retornadas pelo banco. |
| Migração de destinos | Destino genérico Uberaba continua genérico; Consulta não depende de unidade. |
| Migração de autorizações | Decisões antigas e solicitação pendente preservadas; fluxo legado segue funcionando. |
| Cadastro de produto | Criação, duplicidade com espaços/caixa normalizados e chamada não autorizada bloqueada. |
| Criação de Ciclo de tanque | Análise obrigatória e número inválido rejeitados; especificação/snapshot armazenados. |
| Histórico de Ciclo de tanque | Encerramento e cancelamento autorizado, tentativa sem permissão bloqueada e consulta posterior. |
| Onze destinos | Todas as opções selecionadas e armazenadas com ID estável/texto; destino genérico novo rejeitado. |
| Dependências | Encerramento com carregamento pendente e cancelamento com qualquer vínculo bloqueados. |
| Emissão | Emissão normal; alteração posterior por RPC e escrita direta bloqueadas. |
| Referência | Solicitação, aprovação pelo Operador Técnico, emissão e responsáveis/datas preservados. |
| Exceção | Operador Técnico não aprova exceção; Supervisor rejeita/aprova, correção cria nova solicitação e histórico permanece. |
| Cancelamento de laudo | Rejeição mantém emitido; aprovação marca Cancelado; original permanece; nova emissão correta em novo registro. |
| Versões | Autor/data/dados/antes-depois, inativação, novos usos bloqueados e laudo antigo preservado. |
| Gestão de usuários | Administrador vê todos; Supervisor vê inferiores; edição válida, escalada/acesso direto bloqueados e Consulta aprovada sem unidade. |
| RLS e auditoria | Consulta vê laudos de várias unidades, sem rascunhos; ação crítica bloqueada; auditoria contém antes/depois. |
| Navegador: Ciclo de tanque | Login, navegação, erro obrigatório visível, referência/especificação e criação. |
| Navegador: carregamento | Erro localizado na placa, destino estruturado, salvar rascunho e emitir laudo. |
| Navegador: autorização | Ciclo cancelado consultável; uso de referência, aprovação por outro perfil, “Autorizado para emissão”, emissão e cancelamento. |
| Navegador: gestão | Duplicidade abre produto existente, sugestões aparecem, edição cria versão, versões/lista de usuários/histórico acessíveis. |
| Navegador: Consulta e desktop | Laudo CANCELADO acessível, ações restritas ausentes, larguras 1280/1440/1920 sem overflow e verificação do console. |

Evidências: results.json e capturas de Ciclos de tanque, usuários, autorizações, laudos e estados cancelados no artefato verification-evidence do workflow.

## Regressão

Build TypeScript/Vite, login real, navegação, tela inicial/orientações, criação e encerramento de Ciclo de tanque, carregamento, rascunho, emissão normal, análise própria e referência, autorizações preexistentes, consulta, autocomplete e layout desktop exercitados na suíte isolada. As regras anteriores de aprovação de referência por Operador Técnico e de exceção por Supervisor/Administrador foram mantidas.

A verificação em produção compara quantidades e conteúdo dos registros anteriores à migration; não emite laudos industriais de teste. A publicação e as verificações de produção estão registradas na seção de migração.

## Pendências e limitações

- Informação antiga não registrada não pode ser reconstruída: destino específico de registros genéricos, autoria/data de versões anteriores e eventos sem evidência em auditoria permanecem explícitos.
- A regra existente de criar carregamentos somente em Ciclo de tanque ativo foi preservada. Não há reabertura automática de Ciclo encerrado para corrigir laudo.
- O teste isolado confirma login e integração Auth, mas não verifica entrega de e-mail do provedor de produção.
- Filtros são aplicados sobre os registros autorizados carregados em páginas; volumes muito grandes podem exigir futuramente filtros/paginação no servidor, sem mudar o armazenamento histórico.

## Riscos e acompanhamento

- Atualizar a página após a publicação para carregar os novos seletores e permissões.
- O Supabase aponta SECURITY DEFINER executável por authenticated nas RPCs: uso intencional desta arquitetura, com autorização interna, search_path vazio e testes de acesso direto. [Explicação do aviso do linter](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- A proteção contra senhas vazadas já estava desativada em Supabase Auth; não foi alterada nesta entrega. Revisar [configuração de segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Índices sem uso recente foram preservados, pois o volume atual é pequeno e são úteis para integridade/performance futura. [Aviso de índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
