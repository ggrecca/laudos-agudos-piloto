# Laudos Agudos — melhorias de carregamento (05/10/2026)

## Alterações
1. Resumo do tanque e do Ciclo de tanque: produto/tipo, lotes e fabricação; utiliza o snapshot do ciclo.
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

## Verificação e estado da entrega
- Build Vercel aprovado no commit ee899d2a266e2136a07fa7dde1e6c777b1f9afeb. A primeira falha de tipagem foi corrigida.
- 28 checks executados sobre os corpos reais das funções de src/flow.ts, removendo apenas as assinaturas TypeScript: limites inclusivos, vírgula decimal, entradas parciais, qualitativos, informativos, limite de 120 horas, representação de fuso, datas ausentes/inválidas/futuras, emulsões e regra conservadora para destinos desconhecidos. Todos passaram.
- Os testes de integração Auth/RPC/RLS/navegador, PDF, sticky e comparação visual foram escritos e adicionados ao workflow, mas AINDA NÃO EXECUTADOS: o GitHub Actions está sem runner para estes jobs durante um incidente de atraso na atribuição de runners.
- Workflow pendente: https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37367636190
- Incidente oficial consultado: https://www.githubstatus.com/ (Actions, 05/10/2026).
- Branch: evolution/loading-guidance-20261005. Produção/main não alteradas.
- Banco de produção: migration NÃO aplicada; nenhuma nova emissão/solicitação/dado de teste foi criada em produção.
- Migration: SQL preparado em supabase/agudos_reference_reuse.sql. O workflow usa supabase migration new agudos_reference_reuse para gerar o nome; após os testes, o arquivo gerado precisa ser incorporado em supabase/migrations e novamente validado antes da aplicação.
- Hashes de 7 carregamentos, 5 ciclos, 4 aprovações e 5 solicitações foram coletados apenas para referência. Devem ser renovados antes da migration, porque o sistema pode receber alterações legítimas enquanto a validação está na fila.
- A publicação está pendente dos testes reais, revisão das capturas, incorporação/aplicação da migration e confirmação do deploy em produção.
- Nenhuma regressão pode ser declarada ausente sem executar as verificações pendentes.

## Retomada
1. Consultar o workflow pendente; corrigir qualquer falha de teste encontrada.
2. Capturar GENERATED_MIGRATION do log do CLI e incorporar o SQL no arquivo correspondente de migrations, removendo o arquivo de preparação.
3. Atualizar o workflow para aplicar essa migration após o teste de compatibilidade histórica existente; executar a validação final.
4. Revisar resultados do navegador e capturas. A comparação de desktop normaliza somente o novo resumo, a remoção da faixa e a data do manual; o restante deve continuar idêntico.
5. Renovar os hashes, aplicar a migration validada no Supabase e confirmar regra/grants/histórico.
6. Conferir main sem alterações concorrentes e integrar sem force push.
7. Confirmar deploy de produção novo e smoke test. Atualizar este relatório com os resultados efetivos.
