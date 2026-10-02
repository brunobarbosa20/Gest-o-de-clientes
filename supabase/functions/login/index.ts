import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function responder(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return responder({ error: 'method_not_allowed' }, 405);
  }

  let email: string;
  let password: string;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return responder({ error: 'invalid_request' }, 400);
  }

  if (!email || email.length > 320 || !password || password.length > 1024) {
    return responder({ error: 'invalid_request' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Required Supabase environment variables are not configured.');
    return responder({ error: 'service_unavailable' }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const { data: lockSeconds, error: lockError } = await adminClient
      .rpc('get_login_lock_seconds', { p_email: email });
    if (lockError) throw lockError;

    if (lockSeconds > 0) {
      return responder({ error: 'invalid_credentials', retryAfter: lockSeconds }, 429);
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const authBody = await authResponse.json();

    if (!authResponse.ok) {
      const credenciaisInvalidas = authBody.code === 'invalid_credentials'
        || authBody.error_code === 'invalid_credentials'
        || authBody.message === 'Invalid login credentials'
        || authBody.msg === 'Invalid login credentials';

      if (credenciaisInvalidas) {
        const { data: retryAfter, error: recordError } = await adminClient
          .rpc('record_login_failure', { p_email: email });
        if (recordError) throw recordError;

        return responder(
          { error: 'invalid_credentials', ...(retryAfter > 0 ? { retryAfter } : {}) },
          retryAfter > 0 ? 429 : 401
        );
      }

      if (authResponse.status >= 500) {
        console.error('Supabase Auth returned an unexpected server error:', authResponse.status);
        return responder({ error: 'service_unavailable' }, 502);
      }

      return responder({ error: 'invalid_credentials' }, 401);
    }

    if (!authBody.access_token || !authBody.refresh_token || !authBody.user?.id) {
      console.error('Supabase Auth returned an incomplete session response.');
      return responder({ error: 'service_unavailable' }, 502);
    }

    const { error: resetError } = await adminClient
      .rpc('reset_login_failures', { p_user_id: authBody.user.id });
    if (resetError) throw resetError;

    return responder(authBody, 200);
  } catch (error) {
    console.error('Login function failed:', error);
    return responder({ error: 'service_unavailable' }, 500);
  }
});
