import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match, Profile } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Lock } from 'lucide-react'

interface PronosticsPageProps {
  profile: Profile | null
}

interface MatchWithPrediction extends Match {
  prediction?: {
    predicted_home: number
    predicted_away: number
    predicted_winner: string
  }
}

function deriveWinner(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

export default function PronosticsPage({ profile }: PronosticsPageProps) {
  const [matches, setMatches] = useState<MatchWithPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, { home: string; away: string }>>({})

  useEffect(() => {
    fetchMatchesAndPredictions()
  }, [])

  async function fetchMatchesAndPredictions() {
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .eq('is_finished', false)
      .order('kickoff_at', { ascending: true })

    if (!matchesData) { setLoading(false); return }

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', profile?.id)

    const withPreds: MatchWithPrediction[] = matchesData.map(m => {
      const pred = preds?.find(p => p.match_id === m.id)
      return {
        ...m,
        prediction: pred ? {
          predicted_home: pred.predicted_home,
          predicted_away: pred.predicted_away,
          predicted_winner: pred.predicted_winner,
        } : undefined,
      }
    })

    setMatches(withPreds)

    const initInputs: Record<string, { home: string; away: string }> = {}
    withPreds.forEach(m => {
      initInputs[m.id] = m.prediction
        ? { home: String(m.prediction.predicted_home), away: String(m.prediction.predicted_away) }
        : { home: '', away: '' }
    })
    setInputs(initInputs)
    setLoading(false)
  }

  function isLocked(kickoff: string) {
    return new Date(kickoff).getTime() - Date.now() < 5 * 60 * 1000
  }

  async function handleSave(match: MatchWithPrediction) {
    const input = inputs[match.id]
    if (!input || input.home === '' || input.away === '' || !profile) return
    setSaving(match.id)

    const h = parseInt(input.home)
    const a = parseInt(input.away)

    const payload = {
      user_id: profile.id,
      match_id: match.id,
      predicted_home: h,
      predicted_away: a,
      predicted_winner: deriveWinner(h, a),
      points_earned: 0,
    }

    await supabase.from('predictions').upsert(payload, { onConflict: 'user_id,match_id' })
    await fetchMatchesAndPredictions()
    setSaving(null)
  }

  function setInput(matchId: string, field: 'home' | 'away', value: string) {
    setInputs(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-400">Chargement…</p></div>
  }

  const upcoming = matches.filter(m => !isLocked(m.kickoff_at))
  const locked = matches.filter(m => isLocked(m.kickoff_at))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-dark mb-1">Mes pronostics</h2>
        <p className="text-sm text-gray-500">+3 pts vainqueur · +8 pts score exact</p>
      </div>

      {upcoming.length === 0 && locked.length === 0 && (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-semibold text-dark">Tous les pronostics sont faits !</p>
          <p className="text-sm text-gray-400 mt-1">Reviens après les prochains matchs.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          {upcoming.map(match => {
            const input = inputs[match.id] || { home: '', away: '' }
            const isSaved = !!match.prediction
            const isDirty = match.prediction
              ? input.home !== String(match.prediction.predicted_home) ||
                input.away !== String(match.prediction.predicted_away)
              : input.home !== '' || input.away !== ''
            const canSave = input.home !== '' && input.away !== ''

            const h = parseInt(input.home)
            const a = parseInt(input.away)
            const derivedWinner = canSave ? deriveWinner(h, a) : null
            const winnerLabel = derivedWinner === 'home'
              ? `Victoire ${match.team_home}`
              : derivedWinner === 'away'
              ? `Victoire ${match.team_away}`
              : derivedWinner === 'draw'
              ? 'Match nul'
              : null

            return (
              <div key={match.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{match.phase}</span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(match.kickoff_at), 'EEE d MMM · HH:mm', { locale: fr })}
                  </span>
                </div>

                <div className="px-5 py-4">
                  {/* Teams + score inputs */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-2xl">{match.flag_home}</span>
                      <span className="font-semibold text-dark text-sm">{match.team_home}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={input.home}
                        onChange={e => setInput(match.id, 'home', e.target.value)}
                        className="w-12 h-10 border-2 border-gray-200 rounded-lg text-center font-bold text-dark focus:outline-none focus:border-primary transition text-lg"
                        placeholder="0"
                      />
                      <span className="text-gray-300 font-bold">–</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={input.away}
                        onChange={e => setInput(match.id, 'away', e.target.value)}
                        className="w-12 h-10 border-2 border-gray-200 rounded-lg text-center font-bold text-dark focus:outline-none focus:border-primary transition text-lg"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex-1 flex items-center gap-2 justify-end">
                      <span className="font-semibold text-dark text-sm text-right">{match.team_away}</span>
                      <span className="text-2xl">{match.flag_away}</span>
                    </div>
                  </div>

                  {/* Derived winner hint + Save button */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium transition-all ${winnerLabel ? 'text-primary' : 'text-gray-300'}`}>
                      {winnerLabel ? `→ ${winnerLabel}` : '→ Saisir un score'}
                    </span>
                    <button
                      onClick={() => handleSave(match)}
                      disabled={!canSave || saving === match.id}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                        isSaved && !isDirty
                          ? 'bg-green-50 text-green-600 border border-green-200'
                          : canSave
                          ? 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {saving === match.id ? 'Sauvegarde…' : isSaved && !isDirty ? '✓ Enregistré' : 'Valider'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {locked.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Pronostics verrouillés
          </h3>
          {locked.map(match => (
            <div key={match.id} className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3 flex items-center justify-between opacity-60">
              <div className="flex items-center gap-2">
                <span className="text-xl">{match.flag_home}</span>
                <span className="font-medium text-sm text-dark">{match.team_home}</span>
                <span className="text-gray-300 mx-1">vs</span>
                <span className="font-medium text-sm text-dark">{match.team_away}</span>
                <span className="text-xl">{match.flag_away}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {match.prediction && (
                  <span className="font-mono font-semibold">
                    {match.prediction.predicted_home}–{match.prediction.predicted_away}
                  </span>
                )}
                <Lock className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
