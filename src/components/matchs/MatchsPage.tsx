import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match, Profile } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCircle, XCircle, Circle } from 'lucide-react'

interface MatchsPageProps {
  profile: Profile | null
}

interface MatchWithPred extends Match {
  prediction?: {
    predicted_home: number
    predicted_away: number
    predicted_winner: string
    points_earned: number
  }
}

export default function MatchsPage({ profile }: MatchsPageProps) {
  const [finishedMatches, setFinishedMatches] = useState<MatchWithPred[]>([])
  const [upcomingMatches, setUpcomingMatches] = useState<MatchWithPred[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMatches()
  }, [])

  async function fetchMatches() {
    const { data: allMatches } = await supabase
      .from('matches')
      .select('*')
      .order('kickoff_at', { ascending: false })

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', profile?.id)

    if (!allMatches) { setLoading(false); return }

    const withPreds: MatchWithPred[] = allMatches.map(m => {
      const pred = preds?.find(p => p.match_id === m.id)
      return {
        ...m,
        prediction: pred ? {
          predicted_home: pred.predicted_home,
          predicted_away: pred.predicted_away,
          predicted_winner: pred.predicted_winner,
          points_earned: pred.points_earned,
        } : undefined,
      }
    })

    setFinishedMatches(withPreds.filter(m => m.is_finished))
    setUpcomingMatches(withPreds.filter(m => !m.is_finished).reverse())
    setLoading(false)
  }

  function getPredBadge(match: MatchWithPred) {
    if (!match.prediction) return null
    const pts = match.prediction.points_earned
    if (pts >= 7) return { label: '✓ Score exact', color: 'bg-green-500/15 text-green-400 border border-green-500/20', pts }
    if (pts >= 3) return { label: '✓ Bon résultat', color: 'bg-blue-500/15 text-blue-400 border border-blue-500/20', pts }
    return { label: '✗ Raté', color: 'bg-red-500/15 text-red-400 border border-red-500/20', pts: 0 }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-white/40">Chargement…</p></div>
  }

  return (
    <div className="space-y-6">
      {/* Finished matches */}
      {finishedMatches.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" /> Résultats
          </h2>
          <div className="space-y-2">
            {finishedMatches.map(match => {
              const badge = getPredBadge(match)
              const actualWinner =
                match.score_home! > match.score_away! ? 'home' :
                match.score_away! > match.score_home! ? 'away' : 'draw'
              return (
                <div key={match.id} className="glass-card glass-card-hover rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/40 font-medium">{match.phase}</span>
                    <span className="text-xs text-white/30">{format(new Date(match.kickoff_at), 'd MMM', { locale: fr })}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xl">{match.flag_home}</span>
                      <span className={`text-sm font-semibold ${actualWinner === 'home' ? 'text-white' : 'text-white/30'}`}>{match.team_home}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-black text-white">{match.score_home}</span>
                      <span className="text-white/20 font-bold">–</span>
                      <span className="text-lg font-black text-white">{match.score_away}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 justify-end">
                      <span className={`text-sm font-semibold ${actualWinner === 'away' ? 'text-white' : 'text-white/30'}`}>{match.team_away}</span>
                      <span className="text-xl">{match.flag_away}</span>
                    </div>
                  </div>

                  {match.prediction && (
                    <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-between">
                      <div className="text-xs text-white/40">
                        Mon prono : <span className="font-semibold text-white/70">{match.prediction.predicted_home} – {match.prediction.predicted_away}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {badge && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                        )}
                        {badge && badge.pts > 0 && (
                          <span className="text-xs font-bold text-primary">+{badge.pts} pts</span>
                        )}
                      </div>
                    </div>
                  )}
                  {!match.prediction && (
                    <div className="mt-3 pt-3 border-t border-white/8">
                      <span className="text-xs text-white/30 italic">Pas de pronostic</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Upcoming matches */}
      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Circle className="w-4 h-4 text-primary" /> À venir
          </h2>
          <div className="space-y-2">
            {upcomingMatches.map(match => {
              const hasPred = !!match.prediction
              return (
                <div key={match.id} className="glass-card glass-card-hover rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/40 font-medium">{match.phase}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hasPred ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-orange-500/15 text-orange-400 border border-orange-500/20'}`}>
                      {hasPred ? '✓ Pronostic fait' : '⏳ À faire'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xl">{match.flag_home}</span>
                      <span className="text-sm font-semibold text-white">{match.team_home}</span>
                    </div>
                    <div className="text-xs text-white/40 font-medium">
                      {format(new Date(match.kickoff_at), 'EEE d MMM · HH:mm', { locale: fr })}
                    </div>
                    <div className="flex-1 flex items-center gap-2 justify-end">
                      <span className="text-sm font-semibold text-white">{match.team_away}</span>
                      <span className="text-xl">{match.flag_away}</span>
                    </div>
                  </div>
                  {hasPred && match.prediction && (
                    <div className="mt-2 text-xs text-white/40 text-center">
                      Mon prono : <span className="font-semibold text-white/60">{match.prediction.predicted_home} – {match.prediction.predicted_away}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {finishedMatches.length === 0 && upcomingMatches.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="font-semibold text-white">Aucun match encore programmé.</p>
        </div>
      )}
    </div>
  )
}
