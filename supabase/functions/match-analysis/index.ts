const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const { teamHome, teamAway, phase, kickoffAt, isFinished, scoreHome, scoreAway } = await req.json()
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const matchContext = isFinished
      ? `Match terminé. Score final : ${teamHome} ${scoreHome} - ${scoreAway} ${teamAway}.`
      : `Match à venir le ${kickoffAt}.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: 'Tu es un expert football. Analyse ce match de Coupe du Monde 2026 en 3-4 phrases en français : forces/faiblesses des équipes, facteur clé, pronostic avec score probable.',
        messages: [{ role: 'user', content: `${teamHome} vs ${teamAway}, ${phase}. ${matchContext}` }],
      }),
    })

    const data = await res.json()
    const analysis = data?.content?.[0]?.text ?? ''

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
