# Laudos Agudos — Manual operacional

Fábricas Químicas - Agudos
Atualizado em 02/10/2026

## 1. Visão geral e fluxo de trabalho

Do preparo do tanque à consulta do laudo.

O Laudos Agudos registra Ciclos de tanques, carregamentos, resultados de análises, autorizações e certificados de qualidade. Use os registros para identificar o produto transferido, a unidade receptora e os responsáveis por cada etapa.

1. Prepare um Ciclo de tanque: selecione tanque e produto e registre fabricação, lotes, responsável e análises de referência.
2. Registre o carregamento: confira os dados do caminhão, a unidade receptora e os resultados.
3. Trate as autorizações necessárias: uso das análises do tanque e resultados fora da especificação podem exigir decisões distintas.
4. Emita o laudo dentro do carregamento liberado. Consulte e imprima o documento em Laudos.

> Salvar rascunho, solicitar autorização e emitir laudo são ações diferentes. Uma autorização aprovada não emite o laudo automaticamente.

## 2. Acesso e navegação

Solicitação de acesso, login e uso do menu.

1. No login, selecione Ainda não tenho acesso, informe seu nome completo, e-mail e senha e confirme a senha.
2. Confirme o e-mail quando solicitado. Aguarde um Supervisor ou Administrador avaliar seu cadastro e definir seu perfil.
3. Entre com seu e-mail e senha. Se o acesso estiver pendente, rejeitado ou bloqueado, procure o responsável pelo sistema.
4. Use o menu lateral para abrir Início, Ciclos de tanques, Carregamentos, Autorizações e Laudos. Cadastros e Usuários aparecem conforme suas permissões.
5. Abra Ajuda pelo menu ou pelo botão da tela inicial. A ajuda pode ser consultada sem sair do formulário em andamento.
6. Ao terminar, use Sair.

Início apresenta o fluxo de trabalho e os acessos às etapas. Os campos com sugestões mostram valores usados anteriormente; selecione uma sugestão ou digite o valor correto. Confira sugestões antes de reutilizá-las.

> Ao sair de um carregamento com alterações não salvas, o sistema pode pedir confirmação para descartá-las. Use Salvar rascunho antes de mudar de tarefa quando quiser manter o registro.

## 3. Perfis e permissões

Quem registra, autoriza, encerra e administra.

A hierarquia é Administrador → Supervisor → Operador Técnico → Operador → Consulta. As funções de cada perfil são explícitas; estar acima na hierarquia não substitui a regra da ação. Botões podem ficar ocultos ou desabilitados conforme o perfil, o estado do registro ou uma dependência.

| Ação | Administrador | Supervisor | Operador Técnico | Operador | Consulta |
| --- | --- | --- | --- | --- | --- |
| Criar Ciclo de tanque e carregamento | Sim | Sim | Sim | Sim | Não |
| Editar rascunho / Em correção e emitir laudo | Sim | Sim | Sim | Sim | Não |
| Solicitar autorizações e cancelamentos | Sim | Sim | Sim | Sim | Não |
| Autorizar uso das análises do tanque | Sim | Sim | Sim | Não | Não |
| Autorizar exceção de especificação | Sim | Sim | Não | Não | Não |
| Decidir cancelamento / encerrar Ciclo de tanque | Sim | Sim | Sim | Não | Não |
| Criar, editar e inativar produtos / administrar tanques | Sim | Não | Não | Não | Não |
| Administrar usuários | Todos | Somente perfis inferiores | Não | Não | Não |
| Consultar laudos emitidos / cancelados | Sim | Sim | Sim | Sim | Todas as unidades |

Consulta não visualiza rascunhos. Pode consultar laudos emitidos e cancelados de todas as unidades e os Ciclos de tanques relacionados a esses documentos. Os demais perfis consultam os registros operacionais e o histórico de autorizações.

> Nenhum perfil pode editar silenciosamente um laudo já emitido ou cancelado. Corrigir um laudo emitido exige cancelamento autorizado e novo registro correto.

## 4. Criar e consultar Ciclos de tanques

Referências, especificações, cards ativos e histórico.

1. Abra Ciclos de tanques e clique em Novo Ciclo de tanque.
2. Escolha um tanque ativo e disponível. Um tanque não pode ter dois Ciclos de tanques ativos ao mesmo tempo.
3. Selecione um produto ativo compatível com a família do tanque. Confira a versão e as especificações apresentadas.
4. Informe data/hora da fabricação, lotes e responsável pelas análises.
5. Registre os valores de referência. As especificações aparecem junto às análises; preencha todas as obrigatórias e use valores numéricos válidos quando exigidos.
6. Clique em Criar Ciclo de tanque. Se houver erro, confira os campos destacados e a mensagem visível.
7. Nos cards ativos, use o ícone de olho para consultar dados, referências, especificações, histórico e carregamentos vinculados. Use Novo carregamento para iniciar uma transferência desse ciclo.

