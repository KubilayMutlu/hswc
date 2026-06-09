import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useLeague } from '@/context/LeagueContext'

interface ChallengeResult {
  leader_name: string
  leader_initials: string
  score: string | number
}

interface Challenge {
  id: string
  title: string
  description: string
  icon: string
  result: ChallengeResult | null
}

interface TeamStat {
  id: string
  title: string
  icon: string
  description: string
  teamName: string
  teamFlag: string
  stat: string
}

export default function DefisPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [teamStats, setTeamStats] = useState<TeamStat[]>([])
  const [loading, setLoading] = useState(true)
  const { activeMemberIds } = useLeague()

  useEffect(() => {
    computeChallenges(activeMemberIds)
  }, [activeMemberIds])

  async function computeChallenges(memberIds: string[] | null) {
    setLoading(true)
    const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, avatar_initials')
    const { data: predictions } = await supabase.from('predictions').select('*')
    const { data: matches } = await supabase.from('matches').select('*')

    if (!allProfiles || !predictions || !matches) { setLoading(false); return }

    const profiles = memberIds
      ? allProfiles.filter(p => memberIds.includes(p.id))
      : allProfiles

    function bestUser(scorer: (uid: string) => number): ChallengeResult | null {
      let best: { uid: string; score: number } | null = null
      for (const p of profiles) {
        const score = scorer(p.id)
        if (!best || score > best.score) best = { uid: p.id, score }
      }
      if (!best || best.score === 0) return null
      const profile = profiles.find(p => p.id === best!.uid)
      return {
        leader_name: profile?.full_name || '?',
        leader_initials: profile?.avatar_initials || '?',
        score: best.score,
      }
    }

    const groupPhases = ['Groupe A','Groupe B','Groupe C','Groupe D','Groupe E','Groupe F','Groupe G','Groupe H','Phase de groupes']
    const groupMatchIds = matches.filter(m => groupPhases.some(g => m.phase?.includes(g))).map(m => m.id)
    const r16MatchIds = matches.filter(m => m.phase?.includes('8e')).map(m => m.id)
    const sfMatchIds = matches.filter(m => m.phase?.includes('demi') || m.phase?.includes('Demi')).map(m => m.id)
    const finalMatchIds = matches.filter(m => m.phase?.toLowerCase().includes('final') && !m.phase?.toLowerCase().includes('demi')).map(m => m.id)
    const finishedMatchIds = matches.filter(m => m.is_finished).map(m => m.id)

    const roiGroupes = bestUser(uid =>
      predictions.filter(p => p.user_id === uid && groupMatchIds.includes(p.match_id)).reduce((s, p) => s + (p.points_earned || 0), 0)
    )

    const sniper = bestUser(uid =>
      predictions.filter(p => p.user_id === uid && p.points_earned >= 7).length
    )

    const serie = bestUser(uid => {
      const matchesSorted = matches
        .filter(m => m.is_finished)
        .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
      let maxStreak = 0, cur = 0
      for (const m of matchesSorted) {
        const p = predictions.find(pr => pr.user_id === uid && pr.match_id === m.id)
        if (p && p.points_earned > 0) { cur++; maxStreak = Math.max(maxStreak, cur) }
        else { cur = 0 }
      }
      return maxStreak
    })

    const maitre8 = bestUser(uid =>
      predictions.filter(p => p.user_id === uid && r16MatchIds.includes(p.match_id)).reduce((s, p) => s + (p.points_earned || 0), 0)
    )

    const oracleDemis = bestUser(uid =>
      predictions.filter(p => p.user_id === uid && sfMatchIds.includes(p.match_id)).reduce((s, p) => s + (p.points_earned || 0), 0)
    )

    // Oracle global: best % of correct winner predictions over finished matches
    const oraclePercent = bestUser(uid => {
      const userPreds = predictions.filter(p => p.user_id === uid && finishedMatchIds.includes(p.match_id))
      if (userPreds.length < 3) return 0
      const correct = userPreds.filter(p => (p.points_earned || 0) >= 3).length
      return Math.round((correct / userPreds.length) * 100)
    })

    let champion: ChallengeResult | null = null
    const finalMatch = matches.find(m => finalMatchIds.includes(m.id) && m.is_finished)
    if (finalMatch) {
      const actualWinner = finalMatch.score_home! > finalMatch.score_away! ? 'home' : finalMatch.score_away! > finalMatch.score_home! ? 'away' : 'draw'
      const winners = predictions.filter(p =>
        p.match_id === finalMatch.id &&
        p.predicted_winner === actualWinner &&
        profiles.some(pr => pr.id === p.user_id)
      )
      if (winners.length > 0) {
        const first = winners[0]
        const p = profiles.find(pr => pr.id === first.user_id)
        champion = { leader_name: p?.full_name || '?', leader_initials: p?.avatar_initials || '?', score: '✓' }
      }
    }

    const addScore = (r: ChallengeResult | null, suffix: string) =>
      r ? { ...r, score: `${r.score}${suffix}` } : null

    setChallenges([
      { id: 'roi-groupes', title: 'Roi des groupes', description: 'Le plus de points sur la phase de groupes', icon: '👑', result: addScore(roiGroupes, ' pts') },
      { id: 'sniper', title: 'Sniper ultime', description: 'Le plus grand nombre de scores exacts', icon: '🎯', result: addScore(sniper, ' exacts') },
      { id: 'serie', title: 'Série en feu', description: 'La plus longue série de vainqueurs corrects consécutifs', icon: '🔥', result: addScore(serie, ' de suite') },
      { id: 'maitre-8', title: 'Maître des 8es', description: 'Le plus de points sur les 8es de finale', icon: '⚔️', result: addScore(maitre8, ' pts') },
      { id: 'oracle-demis', title: 'Oracle des demis', description: 'Le plus de points sur les demi-finales', icon: '🔮', result: addScore(oracleDemis, ' pts') },
      { id: 'oracle-global', title: 'Voyant', description: 'Le meilleur % de vainqueurs corrects (min. 3 matchs)', icon: '👁️', result: addScore(oraclePercent, '%') },
      { id: 'champion', title: 'Champion du monde', description: 'A correctement pronostiqué le vainqueur final', icon: '🏆', result: champion },
    ])

    // Team stats from finished matches
    const finishedMatches = matches.filter(m => m.is_finished && m.score_home !== null && m.score_away !== null)
    const teamMap: Record<string, { team: string; flag: string; scored: number; conceded: number; played: number }> = {}

    for (const m of finishedMatches) {
      if (!teamMap[m.team_home]) teamMap[m.team_home] = { team: m.team_home, flag: m.flag_home, scored: 0, conceded: 0, played: 0 }
      if (!teamMap[m.team_away]) teamMap[m.team_away] = { team: m.team_away, flag: m.flag_away, scored: 0, conceded: 0, played: 0 }

      teamMap[m.team_home].scored += m.score_home!
      teamMap[m.team_home].conceded += m.score_away!
      teamMap[m.team_home].played++

      teamMap[m.team_away].scored += m.score_away!
      teamMap[m.team_away].conceded += m.score_home!
      teamMap[m.team_away].played++
    }

    const teamList = Object.values(teamMap)
    const newTeamStats: TeamStat[] = []

    if (teamList.length > 0) {
      const topAttack = [...teamList].sort((a, b) => b.scored - a.scored)[0]
      newTeamStats.push({
        id: 'top-attack',
        title: 'Équipe en feu',
        icon: '⚽',
        description: 'L\'équipe ayant marqué le plus de buts',
        teamName: topAttack.team,
        teamFlag: topAttack.flag,
        stat: `${topAttack.scored} buts marqués`,
      })

      const qualified = teamList.filter(t => t.played >= 2)
      if (qualified.length > 0) {
        const bestDefense = [...qualified].sort((a, b) => a.conceded - b.conceded)[0]
        newTeamStats.push({
          id: 'best-defense',
          title: 'Forteresse',
          icon: '🛡️',
          description: 'L\'équipe ayant le moins encaissé (min. 2 matchs)',
          teamName: bestDefense.team,
          teamFlag: bestDefense.flag,
          stat: `${bestDefense.conceded} buts encaissés`,
        })
      }
    }

    setTeamStats(newTeamStats)
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-400">Calcul des défis…</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-dark mb-1">Défis</h2>
        <p className="text-sm text-gray-500">Classements thématiques en temps réel</p>
      </div>

      {teamStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Stats du tournoi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teamStats.map(stat => (
              <div key={stat.id} className="card card-hover rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl shrink-0">
                    {stat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-dark text-sm">{stat.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{stat.description}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2.5">
                  <span className="text-2xl">{stat.teamFlag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-dark truncate">{stat.teamName}</div>
                    <div className="text-xs text-primary font-bold">{stat.stat}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {teamStats.length > 0 && (
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Classements joueurs</h3>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {challenges.map(challenge => (
            <div key={challenge.id} className="card card-hover rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl shrink-0">
                  {challenge.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-dark text-sm">{challenge.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{challenge.description}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                {challenge.result ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {challenge.result.leader_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-dark truncate">{challenge.result.leader_name}</div>
                      <div className="text-xs text-primary font-bold">{challenge.result.score}</div>
                    </div>
                    <div className="text-lg">🏅</div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">Pas encore de leader</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
