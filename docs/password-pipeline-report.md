# Laudos Agudos — senhas, tubulação e laudo

Relatório de implementação de 06/10/2026. Frontend, migration e serviço de senha publicados em produção. Validação integrada e verificação somente de leitura da interface publicada aprovadas.

Aplicação: https://laudos-agudos-piloto.vercel.app/

## Alterações

1. Login: solicitação de reset, aprovação/rejeição na fila existente, código pessoal de uso único e tela obrigatória de nova senha após aprovação.
2. Conta: Alterar senha exige prova da senha atual no Supabase, senha nova e confirmação. Não requer aprovação. Após sucesso, as sessões são encerradas e é necessário entrar novamente.
3. Resina + destino estruturado `agudos-mdf2`: transportadora e placa opcionais, inclusive nas RPCs e emissão. Usa a família preservada no snapshot do Ciclo de tanque. Emulsão e demais destinos continuam exigindo ambos.
4. Origem dos resultados: texto correto sobre dispensa da análise do caminhão em Agudos; referência do tanque permanece utilizada e resultados fora de especificação mantêm autorização de exceção.
5. Laudo: identificação em três linhas na ordem solicitada; transferência por tubulação identificada sem valores fictícios; rodapé com emissão e origem efetiva; data do carregamento continua no banco, mas sai do documento.
6. Impressão A4: margens de 10 mm, tabela compacta e ajuste ao espaço disponível, sem truncar análises, justificativas ou observações. O ajuste é exclusivo da impressão; o restante do desktop permanece na direção visual existente.
7. Manual: capítulos sobre senhas e transferência por tubulação.

## Arquivos principais

- `src/PasswordFlows.tsx`: solicitação, reset e alteração de senha, com erros próximos aos campos.
- `src/PasswordResetAuthorizations.tsx`: decisão e entrega pessoal do código.
- `src/pilot.tsx`: integração no login, conta, autorização e carregamento.
- `src/Management.tsx`: histórico de reset e data de conclusão.
- `src/flow.ts`: regra de transporte utilizada pela validação do formulário.
- `src/Certificate.tsx`, `src/style.css`: ordem dos campos, rodapé e ajuste da impressão.
- `src/manual.ts`, `docs/manual-operacional.md`: orientações operacionais e manual completo atualizado.
- `supabase/functions/password-actions/index.ts`: serviço confiável de senha.
- `supabase/migrations/20261006013239_password_workflows_and_pipeline.sql`: alterações reproduzíveis do banco.
- `tests/password-pipeline-print.cjs`, `tests/verify.cjs`, `tests/mobile-ui.cjs`, `tests/production-smoke.cjs`, `tests/auth-runtime-diagnostics.cjs`, `.github/workflows/verify.yml`: validação real isolada, diagnóstico sem credenciais e regressão.

## Banco e permissões

Migration aditiva: permite ator de auditoria nulo exclusivamente no evento de solicitação anônima de reset, com check de contexto e identidade ainda não comprovada; acrescenta `password_user_id` e `completed_at` ao histórico de autorizações, amplia os checks de tipo/objeto e cria unicidade para um reset pendente/aprovado não concluído por usuário. Não reclassifica unidades nem modifica produtos, versões, ciclos ou carregamentos históricos.

Novas tabelas privadas: `password_reset_secrets` (hash do código, validade e tentativas), `password_change_permits` (hash de permissão efêmera), `password_rate_limits` (chave derivada do IP, sem IP em texto). Todas têm RLS e acesso negado a anon/authenticated. Não armazenam senhas nem hashes de senhas.

Nova permissão central: `password_resets.decide`, exclusivamente Administrador e Supervisor. Supervisor respeita a hierarquia existente e administra somente Operador Técnico, Operador e Consulta. Ninguém aprova o próprio reset; reset de Administrador exige outro Administrador. Os demais perfis solicitam o próprio reset e alteram a própria senha com comprovação da senha atual. As permissões operacionais anteriores permanecem.

Policy restritiva no histórico: entre os perfis que já podem consultar autorizações, o reset fica limitado ao titular e aos gestores autorizados para aquele perfil; não é exposto aos demais operadores. Consulta não ganha acesso à administração ou ao histórico de autorizações. O helper central de acesso também bloqueia operações quando há reset aprovado ainda não concluído e rejeita sessões já encerradas.

