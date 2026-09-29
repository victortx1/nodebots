CORREÇÃO DO CHAT NODEBOTS

Esta versão corrige o erro de carregamento causado por consultas que dependiam de índice composto.

1. O cliente lista somente conversas cujo usuarioId é o UID dele.
2. O administrador autorizado pelo documento admins/<GMAIL> com ativo:true lista todas as conversas.
3. A ordenação agora é feita no navegador, evitando índice composto.
4. As mensagens também são ordenadas no navegador.
5. Um cliente não consegue abrir uma conversa de outro cliente: o código verifica o usuarioId e as Rules também bloqueiam.
6. O Gmail autorizado continua sendo administrador automaticamente.
7. Novas mensagens continuam atualizando atualizadoEm e ultimaMensagem.
8. A coleção notificacoes_admin registra a nova mensagem para posterior envio por e-mail.

IMPORTANTE:
Se o arquivo firestore.rules deste ZIP ainda não estiver publicado no Firebase Console, publique-o em Firestore > Regras > Publicar. O código do site sozinho não consegue alterar as regras do seu projeto Firebase.

Não apague as conversas antigas.
