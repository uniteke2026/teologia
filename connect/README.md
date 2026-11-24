# UNITEKE Connect 2.0

Catálogo com dados compartilhados, SQLite, imagens normalizadas, painel administrativo autenticado, moderação e links individuais. Logotipo original extraído do HTML da landing page do Básico. Sem anúncios fictícios na aplicação hospedada. O arquivo index.html aberto diretamente é apenas demonstração local.

## Teste local

1. Python 3.11+; `python -m pip install -r requirements.txt`.
2. Configure usuário por terminal: `python app.py admin secretaria`. Digite uma senha exclusiva (mínimo 12 caracteres); não há senha padrão.
3. Linux/macOS: `CONNECT_SECURE_COOKIE=0 python app.py serve` (Windows PowerShell: `$env:CONNECT_SECURE_COOKIE='0'; python app.py serve`). Abra `http://127.0.0.1:8000/` e `/admin`.
4. O servidor embutido é apenas para testes. Banco em `data/connect.sqlite3`.

## Hospedagem

GitHub Pages sozinho não executa Python ou SQLite. Use hospedagem persistente com Docker/Gunicorn e proxy HTTPS. Se o domínio atual continuar em GitHub Pages sem proxy, prefira `connect.universidadekerigma.com.br` com DNS e certificado TLS (configure CONNECT_PREFIX vazio e CONNECT_PUBLIC_URL com o subdomínio). Para a URL `/connect/`, configure um proxy capaz de encaminhar esse caminho preservando o site principal.

Copie `.env.example` para `.env`, ajuste os valores e execute `docker compose up -d --build`. Configure o administrador com `docker compose exec connect python app.py admin secretaria`. Em produção, mantenha cookies Secure. Exemplo de bloco para Nginx no site HTTPS já configurado (não substitua a configuração do site atual):

```nginx
location = /connect { return 308 /connect/; }
location /connect/ {
    client_max_body_size 7m;
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

O aplicativo limita tentativas por IP observável. Atrás de proxy, configure limites por IP real no próprio proxy (não confie em cabeçalhos arbitrários enviados pelo cliente). Acrescente CAPTCHA/antibot e monitore volume, espaço em disco, abusos e logs antes de divulgação ampla. Não publique a pasta data, o arquivo .env nem o banco de dados. O código de acesso compartilhado reduz cadastros externos, mas não comprova vínculo individual; opcionalmente use revisão manual (`CONNECT_REVIEW=1`) ou integração futura com matrícula. O painel permite publicar e ocultar, editar e excluir, consultar e resolver denúncias. Sessão de 8 horas, senha com scrypt, tokens aleatórios armazenados em hash, proteção CSRF, validação servidor, limitação de tentativas, consentimento com data e trilha de ações. Política de privacidade simplificada precisa de aprovação institucional, incluindo prazo de retenção e canal de atendimento. Não há auditoria independente de segurança.

## Backups

Use `docker compose exec connect python app.py backup /app/data/backup.sqlite3` e copie o backup para local externo protegido, regularmente. Teste restauração em ambiente isolado; não restaure sobre uma aplicação em execução. Para trocar senha, repita o comando admin (invalida sessões existentes). Não compartilhe credenciais no chat ou repositório.

## Testes

`python test_app.py` executa testes de API com banco temporário e sem acesso externo. É necessário testar visualmente em celulares e verificar TLS, proxy, backup e limites no ambiente real antes do lançamento.
