# Laudos Agudos — piloto

Aplicação independente do protótipo Sites. Vite/React na Vercel e Postgres/Auth no Supabase. O banco começa vazio: não há laudos, resultados nem limites fictícios.

## Configuração

1. Aplicar as migrações `supabase/001_pilot.sql`, `002_consumer_scope.sql`, `003_security_hardening.sql`, `migrations/20260930171905_user_approval_workflow.sql` e `migrations/20260930172542_user_approval_indexes.sql` na ordem indicada. Elas já foram aplicadas ao projeto Supabase `bsxhpethmktjheaimjid` na região `sa-east-1`.
2. Configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` na Vercel. Ambas são públicas; nunca incluir chaves secretas no front-end.
3. Configurar os URLs de redirecionamento de Auth no Supabase após conhecer a URL da Vercel. Confirmar entrega de e-mail no ambiente do piloto.
4. O usuário solicita acesso com nome, e-mail e senha e confirma o e-mail. O cadastro começa como `Pendente` e não acessa os módulos até um Supervisor ou Administrador definir o perfil.
5. Supervisores podem aprovar como `Consulta`, `Operador A` ou `Operador Técnico`. Administradores podem também aprovar como `Supervisor`; em `Consulta`, o destino/unidade é obrigatório. A decisão fica registrada na auditoria.
6. Designar o primeiro administrador **somente após verificar seu e-mail** com SQL administrativo:

```sql
update public.pilot_profiles p
set role = 'Administrador', name = 'NOME CONFIRMADO', active = true,
    status = 'Ativo', approved_at = now(), decision_reason = 'Bootstrap inicial'
from auth.users u
where p.id = u.id and u.email = 'EMAIL_CONFIRMADO' and u.email_confirmed_at is not null;
```

O perfil `Administrador` não é atribuído pela tela de aprovação; o primeiro administrador deve ser criado por bootstrap controlado. Alterações de perfis já aprovados continuam fora do escopo desta tela e dependem do administrador do banco neste estágio.

## Escopo atual

- Administrador cadastra produtos, limites analíticos e tanques; ciclos congelam a versão da especificação usada na emissão.
- Operadores registram carregamentos, resultados, transportadora, placa e analista. Referência do tanque exige autorização técnica; resultado fora de limite exige supervisor.
- Autorizações e emissão são validadas por funções do banco, com identidade de Auth e trilha de auditoria. Alterar um rascunho incrementa sua versão e invalida decisões anteriores.
- Unidades consumidoras veem apenas laudos emitidos para o destino atribuído ao seu perfil.
- Usuários novos ficam pendentes; a área `Usuários` é exibida para Supervisores e Administradores, com regras de atribuição aplicadas novamente no banco.
- Datas digitadas em `datetime-local` são convertidas para ISO com fuso antes de chegar ao `timestamptz`, evitando deslocamento de horário no Brasil.

## Compatibilidade com o layout atual

Os ajustes de interface não exigem mudança de banco: placa, transportadora e responsável são textos com sugestões; fabricação usa `manufactured_at`; filtros, orientação e painel sticky são apresentação. A migração 003 foi necessária por segurança, não por causa do layout: removeu escrita direta das tabelas pelo Data API e manteve as RPCs autenticadas como única fronteira de alteração.

O layout mais completo do protótipo também exibe histórico de versões de especificação, histórico/encerramento/reabertura de ciclos e revisões/cancelamentos detalhados. Esses recursos não devem ser habilitados no piloto apenas com os campos atuais: antes de portá-los, será necessário criar tabelas de versões/histórico e registrar motivos e atores de cada transição.

## Ainda não validado para operação real

- Fluxo completo com contas de operador, supervisor e unidade consumidora; depende de e-mails reais e configuração de Auth.
- Revisões, cancelamento de laudos e PDF imutável/arquivado. A impressão atual é uma visualização do navegador.
- Importação dos limites oficiais, destinos e cadastros da Dexco; dupla conferência dos parâmetros antes de emitir qualquer laudo operacional.
- Teste simultâneo entre usuários, recuperação de sessão, backup e exportação formal para a migração à Dexco.

O verificador de segurança do Supabase sinaliza nove RPCs `SECURITY DEFINER` expostas a usuários autenticados. Elas são a fronteira de escrita deste piloto: cada função verifica explicitamente `auth.uid()` e o perfil armazenado no banco; `anon` não tem `EXECUTE`, e tabelas não concedem escrita direta ao cliente. Revisar de novo antes de operação real.

## Comandos

```bash
pnpm install
cp .env.example .env.local # preencher as duas variáveis públicas
pnpm dev
pnpm build
```