Os ativos têm prioridade visual em cards. Ciclos de tanques encerrados e cancelados ficam na lista histórica e continuam consultáveis. Use busca, status, tanque, produto e período para localizar o registro.

> A versão e as especificações do produto são preservadas no Ciclo de tanque. Uma alteração posterior do cadastro não muda seus dados nem os laudos associados.

## 5. Encerrar ou cancelar um Ciclo de tanque

Encerramento operacional e correção de cadastro são ações distintas.

Encerrar conclui o uso operacional do Ciclo de tanque. Cancelar registra um erro de cadastro, com solicitação e decisão formal. As duas ações preservam o histórico.

1. Para encerrar: um Operador Técnico, Supervisor ou Administrador abre o ciclo ativo e usa Encerrar ciclo.
2. Confira se não há carregamentos em Rascunho, Aguardando autorização ou Em correção. Resolva também eventual cancelamento pendente antes de encerrar.
3. Confirme o encerramento. O registro passa para Encerrado e deixa de ser opção para novos carregamentos.
4. Para cancelar um cadastro incorreto: consulte o ciclo ativo e clique no círculo com X, Solicitar cancelamento.
5. Descreva o motivo obrigatório e envie a solicitação. Um Operador Técnico ou superior decide em Autorizações, com justificativa.
6. Após aprovação, o registro fica Cancelado. Se a solicitação for rejeitada, o ciclo continua com seu estado anterior; a decisão permanece no histórico.

> Qualquer carregamento vinculado impede o cancelamento do Ciclo de tanque, mesmo se esse carregamento estiver cancelado. Durante um cancelamento pendente, novos carregamentos ficam bloqueados. O sistema não exclui vínculos nem reabre ciclos automaticamente.

## 6. Registrar carregamentos e análises

Dados do caminhão, destino, origem dos resultados e rascunho.

1. Abra Novo carregamento em Carregamentos ou no card do Ciclo de tanque correspondente.
2. Confira o ciclo, o produto e a data/hora. Só é possível criar carregamentos em ciclos ativos com produto ativo.
3. Informe placa, selecione a carreta, preencha transportadora e selecione a unidade / destino exatos.
4. Confira o nome do responsável que realizou as análises. Não mantenha um valor sugerido se ele não corresponder ao responsável real.
5. Escolha a origem dos resultados: Análise do caminhão para registrar resultados próprios, ou análises do tanque para usar as referências do ciclo.
6. Preencha os resultados e compare cada valor com sua especificação. Campos aplicáveis oferecem sugestões de valores anteriores.
7. Inclua observações pertinentes e use Salvar rascunho para continuar depois.
8. Quando os dados estiverem completos, use Emitir laudo ou Solicitar autorização, conforme a ação apresentada à direita.

Rascunhos podem manter análises ainda não concluídas, mas os dados obrigatórios do carregamento continuam sendo validados. A emissão e a solicitação de autorização exigem as análises obrigatórias completas e válidas.

> Os valores sugeridos não são resultados novos de análise. Registre os resultados efetivamente obtidos. Uma unidade genérica antiga deve ser preservada no histórico, sem inventar um setor.

## 7. Solicitar e decidir autorizações

Uso de referências, exceções, cancelamentos e histórico.

A necessidade de autorização é informada com seu motivo. Usar as análises do tanque exige aprovação de Operador Técnico ou superior. Um resultado fora da especificação exige aprovação de Supervisor ou Administrador. O mesmo carregamento pode exigir ambas.

1. No carregamento, confira os motivos apresentados e clique em Solicitar autorização.
2. Acompanhe o estado Aguardando autorização. O responsável deve abrir Autorizações e conferir o registro, os resultados e os motivos.
3. Para referência, use Autorizar referência ou Devolver. Para exceção, use Autorizar exceção ou Rejeitar. Registre a justificativa obrigatória.
4. Cancelamentos pendentes aparecem em sua seção própria, com Abrir registro, Autorizar e Rejeitar para os perfis habilitados.
5. Após todas as aprovações necessárias, o carregamento aparece como Autorizado para emissão. Abra-o e clique em Emitir laudo.
6. Se for devolvido/rejeitado para correção, revise o registro em Em correção e envie nova solicitação quando necessário.
7. Consulte o Histórico de autorizações para ver solicitante, motivo, decisor, justificativa, datas e o objeto relacionado. Use os filtros de decisão, tipo, período e busca.

> Uma autorização vale para a versão dos dados que foi avaliada. Alterar um carregamento em correção pode exigir nova autorização. Decisões anteriores permanecem no histórico; uma pendência invalidada pode aparecer como Substituída.

