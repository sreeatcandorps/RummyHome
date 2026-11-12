// Email through Resend (sender scores@mindweavetech.com).
// Deploy:
//   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="EZ Score <scores@mindweavetech.com>" --project-ref gngcrplcldfiubvhcdin
//   supabase functions deploy send-email --project-ref gngcrplcldfiubvhcdin
// Without RESEND_API_KEY the function returns sent:false and the app tells you to copy the link.
//
// Two jobs:
//  - kind 'welcome' / 'scorecard': the original one-off emails, sent for the signed-in caller.
//  - kind 'flush' (024): deliver the rows the database queued in public.email_outbox
//    (game started, result saved). Any signed-in account may trigger a flush; it only sends
//    what the database already decided to send, once per row: the row's event_key is the
//    Resend Idempotency-Key and sent_at is stamped on success, so a retry never doubles.
//    SUPABASE_SERVICE_ROLE_KEY is provided to every edge function by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SITE = 'https://ezscore.mindweavetech.com';
const FLUSH_BATCH = 50;
const MAX_ATTEMPTS = 5;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const when = (iso: unknown) => {
  const d = new Date(String(iso ?? ''));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

type OutboxRow = {
  id: number;
  event_key: string;
  kind: 'game_started' | 'result_saved' | 'link_request';
  to_email: string;
  payload: Record<string, unknown>;
  attempts: number;
};

const button = (href: unknown, label: string, alt = false) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:${alt ? '#E7E0D4' : '#17402F'};color:${alt ? '#1B1F1C' : '#FBF1E1'};padding:10px 16px;border-radius:8px;text-decoration:none;margin-right:8px">${label}</a>`;

/**
 * Subject and body for one queued row. Game and result emails end with their own unsubscribe
 * link; the link request is a question to the account owner (025), so it carries Yes / No instead.
 */
function render(row: OutboxRow): { subject: string; html: string; text: string } {
  const p = row.payload;
  const unsubscribe = `${SITE}/unsubscribe.html?t=${encodeURIComponent(String(p.unsubscribeToken ?? ''))}&k=${row.kind}`;
  const footer = `<p style="color:#666;font-size:12px;margin-top:24px">You get this because you are a registered EZ Score player in this game. <a href="${unsubscribe}">Unsubscribe from these emails</a> · <a href="${SITE}/privacy">Privacy</a></p>`;
  const name = escapeHtml(p.playerName ?? 'there');

  if (row.kind === 'link_request') {
    const who = `${p.playerName ?? 'a player'}${p.playerInitials ? ` (${p.playerInitials})` : ''}`;
    const games = Array.isArray(p.gameLabels) && p.gameLabels.length ? ` (${(p.gameLabels as string[]).join(', ')})` : '';
    const count = Number(p.gameCount) || 0;
    const subject = `Link "${p.playerName ?? 'a player'}" to your Player ID #${p.playerNo ?? ''}?`;
    const html = `<p>Hi ${escapeHtml(p.targetName ?? 'there')},</p>
<p>${escapeHtml(p.requesterName ?? 'A player')} asked to link their player <strong>${escapeHtml(who)}</strong> to your EZ Score account (Player ID <strong>#${escapeHtml(p.playerNo)}</strong>).</p>
<p>If that is you, say Yes: ${escapeHtml(who)}'s seats and scores in ${count} ${count === 1 ? 'game' : 'games'}${escapeHtml(games)} move to your account. Nothing moves until you answer.</p>
<p>${button(p.yesUrl, 'Yes, that is me')}${button(p.noUrl, 'No', true)}</p>
<p style="font-size:13px;color:#444">You can also answer on the Home screen of the app. This request expires on ${escapeHtml(when(p.expiresAt))}.</p>
<p style="color:#666;font-size:12px;margin-top:24px">You get this because an EZ Score organiser typed your Player ID. If you did not expect it, tap No or ignore it. <a href="${SITE}/privacy">Privacy</a></p>`;
    const text = `Hi ${p.targetName ?? 'there'},\n\n${p.requesterName ?? 'A player'} asked to link their player ${who} to your EZ Score account (#${p.playerNo ?? ''}). If that is you, their seats and scores in ${count} ${count === 1 ? 'game' : 'games'}${games} move to your account.\n\nYes: ${p.yesUrl}\nNo: ${p.noUrl}\n\nExpires ${when(p.expiresAt)}. You can also answer in the app.`;
    return { subject, html, text };
  }

  if (row.kind === 'game_started') {
    const g = typeof p.gameLabel === 'string' && p.gameLabel ? `Game ${p.gameLabel}` : 'A game';
    const subject = `${g} has started · live scores`;
    const html = `<p>Hi ${name},</p>
<p>${escapeHtml(p.creatorName ?? 'A player')} started ${escapeHtml(g)}${p.startedAt ? ` on ${escapeHtml(when(p.startedAt))}` : ''}.</p>
<p><a href="${escapeHtml(p.url)}" style="display:inline-block;background:#17402F;color:#FBF1E1;padding:10px 16px;border-radius:8px;text-decoration:none">Open the live scorecard</a></p>
<p style="font-size:13px;color:#444">Or copy this link: ${escapeHtml(p.url)}</p>${footer}`;
    const text = `Hi ${p.playerName ?? 'there'},\n\n${p.creatorName ?? 'A player'} started ${g}. Live scores: ${p.url}\n\nUnsubscribe: ${unsubscribe}`;
    return { subject, html, text };
  }

  const place = Number(p.place);
  const points = Number(p.points);
  const subject = `Results saved · you placed ${Number.isFinite(place) ? ordinal(place) : ''}`.trim();
  const html = `<p>Hi ${name},</p>
<p>${escapeHtml(p.declarerName ?? 'A player')} saved a result${p.declaredAt ? ` on ${escapeHtml(when(p.declaredAt))}` : ''}: ${escapeHtml(p.gameCount)} ${Number(p.gameCount) === 1 ? 'game' : 'games'}, ${escapeHtml(p.playerCount)} players.</p>
<p>You placed <strong>${Number.isFinite(place) ? escapeHtml(ordinal(place)) : '—'}</strong> with <strong>${Number.isFinite(points) ? (points > 0 ? '+' : '') + points : '—'}</strong> points.</p>
<p><a href="${escapeHtml(p.url)}" style="display:inline-block;background:#17402F;color:#FBF1E1;padding:10px 16px;border-radius:8px;text-decoration:none">See the full result</a></p>
<p style="font-size:13px;color:#444">Or copy this link: ${escapeHtml(p.url)}</p>${footer}`;
  const text = `Hi ${p.playerName ?? 'there'},\n\nA result was saved. You placed ${Number.isFinite(place) ? ordinal(place) : '—'} with ${points} points. Full result: ${p.url}\n\nUnsubscribe: ${unsubscribe}`;
  return { subject, html, text };
}

async function resend(apiKey: string, from: string, message: { to: string[]; subject: string; html: string; text?: string }, idempotencyKey?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers, body: JSON.stringify({ from, ...message }) });
  return { ok: response.ok, detail: response.ok ? '' : await response.text() };
}