### Estruturas aplicadas

- Migration: `20261006013239_password_workflows_and_pipeline.sql`, alinhada à versão registrada no Supabase; aplicada uma vez.
- Tabelas públicas alteradas: `pilot_authorization_requests` e `pilot_audit`. Tabelas operacionais/históricas não tiveram seus registros alterados.
- Checks: `pilot_anonymous_reset_audit_check`, tipo e vínculo do objeto da autorização, `pilot_reset_completion_check` e tentativas não negativas.
- Índices: `pilot_one_open_password_reset` (único parcial), `pilot_password_user_idx` e `pilot_password_permit_request_idx`; preservados os índices anteriores.
- RLS: `pilot_password_requests_privacy`, restritiva para SELECT; três tabelas privadas com RLS e sem grants a anon/authenticated, deliberadamente sem policies de acesso público.
- RPCs autenticadas: `pilot_password_state` e `pilot_decide_password_reset`.
- RPCs exclusivas de service_role: `pilot_password_rate_limit`, `pilot_request_password_reset`, `pilot_prepare_password_change`, `pilot_release_password_permit`.
- Funções privadas: bloqueio de reset, verificação hierárquica, permissão central, proteção da mudança de senha, proteção da recuperação nativa e validação conjunta de transporte.
- Triggers: `pilot_password_change_guard`, `pilot_native_recovery_guard`, `pilot_transport_guard`.
- RPCs existentes atualizadas: `pilot_create_loading` e `pilot_save_loading`, conservando permissões, validação de análises, imutabilidade e auditoria; a obrigatoriedade de transporte fica centralizada no guard do banco.
- Edge Function: `password-actions`, versão 1, ACTIVE; autenticação específica por ação dentro da função.

### Permissões de senha

| Perfil | Solicitar o próprio reset | Alterar a própria senha com senha atual | Aprovar/rejeitar/renovar reset |
|---|---|---|---|
| Administrador | Sim, conta ativa | Sim | Outros usuários, incluindo outro Administrador |
| Supervisor | Sim, conta ativa | Sim | Operador Técnico, Operador e Consulta |
| Operador Técnico | Sim, conta ativa | Sim | Não |
| Operador | Sim, conta ativa | Sim | Não |
| Consulta | Sim, conta ativa | Sim | Não |

Nenhum perfil aprova o próprio reset. Reset de Administrador exige outro Administrador ativo; Supervisor não recebe esse poder. Depois de aprovado um reset, a alteração normal e o acesso operacional ficam bloqueados até sua conclusão por código.

## Autorização e conclusão segura

O e-mail informado no login identifica uma conta, mas não prova identidade. A resposta é genérica e a solicitação registra expressamente essa condição. A identidade deve ser conferida pessoalmente antes da aprovação e entrega do código, conforme a opção escolhida pelo usuário.

A solicitação/resgate tem limitação por chave derivada do IP (20 chamadas por hora), sem persistir o IP em texto. O código aleatório tem 128 bits, validade de 24 horas e é bloqueado após 5 tentativas incorretas. Apenas seu SHA-256 fica no schema privado; o código é exibido ao aprovador uma única vez. A senha é escolhida na tela do titular, nunca no formulário do gestor.

A Edge Function verifica a senha atual com Supabase Auth, ou confere o código de um reset aprovado no banco. Em seguida, cria uma permissão efêmera e chama a API administrativa do Supabase Auth para que o próprio Supabase valide, gere e armazene a senha. A chave de serviço nunca chega ao navegador.

Um trigger diferido em `auth.users` exige que a mesma transação de atualização apresente, via `app_metadata` exclusiva da API administrativa, a permissão privada de uso único. No commit, consome a permissão, remove o nonce, registra o evento e conclui a autorização. Falha no Auth não conclui o reset. Chamadas diretas a `updateUser`, metadados editáveis do usuário e reset nativo por e-mail não contornam esse mecanismo.

Após o sucesso, o Auth encerra as sessões. O aplicativo limpa o cache local de sessão usando a mesma chave padrão do Supabase, preservando compatibilidade com sessões anteriores à atualização; a tela retorna ao login e não recupera a sessão antiga ao recarregar.

