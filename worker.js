// ════════════════════════════════════════════════════════════════
// KRATOS AI — Cloudflare Worker
// Deploy: wrangler deploy
// ════════════════════════════════════════════════════════════════

// Env vars (set in wrangler.toml or Cloudflare dashboard):
// STRIPE_SK       — Stripe secret key
// SUPABASE_URL    — https://tzkokgpxqjeyuvyvmqtt.supabase.co
// SUPABASE_SK     — Supabase service_role key
// AI_MODEL        — e.g. @cf/meta/llama-3-8b-instruct (Cloudflare AI)
// OPENAI_KEY      — optional, for GPT-4 fallback

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // ── AI PROXY ─────────────────────────────────────────────
    if (path === '/ai/chat') {
      return handleAIChat(request, env);
    }

    // ── STRIPE ENDPOINTS ─────────────────────────────────────
    if (path === '/stripe/connect')          return handleStripeConnect(request, env);
    if (path === '/stripe/status')           return handleStripeStatus(request, env);
    if (path === '/stripe/checkout')         return handleStripeCheckout(request, env);
    if (path === '/stripe/webhook')          return handleStripeWebhook(request, env);
    if (path === '/stripe/coach-subscribe')  return handleCoachSubscribe(request, env);
    if (path === '/stripe/coach-cancel')     return handleCoachCancel(request, env);
    if (path === '/stripe/athlete-premium')  return handleAthletePremium(request, env);
    if (path === '/stripe/athlete-premium-cancel') return handleAthletePremiumCancel(request, env);

    // ── EXERCISE DEMO ─────────────────────────────────────────
    if (path === '/exercise/gif') return handleExerciseGif(request, env);

    // ── NOTIFICATIONS ────────────────────────────────────────
    if (path === '/notify/telegram') return handleNotifyTelegram(request, env);

    // ── VOICE SYNTHESIS ──────────────────────────────────────
    if (path === '/voice/synthesize') return handleVoiceSynthesize(request, env);

    return err('Not found', 404);
  },
};

// ── EXERCISE GIF PROXY ───────────────────────────────────────
async function handleExerciseGif(request, env) {
  const url  = new URL(request.url);
  const name = (url.searchParams.get('name') || '').trim();
  if (!name) return json({ gifUrl: null });

  const key = env.EXERCISEDB_KEY || '3e59b788camshee488ed2feded38p13518fjsn389730d70e1c';

  try {
    const res = await fetch(
      'https://exercisedb.p.rapidapi.com/exercises/name/' + encodeURIComponent(name) + '?limit=1&offset=0',
      { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com' } }
    );
    if (!res.ok) return json({ gifUrl: null, apiStatus: res.status });
    const data = await res.json();
    const hit = Array.isArray(data) && data[0];
    if (!hit) return json({ gifUrl: null });
    return json({
      gifUrl:       hit.gifUrl,
      bodyPart:     hit.bodyPart     || '',
      target:       hit.target       || '',
      instructions: hit.instructions || [],
    });
  } catch (e) {
    return json({ gifUrl: null });
  }
}

// ── TELEGRAM NOTIFICATION ────────────────────────────────────
async function handleNotifyTelegram(request, env) {
  const { coach_id, text } = await request.json().catch(() => ({}));
  if (!coach_id || !text) return err('coach_id and text required');

  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return json({ sent: false, reason: 'no_token' });

  const sb = sbClient(env.SUPABASE_URL, env.SUPABASE_SK);
  const { data: cp } = await sb.from('coach_profiles')
    .select('telegram_chat_id').eq('id', coach_id).single();

  const chatId = cp?.telegram_chat_id;
  if (!chatId) return json({ sent: false, reason: 'no_chat_id' });

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      }
    );
    const data = await res.json();
    if (!data.ok) return json({ sent: false, reason: data.description });
    return json({ sent: true });
  } catch (e) {
    return json({ sent: false, reason: e.message });
  }
}