/** Deliver the unsent outbox rows (oldest first). Rows that failed MAX_ATTEMPTS times are left alone. */
async function flush(apiKey: string, from: string) {
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data, error } = await admin
    .from('email_outbox')
    .select('id, event_key, kind, to_email, payload, attempts')
    .is('sent_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(FLUSH_BATCH);
  if (error) return json({ sent: false, message: `Could not read the outbox. ${error.message}` }, 500);

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as OutboxRow[]) {
    // Claim first so two flushes running at once do not both send the same row.
    const { data: claimed } = await admin
      .from('email_outbox')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('attempts', row.attempts)
      .is('sent_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    const message = render(row);
    const result = await resend(apiKey, from, { to: [row.to_email], ...message }, row.event_key);
    if (result.ok) {
      sent += 1;
      await admin.from('email_outbox').update({ sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id);
    } else {
      failed += 1;
      await admin.from('email_outbox').update({ last_error: result.detail.slice(0, 500) }).eq('id', row.id);
    }
  }
  return json({ sent: sent > 0 || failed === 0, message: `Sent ${sent}, failed ${failed}.`, count: sent, failed });
}

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

  if (body.kind === 'flush') return flush(apiKey, from);

  let to: string[] = [];
  let subject = '';
  let html = '';

  if (body.kind === 'welcome') {
    if ((body.email ?? '').toLowerCase() !== userData.user.email.toLowerCase()) {
      return json({ sent: false, message: 'A welcome email can only go to the new account.' }, 403);
    }
    to = [userData.user.email];
    subject = 'Welcome to EZ Score';
    html = `<p>Hi ${escapeHtml(body.name || 'there')},</p><p>Your EZ Score account is ready. Sign in with this email and your 6-digit passcode.</p>`;
  } else if (body.kind === 'scorecard') {
    const { data: game, error: gameError } = await userClient
      .from('games')
      .select('id, share_code')
      .eq('id', body.gameId)
      .maybeSingle();
    if (gameError || !game) return json({ sent: false, message: 'Only a game admin can email this scorecard.' }, 403);
    to = Array.isArray(body.emails) ? body.emails.map((email: string) => String(email)) : [];
    subject = `Rummy scorecard ${body.gameLabel || game.share_code}`;
    html = `<p>A live Rummy scorecard is ready.</p><p>Started ${escapeHtml(body.startedAt || '')}. ${escapeHtml(body.gameLabel ? `Game ${body.gameLabel}` : `Game ${game.share_code}`)}.</p><p><a href="${escapeHtml(body.url)}">Open the scorecard</a></p>`;
  } else {
    return json({ sent: false, message: 'Unknown email.' }, 400);
  }

  if (to.length === 0) return json({ sent: false, message: 'No recipients.' });

  const result = await resend(apiKey, from, { to, subject, html });
  if (!result.ok) return json({ sent: false, message: `Email provider rejected the message. ${result.detail}` }, 502);

  return json({ sent: true, message: `Sent to ${to.length} ${to.length === 1 ? 'person' : 'people'}.` });
});
