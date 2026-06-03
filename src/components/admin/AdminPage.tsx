import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, CheckCircle } from 'lucide-react'

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [newMatch, setNewMatch] = useState({
    phase: '', team_home: '', team_away: '', flag_home: '', flag_away: '', kickoff_at: '',
  })
  const [addingMatch, setAddingMatch] = useState(false)

  useEffect(() => {
    fetchMatches()
  }, [])

  async function fetchMatches() {
    const { data } = await supabase.from('matches').select('*').order('kickoff_at', { ascending: true })
    setMatches(data || [])
    setLoading(false)
  }

  async function handleFinishMatch(match: Match) {
    const input = scoreInputs[match.id]
    if (!input || input.home === '' || input.away === '') return
    setSubmitting(match.id)

    const scoreHome = parseInt(input.home)
    const scoreAway = parseInt(input.away)
    const actualWinner = scoreHome > scoreAway ? 'home' : scoreAway > scoreHome ? 'away' : 'draw'

    // Update match
    await supabase.from('matches').update({
      score_home: scoreHome,
      score_away: scoreAway,
      is_finished: true,
    }).eq('id', match.id)

    // Fetch all predictions for this match
    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', match.id)

    if (preds) {
      for (const pred of preds) {
        let points = 0
        const correctWinner = pred.predicted_winner === actualWinner
        const exactScore = pred.predicted_home === scoreHome && pred.predicted_away === scoreAway
        if (exactScore) points = 8
        else if (correctWinner) points = 3
        await supabase.from('predictions').update({ points_earned: points }).eq('id', pred.id)
      }
    }

    await fetchMatches()
    setSubmitting(null)
  }

  async function handleAddMatch() {
    setAddingMatch(true)
    const { error } = await supabase.from('matches').insert([{
      phase: newMatch.phase,
      team_home: newMatch.team_home,
      team_away: newMatch.team_away,
      flag_home: newMatch.flag_home,
      flag_away: newMatch.flag_away,
      kickoff_at: new Date(newMatch.kickoff_at).toISOString(),
      is_finished: false,
    }])
    if (!error) {
      setNewMatch({ phase: '', team_home: '', team_away: '', flag_home: '', flag_away: '', kickoff_at: '' })
      await fetchMatches()
    }
    setAddingMatch(false)
  }

  function setScore(matchId: string, field: 'home' | 'away', val: string) {
    setScoreInputs(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: val } }))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-400">Chargement…</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="text-primary text-sm">⚙️</span>
        </div>
        <h1 className="text-lg font-bold text-dark">Panel Admin</h1>
      </div>

      {/* Add match form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-dark mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Ajouter un match</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Phase</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="ex: Groupe A, 8e de finale…"
              value={newMatch.phase}
              onChange={e => setNewMatch(prev => ({ ...prev, phase: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Drapeau domicile (emoji)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="🇫🇷" value={newMatch.flag_home} onChange={e => setNewMatch(prev => ({ ...prev, flag_home: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Équipe domicile</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="France" value={newMatch.team_home} onChange={e => setNewMatch(prev => ({ ...prev, team_home: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Drapeau extérieur (emoji)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="🇧🇷" value={newMatch.flag_away} onChange={e => setNewMatch(prev => ({ ...prev, flag_away: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Équipe extérieure</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Brésil" value={newMatch.team_away} onChange={e => setNewMatch(prev => ({ ...prev, team_away: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Date et heure de coup d'envoi</label>
            <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={newMatch.kickoff_at} onChange={e => setNewMatch(prev => ({ ...prev, kickoff_at: e.target.value }))} />
          </div>
        </div>
        <button
          onClick={handleAddMatch}
          disabled={addingMatch || !newMatch.phase || !newMatch.team_home || !newMatch.team_away || !newMatch.kickoff_at}
          className="mt-4 w-full bg-primary text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50"
        >
          {addingMatch ? 'Ajout…' : 'Ajouter le match'}
        </button>
      </div>

      {/* Matches list */}
      <div className="space-y-3">
        <h2 className="font-semibold text-dark">Tous les matchs ({matches.length})</h2>
        {matches.map(match => (
          <div key={match.id} className={`bg-white rounded-xl shadow-sm border p-4 ${match.is_finished ? 'border-green-100' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400">{match.phase}</span>
              <div className="flex items-center gap-1.5">
                {match.is_finished && <CheckCircle className="w-4 h-4 text-green-500" />}
                <span className="text-xs text-gray-400">{format(new Date(match.kickoff_at), 'd MMM HH:mm', { locale: fr })}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">{match.flag_home}</span>
              <span className="font-semibold text-dark text-sm">{match.team_home}</span>
              {match.is_finished ? (
                <span className="mx-auto font-black text-dark text-lg">{match.score_home} – {match.score_away}</span>
              ) : (
                <span className="mx-auto text-gray-300 font-bold">vs</span>
              )}
              <span className="font-semibold text-dark text-sm">{match.team_away}</span>
              <span className="text-xl">{match.flag_away}</span>
            </div>

            {!match.is_finished && (
              <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-500 font-medium">Score final :</span>
                <input
                  type="number" min="0" max="20"
                  placeholder="Dom"
                  value={scoreInputs[match.id]?.home || ''}
                  onChange={e => setScore(match.id, 'home', e.target.value)}
                  className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-gray-300 font-bold">–</span>
                <input
                  type="number" min="0" max="20"
                  placeholder="Ext"
                  value={scoreInputs[match.id]?.away || ''}
                  onChange={e => setScore(match.id, 'away', e.target.value)}
                  className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  onClick={() => handleFinishMatch(match)}
                  disabled={submitting === match.id || !scoreInputs[match.id]?.home || !scoreInputs[match.id]?.away}
                  className="ml-auto px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                >
                  {submitting === match.id ? '…' : 'Terminer le match'}
                </button>
              </div>
            )}
          </div>
        ))}

        {matches.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
            Aucun match. Ajoute-en un ci-dessus.
          </div>
        )}
      </div>
    </div>
  )
}
