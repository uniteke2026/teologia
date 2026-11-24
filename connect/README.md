# UNITEKE Connect — Supabase + GitHub Pages

Projeto Supabase: `mlnwcpbeqianfnymfvsh`. A pasta `site/` contém a vitrine, o logotipo oficial, a configuração com a chave **publishable** e o painel admin. Nenhuma chave secreta deve ser adicionada ao GitHub. Os arquivos SQL e a Edge Function não fazem parte do site público.

## 1. Criar banco e bucket
No [SQL Editor](https://supabase.com/dashboard/project/mlnwcpbeqianfnymfvsh/sql/new), cole todo o conteúdo de `01-banco.sql` e clique Run. O script cria quatro tabelas `connect_*`, regras de segurança e o bucket privado `connect-banners`. Não altera outras tabelas. Confirme sucesso antes de prosseguir. Execute em projeto de desenvolvimento primeiro se este projeto já tiver dados/uso crítico.

## 2. Ativar o backend
No [Edge Functions](https://supabase.com/dashboard/project/mlnwcpbeqianfnymfvsh/functions), crie uma função chamada **connect** pelo editor, substitua o código padrão pelo conteúdo de `supabase/functions/connect/index.ts` e faça deploy. Na configuração da função, desligue a verificação JWT legada (`Verify JWT` / `Enforce JWT Verification`). As operações públicas não exigem login; todas as operações administrativas validam o JWT com Supabase Auth e verificam a tabela de administradores no servidor. Não desligue a verificação de outras funções. A função usa as credenciais secretas predefinidas do ambiente Supabase (SUPABASE_SECRET_KEYS ou SUPABASE_SERVICE_ROLE_KEY); não as copie para o site. Se o dashboard exigir CLI, autentique localmente e execute `supabase functions deploy connect --project-ref mlnwcpbeqianfnymfvsh --no-verify-jwt` a partir da raiz do pacote.

Opcional: na seção Secrets da função, `CONNECT_REQUIRE_APPROVAL=true` deixa novos cadastros ocultos até aprovação; `CONNECT_STUDENT_CODE` habilita um código compartilhado que pode ser divulgado aos alunos. Por padrão, publicação automática e autodeclaração de aluno. `CONNECT_ORIGINS` permite definir as origens HTTPS autorizadas separadas por vírgulas (sem barra ao final). CORS não é autenticação e não bloqueia scripts fora do navegador.

## 3. Criar administrador
Em [Authentication > Users](https://supabase.com/dashboard/project/mlnwcpbeqianfnymfvsh/auth/users), Add user, crie seu próprio e-mail e senha forte (confirme o e-mail no fluxo do painel). Em seguida, abra `02-autorizar-admin.sql`, substitua `SUBSTITUA_PELO_EMAIL_DO_ADMIN` pelo e-mail, execute no SQL Editor. Se o projeto é exclusivo do Connect, desabilite cadastro público de usuários em Auth; não mude isso se o projeto for compartilhado com outros serviços. Não compartilhe sua senha. Para revogar um admin, remova o UUID de `connect_admins` no SQL Editor.

## 4. Publicar site estático
Copie somente o conteúdo da pasta `site/` para a pasta `connect/` do repositório que serve o domínio oficial (ou raiz de um projeto de site independente). Não sobrescreva outras páginas. A URL do painel é `/connect/admin.html`. Ative HTTPS. O arquivo `index.html` aberto diretamente no navegador (`file://`) entra no modo de demonstração local; para testar de verdade, execute `python3 -m http.server 8000 --directory site` e abra `http://localhost:8000`. O painel mantém um token temporário em sessionStorage; ao expirar, entre novamente.

## 5. Homologação antes de anunciar
- Teste cadastrar negócio fictício autorizado e confirmar em outro dispositivo.
- Confira que o nome do aluno não aparece no catálogo nem em suas respostas de rede, e que acesso direto às tabelas e ao bucket com chave pública falha.
- Teste login com usuário não autorizado; deve receber 403. Com admin autorizado, edite, oculte, publique, denuncie, resolva e exclua o anúncio de teste. Confira arquivo removido no Storage.
- Teste banners inválidos, WhatsApp inválido, duplicidade, consentimento, celular e compartilhamento por URL individual. A prévia rica do WhatsApp será genérica (GitHub Pages estático).
- Os banners têm URLs assinadas de 5 minutos, que podem continuar válidas até expirar quando ocultados. Limites globais e por telefone reduzem spam, não comprovam vínculo estudantil e não substituem CAPTCHA; recomendamos código de alunos e/ou aprovação manual antes de abrir a plataforma. O servidor verifica tipo por assinatura e tamanho, não faz antivírus nem reencodifica imagens. Recomende banner sem dados pessoais de terceiros. A consulta tem limite inicial de 500 anúncios públicos/1.000 administrativos; adicionar paginação se crescer. Faça backups e monitore quotas e logs. Eventual falha de limpeza de arquivo precisa revisão manual; não há rotina de limpeza automática. Não há envio automático aos grupos, apenas compartilhamento pelo usuário.

## Status
Código preparado para a URL e chave pública fornecidas. Não foi executado SQL nem implantada função no projeto real. A instalação requer acesso autorizado ao painel. Não há credenciais administrativas embutidas. Testes de sintaxe locais não substituem os testes de integração e de segurança no Supabase real.