// ── AI CHAT ──────────────────────────────────────────────────
async function handleAIChat(request, env) {
  const body = await request.json().catch(() => ({}));
  const messages = body.messages || [];
  const model = body.model || env.AI_MODEL || '@cf/meta/llama-3-8b-instruct';

  // Try Cloudflare AI first
  try {
    const aiResp = await env.AI.run(model, { messages });
    // aiResp can be { response: "text" } or { result: "text" } or { result: { response: "text" } }
    let text = '';
    if (typeof aiResp === 'string') text = aiResp;
    else if (typeof aiResp?.response === 'string') text = aiResp.response;
    else if (typeof aiResp?.result === 'string') text = aiResp.result;
    else if (typeof aiResp?.result?.response === 'string') text = aiResp.result.response;
    else text = JSON.stringify(aiResp);
    return json({ reply: text });
  } catch (e) {
    // Fallback to OpenAI if key is set
    if (env.OPENAI_KEY) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OPENAI_KEY },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 1000 }),
      });
      const d = await r.json();
      const content = d.choices?.[0]?.message?.content;
      if (typeof content === 'string') return json({ reply: content });
      if (d.error) return err(typeof d.error === 'string' ? d.error : (d.error.message || JSON.stringify(d.error)), 502);
      return json({ reply: '' });
    }
    return err('AI unavailable: ' + e.message, 503);
  }
}

// ── STRIPE: Connect onboarding ───────────────────────────────
async function handleStripeConnect(request, env) {
  const { coach_id, email, return_url, refresh_url } = await request.json();
  if (!coach_id || !email) return err('coach_id and email required');

  const stripe = stripeClient(env.STRIPE_SK);

  // Check if coach already has an account
  const sb = sbClient(env.SUPABASE_URL, env.SUPABASE_SK);
  const { data: cp } = await sb.from('coach_profiles').select('stripe_account_id').eq('id', coach_id).single();

  let accountId = cp?.stripe_account_id;

  if (!accountId) {
    // Create a new Express account
    const acct = await stripe.post('/v1/accounts', {
      type: 'express',
      email,
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    });
    if (acct.error) return err(acct.error.message);
    accountId = acct.id;

    // Save to coach_profiles (upsert)
    await sb.from('coach_profiles').upsert({
      id: coach_id,
      stripe_account_id: accountId,
      stripe_account_status: 'pending',
    });
  }

  // Create onboarding link
  const link = await stripe.post('/v1/account_links', {
    account:     accountId,
    refresh_url: refresh_url || 'https://dcarera-jpg.github.io/Kratos_David/?stripe=refresh',
    return_url:  return_url  || 'https://dcarera-jpg.github.io/Kratos_David/?stripe=connected',
    type:        'account_onboarding',
  });
  if (link.error) return err(link.error.message);

  return json({ url: link.url, account_id: accountId });
}

// ── STRIPE: Account status check ────────────────────────────
async function handleStripeStatus(request, env) {
  const { account_id, coach_id } = await request.json();
  if (!account_id) return err('account_id required');

  const stripe = stripeClient(env.STRIPE_SK);
  const acct   = await stripe.get('/v1/accounts/' + account_id);
  if (acct.error) return err(acct.error.message);

  const charges_enabled   = acct.charges_enabled   || false;
  const details_submitted = acct.details_submitted  || false;

  // Update status in DB
  if (coach_id) {
    const newStatus = charges_enabled ? 'active' : details_submitted ? 'pending_review' : 'pending';
    const sb = sbClient(env.SUPABASE_URL, env.SUPABASE_SK);
    await sb.from('coach_profiles').update({ stripe_account_status: newStatus }).eq('id', coach_id);
  }

  return json({ charges_enabled, details_submitted });
}

