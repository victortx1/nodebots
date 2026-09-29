# NodeBots — painel administrativo

Foi adicionado somente o sistema administrativo, sem alterar os arquivos existentes do projeto original.

## Novo acesso

Abra:

`admin.html`

O painel só libera o conteúdo se o usuário autenticado estiver cadastrado em:

`admins/{email}`

com:

`ativo: true`

## O que o painel faz

- Lista todas as conversas de `conversas`.
- Permite ao administrador abrir e ler todas as mensagens.
- Permite responder o cliente pelo próprio painel.
- Permite assumir uma conversa.
- Registra `atendimentoStatus`, `atendidoPorId`, `atendidoPorEmail`, `atendidoPorNome` e `atendidoEm`.
- Permite liberar uma conversa que o próprio administrador assumiu.
- Impede que um administrador assuma uma conversa já assumida por outro administrador.
- A proteção real continua sendo feita pelas regras do Cloud Firestore existentes.

## Firebase

O projeto já tinha a coleção `admins` e as regras necessárias para administrador. Por isso não foi necessário substituir o `firestore.rules`.

Importante: a segurança não depende apenas de esconder o painel. As regras do Firestore continuam sendo a barreira que impede usuários comuns de lerem todas as conversas.


## Autorização do administrador

O `admin.html` usa o Gmail da sessão atual do Firebase Authentication, normaliza o endereço para minúsculas e verifica `admins/<gmail>` com `ativo: true`. O documento existente `admins/victoj796@gmail.com` continua sendo a autorização do administrador.