O endpoint tem JWT automático desativado para permitir solicitação e resgate sem senha antiga. As ações autenticadas validam o token e as permissões; reset exige a capacidade secreta aprovada; RPCs da ponte só aceitam `service_role`. Não há senhas, códigos ou corpos de requisição nos logs/auditoria da aplicação.

## Compatibilidade e cuidados

- Mantido o mínimo existente de 6 caracteres; o Supabase continua aplicando suas demais exigências. A interface recomenda senha longa e exclusiva. Não foram alteradas as senhas atuais.
- Recuperação nativa/magic link para contas ativas é bloqueada, pois compartilha o token de recuperação e poderia contornar o processo aprovado. O login por senha e a confirmação do cadastro permanecem. Não havia tokens de recuperação pendentes em produção na revisão.
- Os triggers de segurança no schema Auth exigem repetir os testes quando o Supabase atualizar sua implementação de senha ou quando forem introduzidos novos métodos de login/MFA.
- O código é uma credencial temporária: deve ser entregue somente ao titular verificado. Quem obtiver o código poderá resgatá-lo.
- O banco permanece sem limite artificial de análises/textos históricos. Casos extremos de conteúdo podem exigir redução maior na impressão; a legibilidade deve ser conferida. Impressoras, cabeçalhos do navegador, Safari/Firefox e configurações de escala requerem conferência manual.

## Preservação e revisão de segurança

Antes/depois da migration, a comparação de conteúdo por fingerprint confirmou preservação dos 5 ciclos, 7 carregamentos, 3 produtos, 6 perfis, 5 autorizações existentes e 5 versões de produto. Na comparação das autorizações foram descontadas somente as duas novas colunas nulas. Nenhuma senha de produção foi alterada para testes, nenhuma conta artificial foi criada e nenhum registro industrial foi emitido/cancelado nos testes de produção.

A revisão de grants em produção confirmou que as quatro RPCs de ponte só aceitam service_role, as três tabelas privadas têm RLS e nenhum acesso de anon/authenticated, e os três triggers estão instalados.