// ── STRIPE: Athlete checkout session ────────────────────────
async function handleStripeCheckout(request, env) {
  const { coach_id, athlete_id, price_cents, email, success_url, cancel_url } = await request.json();
  if (!coach_id || !price_cents) return err('coach_id and price_cents required');

  const sb     = sbClient(env.SUPABASE_URL, env.SUPABASE_SK);
  const stripe = stripeClient(env.STRIPE_SK);

  const { data: cp } = await sb.from('coach_profiles')
    .select('stripe_account_id,kratos_plan')
    .eq('id', coach_id).single();
  if (!cp?.stripe_account_id) return err('Coach Stripe account not found');

  const commissionPct = cp.kratos_plan === 'B' ? 0.03 : 0.08;
  const appFee = Math.round(price_cents * commissionPct);

  const session = await stripe.post('/v1/checkout/sessions', {
    mode:            'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:     'usd',
        product_data: { name: 'Coaching subscription' },
        unit_amount:  price_cents,
        recurring:    { interval: 'month' },
      },
      quantity: 1,
    }],
    customer_email:      email || undefined,
    success_url:         success_url || 'https://dcarera-jpg.github.io/Kratos_David/?sub=success',
    cancel_url:          cancel_url  || 'https://dcarera-jpg.github.io/Kratos_David/?sub=cancel',
    payment_intent_data: { application_fee_amount: appFee },
    transfer_data:       { destination: cp.stripe_account_id },
    metadata:            { coach_id, athlete_id: athlete_id || '' },
  });
  if (session.error) return err(session.error.message);

  return json({ url: session.url, session_id: session.id });
}

// ── STRIPE: Coach Plan B subscription ($49/mo) ───────────────
async function handleCoachSubscribe(request, env) {
  const { coach_id, email } = await request.json();
  if (!coach_id || !email) return err('coach_id and email required');

  const stripe = stripeClient(env.STRIPE_SK);
  const sb     = sbClient(env.SUPABASE_URL, env.SUPABASE_SK);

  // Upsert Stripe Customer for coach
  const { data: cp } = await sb.from('coach_profiles')
    .select('stripe_customer_id,stripe_subscription_id,stripe_subscription_status')
    .eq('id', coach_id).single();

  let customerId = cp?.stripe_customer_id;
  if (!customerId) {
    const cust = await stripe.post('/v1/customers', { email, metadata: { coach_id } });
    if (cust.error) return err(cust.error.message);
    customerId = cust.id;
    await sb.from('coach_profiles').update({ stripe_customer_id: customerId }).eq('id', coach_id);
  }

  // If already has active subscription, return OK
  if (cp?.stripe_subscription_status === 'active') {
    return json({ subscription_id: cp.stripe_subscription_id, status: 'already_active' });
  }

  // Create a Checkout Session for the Plan B subscription
  const session = await stripe.post('/v1/checkout/sessions', {
    mode:            'subscription',
    customer:        customerId,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:     'usd',
        product_data: { name: 'Kratos Plan B — Coach subscription' },
        unit_amount:  4900, // $49.00
        recurring:    { interval: 'month' },
      },
      quantity: 1,
    }],
    success_url: 'https://dcarera-jpg.github.io/Kratos_David/?planb=success',
    cancel_url:  'https://dcarera-jpg.github.io/Kratos_David/?planb=cancel',
    metadata:    { coach_id, type: 'plan_b' },
  });
  if (session.error) return err(session.error.message);

  // Mark plan as B (subscription pending until webhook confirms)
  await sb.from('coach_profiles').update({ kratos_plan: 'B' }).eq('id', coach_id);

  return json({ url: session.url, session_id: session.id });
}

// ── STRIPE: Coach cancel Plan B ──────────────────────────────
async function handleCoachCancel(request, env) {
  const { subscription_id, coach_id } = await request.json();
  if (!subscription_id) return err('subscription_id required');

  const stripe = stripeClient(env.STRIPE_SK);
  const result = await stripe.delete('/v1/subscriptions/' + subscription_id);
  if (result.error) return err(result.error.message);

  if (coach_id) {
    const sb = sbClient(env.SUPABASE_URL, env.SUPABASE_SK);
    await sb.from('coach_profiles').update({
      kratos_plan: 'A',
      stripe_subscription_id: null,
      stripe_subscription_status: 'canceled',
    }).eq('id', coach_id);
  }

  return json({ canceled: true });
}

