# Laudos Agudos

Sistema de laudos de qualidade das Fábricas Químicas de Agudos. React 19 / TypeScript / Vite no frontend, Supabase Auth e PostgreSQL no backend, Vercel na hospedagem.

## Arquitetura e configuração

As ações de negócio passam por RPCs do PostgreSQL. O navegador usa somente a chave publicável; RLS controla leituras e as funções verificam as permissões do usuário ativo. Nunca inclua chaves de serviço no frontend.

As variáveis públicas são `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Configure também as URLs de redirecionamento no Supabase Auth. O cadastro exige confirmação de e-mail e aprovação de Supervisor ou Administrador.

Aplique os scripts iniciais `supabase/001_pilot.sql`, `002_consumer_scope.sql`, `003_security_hardening.sql` e, em seguida, todos os arquivos de `supabase/migrations` em ordem cronológica. Não reaplique migrations já registradas nem use reset no banco de produção.

Os nomes técnicos `pilot_*`, o nome do repositório e a URL existente foram preservados por compatibilidade. A nomenclatura do produto é **Laudos Agudos**.

## Regras operacionais

- Hierarquia: Administrador → Supervisor → Operador Técnico → Operador → Consulta. O valor técnico `Operador A` permanece no banco; a interface apresenta Operador.
- A matriz funcional está em `pilot_private.permissions`. O frontend recebe as permissões por `pilot_permissions()`; as RPCs validam a mesma fonte.
- Consulta visualiza laudos emitidos e cancelados de todas as unidades, com os Ciclos de tanque associados; não acessa rascunhos.
- Supervisor administra somente perfis abaixo do seu e não pode promover alguém para Supervisor/Administrador. Administrador administra todos; a alteração do próprio perfil/status é bloqueada.
- Produtos são administrados pelo Administrador. Cada alteração e inativação registra nova versão com autor, data e diferenças.
- Ciclos de tanque preservam a versão e os dados do produto selecionado na abertura. Alterar o cadastro não altera laudos existentes nem especificações de Ciclos de tanque já abertos.
- Encerramento exige Operador Técnico ou superior e ausência de carregamentos pendentes.
- Cancelamento de Ciclo de tanque exige motivo e autorização de Operador Técnico ou superior; qualquer carregamento vinculado impede a solicitação/decisão.
- Laudo emitido é imutável. A correção exige cancelar com autorização e criar um carregamento correto; o original continua consultável como CANCELADO.
- Uso das análises do tanque exige Operador Técnico ou superior; exceções de especificação exigem Supervisor ou Administrador. Autorizações só valem para a versão de dados avaliada.
- Decisões permanecem no histórico. Uma edição/rejeição que invalide pendências registra o estado Substituída.
- Unidades receptoras são registros de `pilot_destinations`, com IDs estáveis. Textos históricos genéricos continuam sem classificação específica; a interface os identifica como destino histórico.
- Produto inativo permanece no histórico e bloqueia novos Ciclos de tanque/carregamentos. Carregamentos existentes conservam seus dados e permissões.

## Integridade histórica

A migration de evolução é aditiva. Não apaga produtos, ciclos, laudos, usuários ou autorizações.

Versões anteriores são identificadas como captura de legado quando a autoria/data real não estiverem disponíveis; não se inventam essas informações. As especificações já salvas nos Ciclos de tanque são preservadas. Dados gerais do produto que existiam na implantação são congelados para impedir mudanças retroativas futuras; não se afirma que esses textos foram registrados originalmente na emissão.

As unidades genéricas antigas não são convertidas para MDF/MDP/Revestidos sem evidência. A coluna antiga de destino do perfil é preservada como dado legado e não participa da autorização do perfil Consulta.

## Desenvolvimento e verificação

`pnpm install --frozen-lockfile`, `pnpm dev` e `pnpm build`.

O workflow `.github/workflows/verify.yml` executa build estrito, cria um Supabase descartável local sem vínculo com produção, injeta registros anteriores à migration, aplica a evolução e roda `tests/verify.cjs`.

A suíte usa login real nos cinco perfis, RPCs, consultas diretas/RLS e Chromium com a aplicação Vite. As capturas e resultados ficam no artefato `verification-evidence`. Dados e credenciais sintéticos dos testes existem somente no runner descartável. O script recusa qualquer URL de banco hospedado.

As versões de bibliotecas de produção permanecem fixadas no lockfile. Playwright é instalado apenas no diretório temporário do runner e não entra no bundle da aplicação.
