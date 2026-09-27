# Configuração do Supabase

1. No Supabase, abra **SQL Editor**, execute o conteúdo de `supabase/schema.sql` e confirme que as tabelas e funções foram criadas.
2. Em **Project Settings > API**, copie a chave **publishable** (ou a chave legada `anon`) para `anonKey` em `js/supabase-config.js`. A Project URL já está preenchida.
3. Em **Authentication > Users**, crie o usuário administrador com o e-mail e a senha escolhidos. O nome em **User Metadata** pode incluir `display_name: Beatriz`; sem esse campo, a saudação usa a parte do e-mail antes de `@`.
4. Para importar os registros existentes, faça o primeiro login pelo mesmo endereço da página que já era usado antes da migração, para que o navegador consiga ler o `localStorage` antigo. Se essa origem não tiver os dados, a importação não será marcada como concluída e poderá ser tentada depois pela origem original.
5. Entre com o usuário criado. Quando encontrados, clientes, doces e compras locais são importados uma única vez. A senha antiga fixa não é reutilizada automaticamente; cadastre a nova senha diretamente no Supabase.
6. Depois de confirmar os dados no Supabase, você pode servir a pasta por HTTP/HTTPS. Por exemplo, no PowerShell, dentro da pasta do projeto: `python -m http.server 8000`; depois acesse `http://localhost:8000`.

A chave publishable/anon é feita para uso no navegador, mas as políticas RLS do SQL são obrigatórias. Nunca coloque uma chave `service_role` neste projeto. A aplicação não grava mais clientes, doces, compras ou pagamentos no `localStorage`; o SDK do Supabase mantém somente a sessão de autenticação no navegador.