// ── STRIPE: Athlete Premium checkout ($9.99/mo) ──────────────
async function handleAthletePremium(request, env) {
  const { athlete_id, email, success_url, cancel_url } = await request.json();
  if (!athlete_id || !email) return err('athlete_id and email required');

  const stripe = stripeClient(env.STRIPE_SK);

  const session = await stripe.post('/v1/checkout/sessions', {
    mode:            'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:     'usd',
        product_data: { name: 'Kratos Premium — Athlete' },
        unit_amount:  999, // $9.99
        recurring:    { interval: 'month' },
      },
      quantity: 1,
    }],
    customer_email: email,
    success_url:    success_url || 'https://dcarera-jpg.github.io/Kratos_David/?premium=success',
    cancel_url:     cancel_url  || 'https://dcarera-jpg.github.io/Kratos_David/?premium=cancel',
    metadata:       { athlete_id, type: 'athlete_premium' },
  });
  if (session.error) return err(session.error.message);

  return json({ url: session.url, session_id: session.id });
}

// ── STRIPE: Athlete Premium cancel ──────────────────────────
async function handleAthletePremiumCancel(request, env) {
  const { subscription_id, athlete_id } = await request.json();
  if (!subscription_id) return err('subscription_id required');

  const stripe = stripeClient(env.STRIPE_SK);
  const result = await stripe.delete('/v1/subscriptions/' + subscription_id);
  if (result.error) return err(result.error.message);

  if (athlete_id) {
    const sb = sbClient(env.SUPABASE_URL, env.SUPABASE_SK);
    await sb.from('athlete_subscriptions')
      .update({ status: 'canceled' })
      .eq('athlete_id', athlete_id);
  }

  return json({ canceled: true });
}

