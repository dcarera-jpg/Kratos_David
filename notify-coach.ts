const TELEGRAM_TOKEN = '8610645295:AAF8UtkyI78aUOWbHB41BKJAOq852ZT0OLI';
const COACH_CHAT_ID  = '279997963';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record  = payload.record;

    if (!record) return new Response('no record', { status: 400 });
    if (record.sender_role === 'admin') return new Response('skip admin', { status: 200 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';

    let senderName = 'Athlete';
    if (supabaseUrl && supabaseKey && record.sender_id) {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${record.sender_id}&select=full_name,email`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const profiles = await r.json();
      if (profiles?.[0]) senderName = profiles[0].full_name || profiles[0].email || senderName;
    }

    const athleteId = record.athlete_id || record.sender_id || '';

    const text = [
      '💬 *New message on Kratos*',
      '',
      `👤 *From:* ${senderName}`,
      `📝 ${record.text}`,
      '',
      `_${new Date(record.created_at || Date.now()).toLocaleString('en-US')}_`,
      '',
      `↩️ Reply to this message to respond to the athlete`,
      `athlete:${athleteId}`,
    ].join('\n');

    const tgResp = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: COACH_CHAT_ID, text, parse_mode: 'Markdown' })
      }
    );

    const tgData = await tgResp.json();
    console.log('Telegram response:', JSON.stringify(tgData));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('Function error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
