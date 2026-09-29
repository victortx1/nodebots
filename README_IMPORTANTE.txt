NODEBOTS — CORREÇÃO DO ACEITE DOS TERMOS

1) Substitua os arquivos antigos pelos arquivos desta pasta.
2) No Firebase Console, abra Firestore Database > Rules.
3) Cole/publice o conteúdo de firestore.rules desta pasta.
4) O usuário verá o aviso de termos antes de usar o site.
5) O aceite é feito uma única vez por versão dos termos.
6) Antes do login, o navegador guarda o aceite localmente.
7) Depois do login, o aceite é sincronizado automaticamente com:
   usuarios/{UID}
8) Chat e conversas também são protegidos pelas regras do Firestore.
9) O botão do Discord está protegido pelo mesmo aceite. Para abrir um
   convite real, coloque o convite no atributo data-discord-url do botão.

IMPORTANTE:
- Não apague o projeto Firebase.
- Se alterar os termos no futuro, troque VERSAO_TERMOS em
  termos-consentimento.js para forçar um novo aceite.
