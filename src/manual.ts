export type ManualBlock =
 | {kind:"paragraph"|"note";text:string}
 | {kind:"steps"|"list";items:string[]}
 | {kind:"table";headers:string[];rows:string[][]};
export type ManualSection={id:string;title:string;summary:string;blocks:ManualBlock[]};
export const manualUpdated="05/10/2026";
export const manualSections:ManualSection[]=[
 {id:"senhas",title:"Senhas e recuperação de acesso",summary:"Alterar senha ou solicitar um reset autorizado.",blocks:[
 {kind:"steps",items:["Esqueceu a senha? No login, clique em Esqueci minha senha e informe seu e-mail. A solicitação entrará em Autorizações; nenhum reset automático por e-mail será liberado.","Supervisor ou Administrador confere sua identidade, decide a solicitação e entrega pessoalmente o código de uso único. O Supervisor respeita a hierarquia de usuários; ninguém aprova o próprio reset.","No login, use Já tenho um código autorizado. Informe e-mail, código, Nova senha e Confirmar nova senha. Se entrar com a senha antiga após a aprovação, a definição da nova senha será obrigatória.","O código vale por 24 horas, é bloqueado após 5 tentativas incorretas e não pode ser reutilizado após a conclusão. Para renovar código expirado/bloqueado, procure o responsável.","Conhece a senha atual? Use Alterar senha, junto à sua conta no menu. Informe Senha atual, Nova senha e Confirmar nova senha. Não exige autorização.","Após qualquer troca de senha, as sessões são encerradas. Entre novamente com a nova senha."]},
 {kind:"note",text:"A senha é gerenciada pelo Supabase. Não entregue a nova senha ao responsável e não a registre em justificativas. O histórico guarda somente os eventos de solicitação, decisão e conclusão."}]},
 {id:"tubulacao",title:"Resina para Agudos-MDF2",summary:"Transferência por tubulação e dados de transporte.",blocks:[
 {kind:"paragraph",text:"Quando a família do produto do Ciclo de tanque é Resina e o destino é Agudos-MDF2, transportadora e placa são opcionais. Não preencha N/A ou valores fictícios. A mesma exceção não vale para Emulsão, que continua exigindo os dois campos."},
 {kind:"paragraph",text:"Nas unidades de Agudos, pode ser dispensada a análise do caminhão. A referência do tanque continua existindo e é utilizada; resultados fora da especificação continuam exigindo autorização de exceção."}]},

  {
    "id": "visao-geral",
    "title": "1. Visão geral e fluxo de trabalho",
    "summary": "Do preparo do tanque à consulta do laudo.",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "O Laudos Agudos registra Ciclos de tanques, carregamentos, resultados de análises, autorizações e certificados de qualidade. Use os registros para identificar o produto transferido, a unidade receptora e os responsáveis por cada etapa."
      },
      {
        "kind": "steps",
        "items": [
          "Prepare um Ciclo de tanque: selecione tanque e produto e registre fabricação, lotes, responsável e análises de referência.",
          "Registre o carregamento: confira os dados do caminhão, a unidade receptora e os resultados.",
          "Trate as autorizações necessárias: uso das análises do tanque e resultados fora da especificação podem exigir decisões distintas.",
          "Emita o laudo dentro do carregamento liberado. Consulte e imprima o documento em Laudos."
        ]
      },
      {
        "kind": "note",
        "text": "Salvar rascunho, solicitar autorização e emitir laudo são ações diferentes. Uma autorização aprovada não emite o laudo automaticamente."
      }
    ]
  },
  {
    "id": "acesso",
    "title": "2. Acesso e navegação",
    "summary": "Solicitação de acesso, login e uso do menu.",
    "blocks": [
      {
        "kind": "steps",
        "items": [
          "No login, selecione Ainda não tenho acesso, informe seu nome completo, e-mail e senha e confirme a senha.",
          "Confirme o e-mail quando solicitado. Aguarde um Supervisor ou Administrador avaliar seu cadastro e definir seu perfil.",
          "Entre com seu e-mail e senha. Se o acesso estiver pendente, rejeitado ou bloqueado, procure o responsável pelo sistema.",
          "Use o menu lateral para abrir Início, Ciclos de tanques, Carregamentos, Autorizações e Laudos. Cadastros e Usuários aparecem conforme suas permissões.",
          "Abra Ajuda pelo menu ou pelo botão da tela inicial. A ajuda pode ser consultada sem sair do formulário em andamento.",
          "Ao terminar, use Sair."
        ]
      },
      {
        "kind": "paragraph",
        "text": "Início apresenta o fluxo de trabalho e os acessos às etapas. Os campos com sugestões mostram valores usados anteriormente; selecione uma sugestão ou digite o valor correto. Confira sugestões antes de reutilizá-las."
      },
      {
        "kind": "note",
        "text": "Ao sair de um carregamento com alterações não salvas, o sistema pode pedir confirmação para descartá-las. Use Salvar rascunho antes de mudar de tarefa quando quiser manter o registro."
      }
    ]
  },
  {
    "id": "perfis",
    "title": "3. Perfis e permissões",
    "summary": "Quem registra, autoriza, encerra e administra.",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "A hierarquia é Administrador → Supervisor → Operador Técnico → Operador → Consulta. As funções de cada perfil são explícitas; estar acima na hierarquia não substitui a regra da ação. Botões podem ficar ocultos ou desabilitados conforme o perfil, o estado do registro ou uma dependência."
      },
      {
        "kind": "table",
        "headers": [
          "Ação",
          "Administrador",
          "Supervisor",
          "Operador Técnico",
          "Operador",
          "Consulta"
        ],
        "rows": [
          [
            "Criar Ciclo de tanque e carregamento",
            "Sim",
            "Sim",
            "Sim",
            "Sim",
            "Não"
          ],
          [
            "Editar rascunho / Em correção e emitir laudo",
            "Sim",
            "Sim",
            "Sim",
            "Sim",
            "Não"
          ],
          [
            "Solicitar autorizações e cancelamentos",
            "Sim",
            "Sim",
            "Sim",
            "Sim",
            "Não"
          ],
          [
            "Autorizar uso das análises do tanque",
            "Sim",
            "Sim",
            "Sim",
            "Não",
            "Não"
          ],
          [
            "Autorizar exceção de especificação",
            "Sim",
            "Sim",
            "Não",
            "Não",
            "Não"
          ],
          [
            "Decidir cancelamento / encerrar Ciclo de tanque",
            "Sim",
            "Sim",
            "Sim",
            "Não",
            "Não"
          ],
          [
            "Criar, editar e inativar produtos / administrar tanques",
            "Sim",
            "Não",
            "Não",
            "Não",
            "Não"
          ],
          [
            "Administrar usuários",
            "Todos",
            "Somente perfis inferiores",
            "Não",
            "Não",
            "Não"
          ],
          [
            "Consultar laudos emitidos / cancelados",
            "Sim",
            "Sim",
            "Sim",
            "Sim",
            "Todas as unidades"
          ]
        ]
      },
      {
        "kind": "paragraph",
        "text": "Consulta não visualiza rascunhos. Pode consultar laudos emitidos e cancelados de todas as unidades e os Ciclos de tanques relacionados a esses documentos. Os demais perfis consultam os registros operacionais e o histórico de autorizações."
      },
      {
        "kind": "note",
        "text": "Nenhum perfil pode editar silenciosamente um laudo já emitido ou cancelado. Corrigir um laudo emitido exige cancelamento autorizado e novo registro correto."
      }
    ]
  },
  {
    "id": "ciclos",
    "title": "4. Criar e consultar Ciclos de tanques",
    "summary": "Referências, especificações, cards ativos e histórico.",
    "blocks": [
      {
        "kind": "steps",
        "items": [
          "Abra Ciclos de tanques e clique em Novo Ciclo de tanque.",
          "Escolha um tanque ativo e disponível. Um tanque não pode ter dois Ciclos de tanques ativos ao mesmo tempo.",
          "Selecione um produto ativo compatível com a família do tanque. Confira a versão e as especificações apresentadas.",
          "Informe data/hora da fabricação, lotes e responsável pelas análises.",
          "Registre os valores de referência. As especificações aparecem junto às análises; preencha todas as obrigatórias e use valores numéricos válidos quando exigidos. Um resultado fora da especificação destaca o campo em vermelho com a indicação Fora da especificação; o destaque desaparece ao corrigir o valor.",
          "Clique em Criar Ciclo de tanque. Se houver erro, confira os campos destacados e a mensagem visível.",
          "Nos cards ativos, use o ícone de olho para consultar dados, referências, especificações, histórico e carregamentos vinculados. Use Novo carregamento para iniciar uma transferência desse ciclo."
        ]
      },
      {
        "kind": "paragraph",
        "text": "Os ativos têm prioridade visual em cards. Ciclos de tanques encerrados e cancelados ficam na lista histórica e continuam consultáveis. Use busca, status, tanque, produto e período para localizar o registro."
      },
      {
        "kind": "note",
        "text": "A versão e as especificações do produto são preservadas no Ciclo de tanque. Uma alteração posterior do cadastro não muda seus dados nem os laudos associados."
      }
    ]
  },
  {
    "id": "encerramento-cancelamento",
    "title": "5. Encerrar ou cancelar um Ciclo de tanque",
    "summary": "Encerramento operacional e correção de cadastro são ações distintas.",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Encerrar conclui o uso operacional do Ciclo de tanque. Cancelar registra um erro de cadastro, com solicitação e decisão formal. As duas ações preservam o histórico."
      },
      {
        "kind": "steps",
        "items": [
          "Para encerrar: um Operador Técnico, Supervisor ou Administrador abre o ciclo ativo e usa Encerrar ciclo.",
          "Confira se não há carregamentos em Rascunho, Aguardando autorização ou Em correção. Resolva também eventual cancelamento pendente antes de encerrar.",
          "Confirme o encerramento. O registro passa para Encerrado e deixa de ser opção para novos carregamentos.",
          "Para cancelar um cadastro incorreto: consulte o ciclo ativo e clique no círculo com X, Solicitar cancelamento.",
          "Descreva o motivo obrigatório e envie a solicitação. Um Operador Técnico ou superior decide em Autorizações, com justificativa.",
          "Após aprovação, o registro fica Cancelado. Se a solicitação for rejeitada, o ciclo continua com seu estado anterior; a decisão permanece no histórico."
        ]
      },
      {
        "kind": "note",
        "text": "Qualquer carregamento vinculado impede o cancelamento do Ciclo de tanque, mesmo se esse carregamento estiver cancelado. Durante um cancelamento pendente, novos carregamentos ficam bloqueados. O sistema não exclui vínculos nem reabre ciclos automaticamente."
      }
    ]
  },
  {
    "id": "carregamentos",
    "title": "6. Registrar carregamentos e análises",
    "summary": "Dados do caminhão, destino, origem dos resultados e rascunho.",
    "blocks": [
      {
        "kind": "steps",
        "items": [
          "Abra Novo carregamento em Carregamentos ou no card do Ciclo de tanque correspondente.",
          "Confira o ciclo, o produto e a data/hora. Só é possível criar carregamentos em ciclos ativos com produto ativo.",
          "Informe placa, selecione a carreta, preencha transportadora e selecione a unidade / destino exatos.",
          "Confira o nome do responsável que realizou as análises. Não mantenha um valor sugerido se ele não corresponder ao responsável real.",
          "Confira o resumo do tanque selecionado: produto/tipo, lotes e fabricação. Para resinas com mais de 120 horas desde a fabricação, aparece um aviso de idade que não impede a emissão. Escolha a origem dos resultados: Análise do caminhão para registrar resultados próprios, ou análises do tanque para usar as referências do ciclo.",
          "Preencha os resultados e compare cada valor com sua especificação. Campos aplicáveis oferecem sugestões de valores anteriores.",
          "Inclua observações pertinentes e use Salvar rascunho para continuar depois.",
          "Quando os dados estiverem completos, use Emitir laudo ou Solicitar autorização, conforme a ação apresentada à direita. No desktop, o painel de ações acompanha a rolagem; no mobile, utilize a barra de ações. Resultados fora da especificação recebem destaque vermelho durante o preenchimento, sem alterar o valor informado."
        ]
      },
      {
        "kind": "paragraph",
        "text": "Rascunhos podem manter análises ainda não concluídas, mas os dados obrigatórios do carregamento continuam sendo validados. A emissão e a solicitação de autorização exigem as análises obrigatórias completas e válidas."
      },
      {
        "kind": "note",
        "text": "Os valores sugeridos não são resultados novos de análise. Registre os resultados efetivamente obtidos. Uma unidade genérica antiga deve ser preservada no histórico, sem inventar um setor."
      }
    ]
  },
  {
    "id": "autorizacoes",
    "title": "7. Solicitar e decidir autorizações",
    "summary": "Uso de referências, exceções, cancelamentos e histórico.",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "A necessidade de autorização é informada com seu motivo. Usar as análises do tanque exige aprovação de Operador Técnico ou superior, exceto para Agudos - MDF1, Agudos - MDF2 e Agudos - Revestidos. Nesses três destinos o reaproveitamento é dispensado de autorização. Um resultado fora da especificação exige aprovação de Supervisor ou Administrador. O mesmo carregamento pode exigir ambas."
      },
      {
        "kind": "steps",
        "items": [
          "No carregamento, confira os motivos apresentados e clique em Solicitar autorização.",
          "Acompanhe o estado Aguardando autorização. O responsável deve abrir Autorizações e conferir o registro, os resultados e os motivos.",
          "Para referência, use Autorizar referência ou Devolver. Para exceção, use Autorizar exceção ou Rejeitar. Registre a justificativa obrigatória.",
          "Cancelamentos pendentes aparecem em sua seção própria, com Abrir registro, Autorizar e Rejeitar para os perfis habilitados.",
          "Após todas as aprovações necessárias, o carregamento aparece como Autorizado para emissão. Abra-o e clique em Emitir laudo.",
          "Se for devolvido/rejeitado para correção, revise o registro em Em correção e envie nova solicitação quando necessário.",
          "Consulte o Histórico de autorizações para ver solicitante, motivo, decisor, justificativa, datas e o objeto relacionado. Use os filtros de decisão, tipo, período e busca."
        ]
      },
      {
        "kind": "note",
        "text": "Uma autorização vale para a versão dos dados que foi avaliada. Alterar um carregamento em correção pode exigir nova autorização. Decisões anteriores permanecem no histórico; uma pendência invalidada pode aparecer como Substituída."
      }
    ]
  },
  {
    "id": "laudos",
    "title": "8. Emitir, consultar e imprimir laudos",
    "summary": "Conferência final e acesso ao certificado.",
    "blocks": [
      {
        "kind": "steps",
        "items": [
          "Abra o carregamento e confira produto, versão, lotes, placa, carreta, transportadora, destino, responsável e resultados.",
          "Confirme que não há análises obrigatórias faltantes ou inválidas e que todas as autorizações exigidas foram concedidas.",
          "Clique em Emitir laudo. A emissão ocorre dentro do carregamento.",
          "Abra Laudos e busque pelo número do documento, placa ou destino. Clique no registro ou em Abrir.",
          "Confira resultados, especificações e situação de cada variável, responsável pelas análises e, quando aplicável, responsável e justificativa da autorização.",
          "Use Imprimir laudo. No diálogo do navegador, selecione a impressora ou Salvar como PDF, conforme disponível."
        ]
      },
      {
        "kind": "paragraph",
        "text": "O documento emitido é preservado. A edição futura de um produto não deve alterar o nome, a versão ou as especificações associados ao registro. Para dados antigos, informações não registradas podem permanecer indicadas como desconhecidas."
      },
      {
        "kind": "note",
        "text": "Consulta tem acesso aos laudos disponíveis de todas as unidades, inclusive os cancelados. Um laudo com identificação CANCELADO é histórico e não representa um documento vigente."
      }
    ]
  },
  {
    "id": "cancelamento-laudo",
    "title": "9. Corrigir um laudo já emitido",
    "summary": "Cancelar o original, preservar o histórico e emitir o registro correto.",
    "blocks": [
      {
        "kind": "steps",
        "items": [
          "Abra o laudo emitido e use Solicitar cancelamento.",
          "Informe o erro operacional e o motivo obrigatório. Envie a solicitação.",
          "Um Operador Técnico, Supervisor ou Administrador confere o original e decide o cancelamento em Autorizações, com justificativa.",
          "Se aprovado, o laudo fica identificado como CANCELADO e mantém os dados, o número e os responsáveis originais. Solicitante, autorizador, motivos e datas ficam disponíveis.",
          "Crie um novo carregamento com os dados corretos em um Ciclo de tanque ativo e adequado. Faça as análises e solicitações necessárias e emita o novo laudo.",
          "Se o cancelamento for rejeitado, o documento continua Emitido. A solicitação e a decisão permanecem no histórico."
        ]
      },
      {
        "kind": "note",
        "text": "Não é permitido editar ou reemitir o próprio registro cancelado. Se o ciclo já estiver encerrado ou não houver ciclo ativo adequado, alinhe a regularização com o Operador Técnico/Supervisor; não há reabertura automática."
      }
    ]
  },
  {
    "id": "produtos-tanques",
    "title": "10. Administrar produtos e tanques",
    "summary": "Cadastros, versões, duplicidade e inativação.",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "Cadastros é uma área do Administrador. Produtos e tanques precisam estar ativos e compatíveis para abrir novos Ciclos de tanques."
      },
      {
        "kind": "steps",
        "items": [
          "Para produto: informe código único, descrição, família e análises. Configure nomes, unidades, obrigatoriedade e limites mínimo/máximo para análises numéricas. Para critérios qualitativos já cadastrados, confira as opções em Detalhes / versões; a tela atual não oferece campo para editar essas opções.",
          "Salve o produto. Se o código já existir, use Abrir / editar produto existente e confira se é o cadastro correto.",
          "Na lista, busque por código ou descrição e filtre a situação. Use Editar para alterar o produto e Salvar nova versão para confirmar.",
          "Use Detalhes / versões para consultar dados, autor, data e mudanças. Cada edição gera uma nova versão; os registros anteriores ficam associados aos dados originais.",
          "Use Inativar quando o produto não deva ser escolhido para novos registros. O histórico permanece; não há exclusão destrutiva de produto.",
          "Para tanque: informe código e família e cadastre. Use o lápis para editar e confira sua situação Ativo/Inativo.",
          "Tanques com Ciclos de tanques associados não podem ser excluídos; use a edição para desativá-los quando necessário."
        ]
      },
      {
        "kind": "note",
        "text": "Inativar um produto bloqueia novos Ciclos de tanques e novos carregamentos com esse produto. Carregamentos já existentes conservam seus dados e regras. Versões capturadas de legado podem não ter autor ou data original conhecidos."
      }
    ]
  },
  {
    "id": "usuarios",
    "title": "11. Aprovar e administrar usuários",
    "summary": "Pendências, edição, bloqueio e limites da hierarquia.",
    "blocks": [
      {
        "kind": "steps",
        "items": [
          "Abra Usuários. Administrador visualiza todos; Supervisor visualiza e administra somente perfis abaixo de Supervisor.",
          "Localize o cadastro por nome/e-mail, perfil ou situação.",
          "Para uma solicitação pendente, use Avaliar, confira o perfil, decida entre Ativo e Rejeitado e registre o motivo.",
          "Para usuário cadastrado, use Abrir / editar, confira nome, perfil e situação e registre o motivo da alteração.",
          "Use Bloqueado para suspender o acesso sem apagar o histórico. Confirme a decisão."
        ]
      },
      {
        "kind": "paragraph",
        "text": "Consulta não exige unidade no cadastro ou edição: o acesso de consulta é global. Supervisor não pode administrar pares/superiores nem atribuir Supervisor ou Administrador. Os demais perfis não administram usuários."
      },
      {
        "kind": "note",
        "text": "Não é permitido alterar o próprio perfil ou situação de acesso. O sistema preserva pelo menos um Administrador ativo."
      }
    ]
  },
  {
    "id": "unidades",
    "title": "12. Unidades receptoras e destinos antigos",
    "summary": "Seleção do destino físico correto e preservação de registros legados.",
    "blocks": [
      {
        "kind": "paragraph",
        "text": "No carregamento, escolha a unidade e o setor exatos no menu Unidade / destino. Essa seleção identifica o caminho de recebimento do produto. Confira o destino antes de emitir o laudo."
      },
      {
        "kind": "paragraph",
        "text": "As opções disponíveis abaixo são lidas do mesmo cadastro utilizado no formulário de carregamento. Na versão baixada pelo botão da ajuda, a relação corresponde ao cadastro carregado naquele momento."
      },
      {
        "kind": "note",
        "text": "Um registro antigo que diga somente Itapetininga ou Uberaba não permite identificar MDF, MDP ou Revestidos com segurança. Preserve o texto original; não complete um setor por suposição. Novos carregamentos devem usar uma opção específica disponível."
      }
    ]
  },
  {
    "id": "estados",
    "title": "13. Entender os estados do registro",
    "summary": "O que cada situação significa e qual é o próximo passo.",
    "blocks": [
      {
        "kind": "table",
        "headers": [
          "Estado",
          "Significado",
          "Próximo passo"
        ],
        "rows": [
          [
            "Ativo (Ciclo de tanque)",
            "Disponível para operação, respeitando produto ativo e pendências.",
            "Consultar, registrar carregamento ou encerrar conforme a permissão."
          ],
          [
            "Encerrado",
            "Uso do ciclo concluído; histórico preservado.",
            "Consultar; não criar novos carregamentos nesse ciclo."
          ],
          [
            "Cancelado (Ciclo de tanque)",
            "Cancelamento aprovado para erro de cadastro.",
            "Consultar o histórico; não utilizar para novos carregamentos."
          ],
          [
            "Rascunho",
            "Carregamento salvo para continuidade.",
            "Completar dados e análises; emitir ou solicitar autorização."
          ],
          [
            "Aguardando autorização",
            "Há decisão necessária ainda pendente.",
            "Aguardar avaliação em Autorizações."
          ],
          [
            "Autorizado para emissão",
            "As autorizações necessárias foram concedidas.",
            "Abrir o carregamento e clicar em Emitir laudo."
          ],
          [
            "Em correção",
            "Registro devolvido/rejeitado para ajuste.",
            "Corrigir e, se necessário, solicitar nova autorização."
          ],
          [
            "Emitido",
            "Certificado gerado e protegido contra edição.",
            "Consultar/imprimir; pedir cancelamento se houver erro."
          ],
          [
            "CANCELADO (laudo)",
            "Cancelamento do certificado aprovado.",
            "Preservar o original; emitir registro correto separadamente."
          ],
          [
            "Inativo",
            "Produto ou tanque indisponível para novos usos.",
            "Consultar histórico; solicitar avaliação do Administrador."
          ],
          [
            "Cancelamento pendente",
            "Solicitação enviada e ainda não decidida.",
            "Acompanhar Autorizações; o registro ainda não foi cancelado."
          ],
          [
            "Substituída (autorização)",
            "Pendência invalidada por mudança/devolução do registro.",
            "Consultar o histórico e avaliar a solicitação atual."
          ]
        ]
      }
    ]
  },
  {
    "id": "problemas",
    "title": "14. Resolver dúvidas e erros comuns",
    "summary": "Mensagens, campos obrigatórios, permissões e dados não salvos.",
    "blocks": [
      {
        "kind": "list",
        "items": [
          "Campo obrigatório ou análise não preenchida: leia a mensagem, use Ir para o primeiro campo quando disponível e complete os campos destacados.",
          "Resultado numérico inválido: confira o valor e a unidade. Números aceitam vírgula ou ponto decimal; não substitua um resultado por texto numérico inválido.",
          "Solicitar autorização aparece no lugar de Emitir laudo: confira os motivos. O uso das referências e a não conformidade podem exigir aprovações diferentes.",
          "Autorização aprovada, mas falta liberar emissão: confira se existe outro tipo de aprovação pendente e se a decisão corresponde à versão atual dos dados. Atualize a página somente após salvar seus dados.",
          "Encerrar ciclo indisponível: confira seu perfil e as pendências de carregamentos ou cancelamento.",
          "Cancelamento de ciclo bloqueado: qualquer carregamento vinculado impede essa ação; não apague ou altere vínculos para contornar a regra.",
          "Produto duplicado: abra o existente pela ação apresentada. Evite criar variações do código para representar o mesmo produto.",
          "Produto/tanque não aparece na seleção: confira atividade, compatibilidade da família e disponibilidade do tanque.",
          "Histórico não encontrado: remova filtros e confira período, status e referência do objeto.",
          "Falha ao salvar ou carregar: mantenha a tela aberta, confira a conexão e leia a mensagem. Antes de repetir uma emissão, consulte se o laudo já foi gerado para evitar um novo registro indevido.",
          "Botão de administração/autorização ausente: confira o perfil e o estado do registro. Procure Supervisor/Administrador para avaliar o acesso necessário."
        ]
      },
      {
        "kind": "paragraph",
        "text": "Se o problema persistir, informe ao responsável pelo sistema a tela, o ID/número do registro, a ação realizada, a mensagem exibida e o horário aproximado. Nunca compartilhe sua senha."
      }
    ]
  },
  {
    "id": "rastreabilidade",
    "title": "15. Preservar a rastreabilidade",
    "summary": "Boas práticas ao registrar, autorizar e corrigir.",
    "blocks": [
      {
        "kind": "list",
        "items": [
          "Registre quem realizou as análises, os valores reais, a data/hora correta e a unidade receptora específica.",
          "Explique o motivo das solicitações e a justificativa das decisões de forma suficiente para uma consulta futura.",
          "Consulte as versões e o histórico em vez de substituir dados antigos.",
          "Cancelamento não é exclusão; inativação não remove registros históricos.",
          "Não trate uma autorização concedida como emissão automática nem um cancelamento solicitado como cancelamento concluído.",
          "No manual, Imprimir / salvar PDF imprime o conteúdo completo; a busca apenas facilita a leitura na tela. Baixar manual gera uma cópia para consulta offline."
        ]
      }
    ]
  }
];
export function manualSectionText(section:ManualSection):string {
 return [section.title,section.summary,...section.blocks.flatMap(block=>
  "text" in block?[block.text]:"items" in block?block.items:[...block.headers,...block.rows.flat()])].join(" ");
}
export function normalizeManualSearch(value:string):string {
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
}
export function buildManualMarkdown(sections:readonly ManualSection[]=manualSections):string {
 const lines=["# Laudos Agudos — Manual operacional","","Fábricas Químicas - Agudos","Atualizado em "+manualUpdated,""];
 for(const section of sections){
  lines.push("## "+section.title,"",section.summary,"");
  for(const block of section.blocks){
   if("text" in block)lines.push(block.kind==="note"?"> "+block.text:block.text,"");
   else if("items" in block)lines.push(...block.items.map((item,i)=>(block.kind==="steps"?(i+1)+". ":"- ")+item),"");
   else{
    const row=(cells:string[])=>"| "+cells.map(cell=>cell.replace(/\|/g,"\\|").replace(/\n/g," ")).join(" | ")+" |";
    lines.push(row(block.headers),row(block.headers.map(()=>"---")),...block.rows.map(row),"");
   }
  }
 }
 return lines.join("\n");
}
