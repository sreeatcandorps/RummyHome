// Optional email for welcome notes and scorecard links.
// Deploy:
//   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="Rummy Home <scores@mindweavetech.com>" --project-ref gngcrplcldfiubvhcdin
//   supabase functions deploy send-email --project-ref gngcrplcldfiubvhcdin
// Without RESEND_API_KEY the function returns sent:false and the app tells you to copy the link.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ sent: false, message: 'POST only' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM');
  if (!apiKey || !from) {
    return json({
      sent: false,
      message: 'Email is not configured. Set RESEND_API_KEY and RESEND_FROM, then deploy send-email.',
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = request.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user?.email) return json({ sent: false, message: 'Sign in required.' }, 401);

  const body = await request.json();
  let to: string[] = [];
  let subject = '';
  let html = '';

  if (body.kind === 'welcome') {
    if ((body.email ?? '').toLowerCase() !== userData.user.email.toLowerCase()) {
      return json({ sent: false, message: 'A welcome email can only go to the new account.' }, 403);
    }
    to = [userData.user.email];
    subject = 'Welcome to Rummy Home';
    html = `<p>Hi ${body.name || 'there'},</p><p>Your Rummy Home account is ready. Sign in with this email and your 6-digit passcode.</p>`;
  } else if (body.kind === 'scorecard') {
    const { data: game, error: gameError } = await userClient
      .from('games')
      .select('id, share_code')
      .eq('id', body.gameId)
      .maybeSingle();
    if (gameError || !game) return json({ sent: false, message: 'Only a game admin can email this scorecard.' }, 403);
    to = Array.isArray(body.emails) ? body.emails.map((email: string) => String(email)) : [];
    subject = `Rummy scorecard ${body.gameLabel || game.share_code}`;
    html = `<p>A live Rummy scorecard is ready.</p><p>Started ${body.startedAt || ''}. Game ID ${body.gameLabel || game.share_code}.</p><p><a href="${body.url}">Open the scorecard</a></p>`;
  } else {
    return json({ sent: false, message: 'Unknown email.' }, 400);
  }

  if (to.length === 0) return json({ sent: false, message: 'No recipients.' });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return json({ sent: false, message: `Email provider rejected the message. ${detail}` }, 502);
  }

  return json({ sent: true, message: `Sent to ${to.length} ${to.length === 1 ? 'person' : 'people'}.` });
});