// ── STRIPE: Webhook ──────────────────────────────────────────
async function handleStripeWebhook(request, env) {
  const payload = await request.text();
  const sig     = request.headers.get('stripe-signature') || '';
  // TODO: verify webhook signature with env.STRIPE_WEBHOOK_SECRET

  let event;
  try { event = JSON.parse(payload); } catch { return err('Invalid JSON', 400); }

  const sb = sbClient(env.SUPABASE_URL, env.SUPABASE_SK);

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object;
    const meta     = session.metadata || {};
    const subId    = session.subscription;

    if (meta.type === 'plan_b' && meta.coach_id) {
      await sb.from('coach_profiles').update({
        stripe_subscription_id:     subId,
        stripe_subscription_status: 'active',
        kratos_plan:                'B',
      }).eq('id', meta.coach_id);
    }

    if (meta.type === 'athlete_premium' && meta.athlete_id) {
      await sb.from('athlete_subscriptions').upsert({
        athlete_id:             meta.athlete_id,
        stripe_subscription_id: subId,
        status:                 'active',
        plan:                   'premium',
        amount_cents:           999,
        updated_at:             new Date().toISOString(),
      });
    }

    // Regular athlete → coach subscription
    if (meta.coach_id && meta.athlete_id && meta.type !== 'plan_b') {
      await sb.from('subscriptions').upsert({
        coach_id:               meta.coach_id,
        athlete_id:             meta.athlete_id,
        stripe_subscription_id: subId,
        status:                 'active',
        amount_cents:           session.amount_total,
        updated_at:             new Date().toISOString(),
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub  = event.data.object;
    const meta = sub.metadata || {};
    if (meta.type === 'plan_b' && meta.coach_id) {
      await sb.from('coach_profiles').update({
        stripe_subscription_status: 'canceled',
        kratos_plan: 'A',
      }).eq('id', meta.coach_id);
    }
    if (meta.type === 'athlete_premium' && meta.athlete_id) {
      await sb.from('athlete_subscriptions').update({ status: 'canceled' })
        .eq('stripe_subscription_id', sub.id);
    }
  }

  return json({ received: true });
}

// ── VOICE SYNTHESIS ──────────────────────────────────────────
async function handleVoiceSynthesize(request, env) {
  const { text, voice_id } = await request.json().catch(() => ({}));
  if (!text) return err('text required');

  const apiKey = env.ELEVENLABS_API_KEY;
  const voiceId = voice_id || 'ODKG5CTroUtegAvJKs9h';

  if (!apiKey) return json({ fallback: true, reason: 'no_api_key' });

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return json({ fallback: true, reason: `elevenlabs_${res.status}: ${errText}` });
    }

    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    return new Response(JSON.stringify({ audio: base64, mimeType: 'audio/mpeg' }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return json({ fallback: true, reason: e.message });
  }
}

// ── HELPERS ──────────────────────────────────────────────────
function stripeClient(sk) {
  const base = 'https://api.stripe.com';
  const headers = {
    'Authorization': 'Bearer ' + sk,
    'Content-Type':  'application/x-www-form-urlencoded',
  };

  function encode(obj, prefix = '') {
    return Object.entries(obj).flatMap(([k, v]) => {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v === null || v === undefined) return [];
      if (typeof v === 'object' && !Array.isArray(v)) return encode(v, key);
      if (Array.isArray(v)) return v.map((item, i) => encode(item, `${key}[${i}]`)).flat();
      return [`${encodeURIComponent(key)}=${encodeURIComponent(v)}`];
    }).join('&');
  }

  return {
    async get(path) {
      const r = await fetch(base + path, { headers });
      return r.json();
    },
    async post(path, data) {
      const r = await fetch(base + path, { method: 'POST', headers, body: encode(data) });
      return r.json();
    },
    async delete(path) {
      const r = await fetch(base + path, { method: 'DELETE', headers });
      return r.json();
    },
  };
}

function sbClient(url, key) {
  const headers = {
    'apikey':        key,
    'Authorization': 'Bearer ' + key,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  function queryBuilder(table) {
    let _filters = [];
    let _select  = '*';
    let _limit   = null;
    let _order   = null;

    const qb = {
      select(cols) { _select = cols; return qb; },
      eq(col, val) { _filters.push(`${col}=eq.${val}`); return qb; },
      update(data) {
        return {
          eq(col, val) {
            return fetch(`${url}/rest/v1/${table}?${col}=eq.${val}`, {
              method:  'PATCH',
              headers: { ...headers, 'Prefer': 'return=minimal' },
              body:    JSON.stringify(data),
            }).then(r => ({ error: r.ok ? null : { message: r.status } }));
          }
        };
      },
      upsert(data) {
        return fetch(`${url}/rest/v1/${table}`, {
          method:  'POST',
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body:    JSON.stringify(data),
        }).then(r => ({ error: r.ok ? null : { message: r.status } }));
      },
      single() {
        const qs = [..._filters, `select=${_select}`, 'limit=1'].join('&');
        return fetch(`${url}/rest/v1/${table}?${qs}`, { headers })
          .then(r => r.json())
          .then(d => ({ data: Array.isArray(d) ? d[0] : d, error: null }))
          .catch(e => ({ data: null, error: e }));
      },
      async then(resolve) {
        const parts = [`select=${_select}`];
        _filters.forEach(f => parts.push(f));
        if (_order) parts.push(_order);
        if (_limit) parts.push(`limit=${_limit}`);
        const r = await fetch(`${url}/rest/v1/${table}?${parts.join('&')}`, { headers });
        const d = await r.json();
        return resolve({ data: d, error: null });
      },
    };
    return qb;
  }

  return {
    from: (table) => queryBuilder(table),
  };
}