## 8. Emitir, consultar e imprimir laudos

Conferência final e acesso ao certificado.

1. Abra o carregamento e confira produto, versão, lotes, placa, carreta, transportadora, destino, responsável e resultados.
2. Confirme que não há análises obrigatórias faltantes ou inválidas e que todas as autorizações exigidas foram concedidas.
3. Clique em Emitir laudo. A emissão ocorre dentro do carregamento.
4. Abra Laudos e busque pelo número do documento, placa ou destino. Clique no registro ou em Abrir.
5. Confira resultados, especificações e situação de cada variável, responsável pelas análises e, quando aplicável, responsável e justificativa da autorização.
6. Use Imprimir laudo. No diálogo do navegador, selecione a impressora ou Salvar como PDF, conforme disponível.

O documento emitido é preservado. A edição futura de um produto não deve alterar o nome, a versão ou as especificações associados ao registro. Para dados antigos, informações não registradas podem permanecer indicadas como desconhecidas.

> Consulta tem acesso aos laudos disponíveis de todas as unidades, inclusive os cancelados. Um laudo com identificação CANCELADO é histórico e não representa um documento vigente.

## 9. Corrigir um laudo já emitido

Cancelar o original, preservar o histórico e emitir o registro correto.

1. Abra o laudo emitido e use Solicitar cancelamento.
2. Informe o erro operacional e o motivo obrigatório. Envie a solicitação.
3. Um Operador Técnico, Supervisor ou Administrador confere o original e decide o cancelamento em Autorizações, com justificativa.
4. Se aprovado, o laudo fica identificado como CANCELADO e mantém os dados, o número e os responsáveis originais. Solicitante, autorizador, motivos e datas ficam disponíveis.
5. Crie um novo carregamento com os dados corretos em um Ciclo de tanque ativo e adequado. Faça as análises e solicitações necessárias e emita o novo laudo.
6. Se o cancelamento for rejeitado, o documento continua Emitido. A solicitação e a decisão permanecem no histórico.

> Não é permitido editar ou reemitir o próprio registro cancelado. Se o ciclo já estiver encerrado ou não houver ciclo ativo adequado, alinhe a regularização com o Operador Técnico/Supervisor; não há reabertura automática.

## 10. Administrar produtos e tanques

Cadastros, versões, duplicidade e inativação.

Cadastros é uma área do Administrador. Produtos e tanques precisam estar ativos e compatíveis para abrir novos Ciclos de tanques.

1. Para produto: informe código único, descrição, família e análises. Configure nomes, unidades, obrigatoriedade e limites ou critérios qualitativos conforme aplicável.
2. Salve o produto. Se o código já existir, use Abrir / editar produto existente e confira se é o cadastro correto.
3. Na lista, busque por código ou descrição e filtre a situação. Use Editar para alterar o produto e Salvar nova versão para confirmar.
4. Use Detalhes / versões para consultar dados, autor, data e mudanças. Cada edição gera uma nova versão; os registros anteriores ficam associados aos dados originais.
5. Use Inativar quando o produto não deva ser escolhido para novos registros. O histórico permanece; não há exclusão destrutiva de produto.
6. Para tanque: informe código e família e cadastre. Use o lápis para editar e confira sua situação Ativo/Inativo.
7. Tanques com Ciclos de tanques associados não podem ser excluídos; use a edição para desativá-los quando necessário.

> Inativar um produto bloqueia novos Ciclos de tanques e novos carregamentos com esse produto. Carregamentos já existentes conservam seus dados e regras. Versões capturadas de legado podem não ter autor ou data original conhecidos.

## 11. Aprovar e administrar usuários

Pendências, edição, bloqueio e limites da hierarquia.

1. Abra Usuários. Administrador visualiza todos; Supervisor visualiza e administra somente perfis abaixo de Supervisor.
2. Localize o cadastro por nome/e-mail, perfil ou situação.
3. Para uma solicitação pendente, use Avaliar, confira o perfil, decida entre Ativo e Rejeitado e registre o motivo.
4. Para usuário cadastrado, use Abrir / editar, confira nome, perfil e situação e registre o motivo da alteração.
5. Use Bloqueado para suspender o acesso sem apagar o histórico. Confirme a decisão.

Consulta não exige unidade no cadastro ou edição: o acesso de consulta é global. Supervisor não pode administrar pares/superiores nem atribuir Supervisor ou Administrador. Os demais perfis não administram usuários.

> Não é permitido alterar o próprio perfil ou situação de acesso. O sistema preserva pelo menos um Administrador ativo.

## 12. Unidades receptoras e destinos antigos

Seleção do destino físico correto e preservação de registros legados.

No carregamento, escolha a unidade e o setor exatos no menu Unidade / destino. Essa seleção identifica o caminho de recebimento do produto. Confira o destino antes de emitir o laudo.

