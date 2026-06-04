import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'
import { useLeague } from '@/context/LeagueContext'
import { Trophy, Target, Crosshair, TrendingUp } from 'lucide-react'

interface LeaderboardEntry {
  id: string
  full_name: string
  avatar_initials: string
  total_points: number
  exact_scores: number
  correct_winners: number
}

interface ClassementPageProps {
  profile: Profile | null
}

export default function ClassementPage({ profile }: ClassementPageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { activeMemberIds, activeLeague } = useLeague()

  useEffect(() => {
    fetchLeaderboard(activeMemberIds)
  }, [activeMemberIds])

  async function fetchLeaderboard(memberIds: string[] | null) {
    setLoading(true)
    const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, avatar_initials')
    if (!allProfiles) { setLoading(false); return }

    const profiles = memberIds
      ? allProfiles.filter(p => memberIds.includes(p.id))
      : allProfiles

    const { data: predictions } = await supabase
      .from('predictions')
      .select('user_id, points_earned, predicted_home, predicted_away, predicted_winner, match_id')

    const entries: LeaderboardEntry[] = profiles.map(p => {
      const userPreds = predictions?.filter(pr => pr.user_id === p.id) || []
      const total_points = userPreds.reduce((sum, pr) => sum + (pr.points_earned || 0), 0)
      const exact_scores = userPreds.filter(pr => pr.points_earned >= 7).length
      const correct_winners = userPreds.filter(pr => pr.points_earned > 0).length
      return { ...p, total_points, exact_scores, correct_winners }
    })

    entries.sort((a, b) => b.total_points - a.total_points)
    setLeaderboard(entries)
    setLoading(false)
  }

  const myEntry = leaderboard.find(e => e.id === profile?.id)
  const myRank = leaderboard.findIndex(e => e.id === profile?.id) + 1
  const maxPoints = leaderboard[0]?.total_points || 1
  const totalPredictions = myEntry ? myEntry.correct_winners : 0
  const totalPossible = leaderboard.reduce((max, e) => Math.max(max, e.correct_winners), 0)
  const accuracy = totalPossible > 0 ? Math.round((totalPredictions / Math.max(totalPossible, 1)) * 100) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-white/40">Chargement du classement…</p>
      </div>
    )
  }

  const statCards = [
    { label: 'Points totaux', value: myEntry?.total_points || 0, icon: Trophy, color: 'text-gold', bg: 'bg-gold/10' },
    { label: 'Rang actuel', value: myRank ? `${myRank}e` : '-', icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Scores exacts', value: myEntry?.exact_scores || 0, icon: Crosshair, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Précision', value: `${accuracy}%`, icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ]

  const podium = leaderboard.slice(0, 3)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(card => (
          <div key={card.label} className="glass-card glass-card-hover rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-white">{card.value}</div>
            <div className="text-xs text-white/50 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Podium */}
      {podium.length >= 3 && (
        <div className="glass-card rounded-2xl p-6 bg-gradient-to-br from-primary/10 via-transparent to-gold/5">
          <h2 className="text-xs font-semibold text-white/50 mb-5 text-center uppercase tracking-wider">Podium</h2>
          <div className="flex items-end justify-center gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold mb-2">
                {podium[1]?.avatar_initials}
              </div>
              <div className="text-xs font-medium text-white/80 text-center max-w-16 truncate">{podium[1]?.full_name.split(' ')[0]}</div>
              <div className="text-xs text-white/40">{podium[1]?.total_points} pts</div>
              <div className="w-16 h-16 bg-white/10 rounded-t-lg flex items-end justify-center pb-1 mt-2">
                <span className="text-2xl">🥈</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold mb-2 ring-2 ring-gold shadow-lg shadow-primary/30">
                {podium[0]?.avatar_initials}
              </div>
              <div className="text-sm font-bold text-white text-center max-w-20 truncate">{podium[0]?.full_name.split(' ')[0]}</div>
              <div className="text-xs text-gold font-semibold">{podium[0]?.total_points} pts</div>
              <div className="w-20 h-24 bg-primary/20 rounded-t-lg flex items-end justify-center pb-1 mt-2">
                <span className="text-2xl">🥇</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-amber-600/60 flex items-center justify-center text-white text-sm font-bold mb-2">
                {podium[2]?.avatar_initials}
              </div>
              <div className="text-xs font-medium text-white/80 text-center max-w-16 truncate">{podium[2]?.full_name.split(' ')[0]}</div>
              <div className="text-xs text-white/40">{podium[2]?.total_points} pts</div>
              <div className="w-16 h-12 bg-amber-700/20 rounded-t-lg flex items-end justify-center pb-1 mt-2">
                <span className="text-2xl">🥉</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full leaderboard */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="font-semibold text-white">
            {activeLeague ? `Classement — ${activeLeague.name}` : 'Classement général'}
          </h2>
        </div>
        <div className="divide-y divide-white/5">
          {leaderboard.map((entry, index) => {
            const isMe = entry.id === profile?.id
            const pct = maxPoints > 0 ? Math.round((entry.total_points / maxPoints) * 100) : 0
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-5 py-3 transition ${
                  isMe ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : 'hover:bg-white/5'
                }`}
              >
                <div className={`w-6 text-center text-sm font-bold ${
                  index === 0 ? 'text-gold' : index === 1 ? 'text-white/50' : index === 2 ? 'text-amber-600' : 'text-white/30'
                }`}>
                  {index + 1}
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                  isMe ? 'bg-primary shadow-sm shadow-primary/40' : 'bg-white/15'
                }`}>
                  {entry.avatar_initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${isMe ? 'text-primary' : 'text-white'}`}>
                    {entry.full_name} {isMe && <span className="text-xs text-white/30">(moi)</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-white/8 rounded-full h-1.5 max-w-32">
                      <div
                        className={`h-full rounded-full transition-all ${isMe ? 'bg-primary' : 'bg-white/20'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/30">{entry.exact_scores} exact{entry.exact_scores > 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className={`text-sm font-bold shrink-0 ${isMe ? 'text-primary' : 'text-white'}`}>
                  {entry.total_points} pts
                </div>
              </div>
            )
          })}
          {leaderboard.length === 0 && (
            <div className="py-10 text-center text-white/30 text-sm">
              Aucun pronostic enregistré pour l'instant.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
