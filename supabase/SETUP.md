# Configuração do Supabase

1. No Supabase, abra **SQL Editor** e execute o conteúdo atualizado de `supabase/schema.sql`. Isso promove a conta Beatriz já existente a administradora, configura novas contas como visualizadoras e libera a leitura compartilhada do sistema. O script também atualiza as políticas e funções existentes; ele não cria contas nem altera senhas.
2. Em **Project Settings > API**, copie a chave **publishable** (ou a chave legada `anon`) para `anonKey` em `js/supabase-config.js`. A Project URL já está preenchida.
3. Em **Authentication > Users**, confirme que a conta `beatriz@admin.com` existe. O script promove essa conta a administradora. Em **User Metadata**, o nome pode ser definido como `display_name: Beatriz`; sem esse campo, a saudação usa a parte do e-mail antes de `@`.
4. Para criar contas de consulta, adicione usuários em **Authentication > Users**. O trigger atribui automaticamente o papel `viewer`; eles compartilham os mesmos dados, mas não podem inserir, editar, excluir ou registrar pagamentos. Não promova outras contas a `admin` sem necessidade.
5. Para importar os registros existentes, faça o primeiro login de Beatriz pelo mesmo endereço da página usado anteriormente, para que o navegador consiga ler o `localStorage` antigo. Se essa origem não tiver os dados, a importação não será marcada como concluída e poderá ser tentada depois pela origem original.
6. Entre com o e-mail e a senha criados no Supabase. Quando encontrados, clientes, doces e compras locais são importados uma única vez. A senha antiga fixa não é reutilizada automaticamente.
7. Depois de confirmar os dados no Supabase, você pode servir a pasta por HTTP/HTTPS. Por exemplo, no PowerShell, dentro da pasta do projeto: `python -m http.server 8000`; depois acesse `http://localhost:8000`.

A chave publishable/anon é feita para uso no navegador, mas as políticas RLS do SQL são obrigatórias. Nunca coloque uma chave `service_role` neste projeto. A aplicação não grava mais clientes, doces, compras ou pagamentos no `localStorage`; o SDK do Supabase mantém somente a sessão de autenticação no navegador.