As opções disponíveis abaixo são lidas do mesmo cadastro utilizado no formulário de carregamento. Na versão baixada pelo botão da ajuda, a relação corresponde ao cadastro carregado naquele momento.

> Um registro antigo que diga somente Itapetininga ou Uberaba não permite identificar MDF, MDP ou Revestidos com segurança. Preserve o texto original; não complete um setor por suposição. Novos carregamentos devem usar uma opção específica disponível.

## 13. Entender os estados do registro

O que cada situação significa e qual é o próximo passo.

| Estado | Significado | Próximo passo |
| --- | --- | --- |
| Ativo (Ciclo de tanque) | Disponível para operação, respeitando produto ativo e pendências. | Consultar, registrar carregamento ou encerrar conforme a permissão. |
| Encerrado | Uso do ciclo concluído; histórico preservado. | Consultar; não criar novos carregamentos nesse ciclo. |
| Cancelado (Ciclo de tanque) | Cancelamento aprovado para erro de cadastro. | Consultar o histórico; não utilizar para novos carregamentos. |
| Rascunho | Carregamento salvo para continuidade. | Completar dados e análises; emitir ou solicitar autorização. |
| Aguardando autorização | Há decisão necessária ainda pendente. | Aguardar avaliação em Autorizações. |
| Autorizado para emissão | As autorizações necessárias foram concedidas. | Abrir o carregamento e clicar em Emitir laudo. |
| Em correção | Registro devolvido/rejeitado para ajuste. | Corrigir e, se necessário, solicitar nova autorização. |
| Emitido | Certificado gerado e protegido contra edição. | Consultar/imprimir; pedir cancelamento se houver erro. |
| CANCELADO (laudo) | Cancelamento do certificado aprovado. | Preservar o original; emitir registro correto separadamente. |
| Inativo | Produto ou tanque indisponível para novos usos. | Consultar histórico; solicitar avaliação do Administrador. |
| Cancelamento pendente | Solicitação enviada e ainda não decidida. | Acompanhar Autorizações; o registro ainda não foi cancelado. |
| Substituída (autorização) | Pendência invalidada por mudança/devolução do registro. | Consultar o histórico e avaliar a solicitação atual. |

## 14. Resolver dúvidas e erros comuns

Mensagens, campos obrigatórios, permissões e dados não salvos.

- Campo obrigatório ou análise não preenchida: leia a mensagem, use Ir para o primeiro campo quando disponível e complete os campos destacados.
- Resultado numérico inválido: confira o valor e a unidade. Números aceitam vírgula ou ponto decimal; não substitua um resultado por texto numérico inválido.
- Solicitar autorização aparece no lugar de Emitir laudo: confira os motivos. O uso das referências e a não conformidade podem exigir aprovações diferentes.
- Autorização aprovada, mas falta liberar emissão: confira se existe outro tipo de aprovação pendente e se a decisão corresponde à versão atual dos dados. Atualize a página somente após salvar seus dados.
- Encerrar ciclo indisponível: confira seu perfil e as pendências de carregamentos ou cancelamento.
- Cancelamento de ciclo bloqueado: qualquer carregamento vinculado impede essa ação; não apague ou altere vínculos para contornar a regra.
- Produto duplicado: abra o existente pela ação apresentada. Evite criar variações do código para representar o mesmo produto.
- Produto/tanque não aparece na seleção: confira atividade, compatibilidade da família e disponibilidade do tanque.
- Histórico não encontrado: remova filtros e confira período, status e referência do objeto.
- Falha ao salvar ou carregar: mantenha a tela aberta, confira a conexão e leia a mensagem. Antes de repetir uma emissão, consulte se o laudo já foi gerado para evitar um novo registro indevido.
- Botão de administração/autorização ausente: confira o perfil e o estado do registro. Procure Supervisor/Administrador para avaliar o acesso necessário.

Se o problema persistir, informe ao responsável pelo sistema a tela, o ID/número do registro, a ação realizada, a mensagem exibida e o horário aproximado. Nunca compartilhe sua senha.

## 15. Preservar a rastreabilidade

Boas práticas ao registrar, autorizar e corrigir.

- Registre quem realizou as análises, os valores reais, a data/hora correta e a unidade receptora específica.
- Explique o motivo das solicitações e a justificativa das decisões de forma suficiente para uma consulta futura.
- Consulte as versões e o histórico em vez de substituir dados antigos.
- Cancelamento não é exclusão; inativação não remove registros históricos.
- Não trate uma autorização concedida como emissão automática nem um cancelamento solicitado como cancelamento concluído.
- No manual, Imprimir / salvar PDF imprime o conteúdo completo; a busca apenas facilita a leitura na tela. Baixar manual gera uma cópia para consulta offline.