O Advisor identifica duas novas RPCs SECURITY DEFINER acessíveis a autenticados: são intencionais e verificam identidade/permissão; havia 20 avisos equivalentes antes. As três tabelas privadas aparecem como RLS sem policy (INFO), intencionalmente fechadas a clientes. Referências: [RPCs SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

A [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) já estava desativada no Supabase; a configuração foi preservada. Ativá-la é uma decisão posterior de política de senha.

## Testes e publicação

Os [36 grupos de fluxos passaram na validação integrada final](https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37457984451). A [validação de main também passou](https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37458467009), incluindo o navegador no endereço de produção. Após o ajuste final do fundo branco da impressão, [a validação completa foi repetida e aprovada](https://github.com/ggrecca/laudos-agudos-piloto/actions/runs/37459096413), incluindo build, 36 grupos de fluxos, comparação desktop/mobile e smoke de produção. Os testes de escrita utilizaram Supabase Auth, Edge Function, PostgreSQL/RLS e Chromium reais em ambiente isolado, nunca vinculado ao banco de produção.

### Fluxos novos efetivamente verificados

| Fluxo | Verificação e resultado |
|---|---|
| Solicitar reset | Navegador no login cria pendência; resposta genérica; segunda solicitação não duplica. Aprovado. |
| Aprovar/rejeitar | Supervisor rejeita e aprova uma nova solicitação; Administrador aprova; histórico e atores/datas preservados. Supervisor não administra Administrador e autoaprovação é negada. Aprovado. |
| Reset obrigatório | Login com reset aprovado bloqueia a aplicação; tela pede nova senha/confirmação sem senha antiga. Resgate por código funciona sem conhecer a senha antiga. Aprovado. |
| Conclusão e segurança | Divergência das senhas não consome; código aprovado é consumido na mesma transação do Auth; nova senha funciona, código não pode ser reutilizado; sessão antiga não reaparece ao recarregar. Aprovado. |
| Falha e renovação | Código expira em 24 h, cinco erros bloqueiam, renovação invalida código anterior e preserva decisão original. Falha de commit injetada no Auth isolado não consome autorização e permite tentativa válida posterior. Aprovado. |
| Acesso direto | Reset antes da aprovação, atualização nativa de senha, recuperação nativa por e-mail, metadados editáveis, RPCs exclusivas do serviço e decisões sem permissão bloqueados. Tokens de sessões encerradas não recuperam permissões. Aprovado. |
| Alterar senha | Senha atual errada e confirmação diferente geram erros locais; senha atual validada no servidor; sucesso no navegador encerra sessões; novo login funciona, sem criar autorização. Aprovado. |
| Tubulação | Resina → Agudos-MDF2 cria, salva e emite sem transportadora/placa e sem valores fictícios; Resina → MDF1 e Emulsão → MDF2 rejeitam a ausência. Campos obrigatórios/opcionais e origem conferidos na interface. Aprovado. |
| Documento | Ordem das três linhas, transferência coerente, emissão/origem no rodapé e ausência de data do carregamento. PDFs com 9, 30 e 60 análises: uma página e última análise/rodapé presentes. Aprovado. |

O conjunto de nove análises cobre o máximo observado nas especificações atuais de produção. Os casos de 30 e 60 são testes de volume adicional. A extração de texto dos PDFs confirmou emissão, origem e última análise; a conferência visual foi feita no documento normal. Não foi comprovada legibilidade em impressoras físicas ou em todo conteúdo histórico sem limite de tamanho.

### Regressão verificada

- Login real dos cinco perfis, navegação, tela inicial, ajuda e manual completo, busca e download.
- Ciclos de tanque: criação com especificações compartilhadas, erro obrigatório visível, consulta ativa/encerrada/cancelada, encerramento, cancelamento autorizado e bloqueios de dependências/permissão.
- Carregamentos: formulário, autocomplete, erros localizados, rascunho, emissão normal, uso de referências em Agudos sem aprovação e autorização nos destinos externos.
- Laudos: imutabilidade após emissão, versão histórica preservada, consulta, cancelamento aprovado/rejeitado, documento original consultável e emissão correta posterior.
- Produtos: código único, direcionamento ao existente, nova versão, inativação e impedimento de novos usos; preservação de snapshots históricos.
- Usuários: listagem/edição hierárquica, Consulta global, bloqueio de acesso direto e de escalada.
- Autorizações: decisões, exceções, cancelamentos, histórico permanente e identificação dos responsáveis.
- Onze unidades receptoras: identificação estável, seleção e texto; destino histórico genérico Uberaba permanece sem classificação inventada.
- Aviso de idade da resina não bloqueante, limites inclusivos, destaque imediato fora da faixa e ações sticky anteriores preservados.
- Desktop: comparação de pixels em sete telas a 1280, 1440 e 1920 px, normalizando somente as alterações solicitadas de conta, documento e manual. Mobile: 320, 375, 390, 430, 768 e 900 px; fluxos reais sem overflow.
- Console: sem erros inesperados nos fluxos de navegador. Rejeições HTTP intencionais dos testes de segurança foram verificadas como resultado esperado.

Build: TypeScript e Vite concluídos sem erros, localmente e em CI. Implantação Vercel em produção pronta. Smoke somente de leitura de produção: HTTP 200, título Laudos Agudos, login, cadastro, esqueci minha senha/tela do código sem envio e larguras 375/430/1280/1440/1920 px, console sem erros.

### Validações manuais e riscos restantes

1. Conferir o procedimento de identificação e entrega pessoal do código com os responsáveis locais. O fluxo completo foi exercitado com contas isoladas; não se redefiniu senha de usuário real apenas para testar produção.
2. Garantir outro Administrador ativo para recuperação de uma conta Administrador. A hierarquia atual impede Supervisor de autorizar essa conta e impede autoaprovação; não foi ampliada sua permissão silenciosamente.
3. Conferir impressora física, navegador/driver, escala e cabeçalhos/rodapés automáticos de impressão. PDFs Chromium de uma página foram verificados; Safari/Firefox e textos históricos extremos ainda requerem conferência de legibilidade.
4. Repetir os testes de Auth quando houver atualização estrutural do Supabase Auth, novos provedores ou MFA. Os guards no schema Auth são uma dependência de segurança explícita.
5. Avaliar futuramente a proteção contra senhas vazadas; a configuração existente não foi modificada nesta entrega.

Não houve migração destrutiva, classificação arbitrária de destinos antigos nem alterações em senhas ou registros industriais de produção para testes.
