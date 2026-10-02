# Bloqueio de tentativas no login

Para ativar o bloqueio no ambiente Supabase já configurado:

1. No **SQL Editor** do Supabase, execute o conteúdo de `supabase/schema.sql`. Esse script adiciona apenas a tabela e as funções usadas para contar e bloquear tentativas por conta; não altera as demais tabelas existentes.
2. Na pasta do projeto, com o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado e autenticado, publique a Edge Function de login:

   ```powershell
   supabase functions deploy login --no-verify-jwt
   ```

A função usa as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` fornecidas pelo Supabase. A chave `service_role` não deve ser colocada no navegador nem no código do projeto.

Depois dessas etapas, três senhas incorretas para uma conta existente bloqueiam novas tentativas por 20 segundos. O contador é individual por conta; usuários inexistentes não são bloqueados, e um login bem-sucedido zera as tentativas.
