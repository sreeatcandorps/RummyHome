// Public live scorecard. Deploy with:
//   supabase functions deploy scorecard --project-ref gngcrplcldfiubvhcdin
// No extra secrets. The function uses the project's service role, which stays on the server.

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rummy scorecard</title>
  <style>
    body { margin: 0; font-family: "Segoe UI", sans-serif; background: #FBF1E1; color: #1B1F1C; }
    header { background: #17402F; color: #FBF1E1; padding: 16px 18px 14px; }
    header h1 { margin: 0; font-size: 22px; }
    .meta { margin-top: 6px; font-size: 14px; opacity: 0.9; }
    main { padding: 12px; overflow-x: auto; }
    table { border-collapse: collapse; min-width: 100%; background: #fff; }
    th, td { padding: 8px 10px; text-align: center; border-bottom: 1px solid #E7E0D4; font-variant-numeric: tabular-nums; }
    th { background: #F4EFE4; font-size: 13px; }
    th .total { display: block; font-size: 16px; font-weight: 800; }
    td.pos { color: #0E7A43; font-weight: 700; }
    td.neg { color: #8C2F2F; }
    .msg { padding: 24px; }
  </style>
</head>
<body>
  <header>
    <h1>Rummy scorecard</h1>
    <div class="meta" id="meta">Loading…</div>
  </header>
  <main id="board"></main>
  <script>
    const card = __CARD__;
    function render(data) {
      if (!data || !data.gameId) {
        document.getElementById('meta').textContent = 'This scorecard link is not valid.';
        return;
      }
      const players = data.players || [];
      const labels = players.map((player) => {
        const words = (player.name || '').trim().split(/\\s+/).filter(Boolean);
        const last = words.length > 1 ? words[words.length - 1] : '';
        const lastPart = /^\\d+$/.test(last) ? last : last.slice(0, 1);
        return ((words[0] || '?')[0] + lastPart).toUpperCase();
      });
      const byName = new Map(players.map((player, index) => [player.name, index]));
      const rounds = new Set();
      const grid = players.map(() => ({}));
      const expense = {};
      (data.scores || []).forEach((score) => {
        rounds.add(score.round);
        if (!score.name || score.type === 'expense') {
          expense[score.round] = (expense[score.round] || 0) + score.value;
          return;
        }
        const index = byName.get(score.name);
        if (index == null) return;
        grid[index][score.round] = (grid[index][score.round] || 0) + score.value;
      });
      const roundList = [...rounds].sort((a, b) => a - b);
      const totals = grid.map((row) => roundList.reduce((sum, round) => sum + (row[round] || 0), 0));
      const started = new Date(data.startedAt);
      const when = Number.isNaN(started.getTime()) ? data.startedAt : started.toLocaleString();
      document.getElementById('meta').textContent = 'Started ' + when + ' · ID ' + data.gameId + ' · ' + (data.status === 'completed' ? 'Completed' : 'Live');
      const head = labels.map((label, index) => '<th>' + label + '<span class="total">' + totals[index] + '</span></th>').join('');
      const body = roundList.map((round) => '<tr><td>' + round + '</td>' + grid.map((row) => {
        const value = row[round] || 0;
        return '<td class="' + (value > 0 ? 'pos' : value < 0 ? 'neg' : '') + '">' + (value > 0 ? '+' + value : value) + '</td>';
      }).join('') + '</tr>').join('');
      document.getElementById('board').innerHTML = '<table><thead><tr><th>Rnd</th>' + head + '</tr></thead><tbody>' + (body || '<tr><td>No rounds yet.</td></tr>') + '</tbody></table>';
    }
    render(card);
    setTimeout(() => location.reload(), 8000);
  </script>
</body>
</html>`;

Deno.serve(async (request) => {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  let card: unknown = null;

  if (supabaseUrl && serviceKey && /^[0-9a-f]{48}$/.test(token)) {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/public_scorecard`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token }),
    });
    if (response.ok) card = await response.json();
  }

  const html = PAGE.replace('__CARD__', JSON.stringify(card).replace(/</g, '\\u003c'));
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
});
