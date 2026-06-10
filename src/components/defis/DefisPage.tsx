import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useLeague } from '@/context/LeagueContext'
import type { Profile, TournamentPrediction } from '@/types'

interface DefisPageProps {
  profile: Profile | null
}

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

type TourneyType = TournamentPrediction['type']

// Votes open until June 17 2026, midnight Paris = 22:00 UTC
const TOURNAMENT_CUTOFF = new Date('2026-06-17T22:00:00Z')

const TOURNAMENT_DEFIS: Array<{ type: TourneyType; icon: string; title: string; description: string; placeholder: string }> = [
  { type: 'world_cup_winner',   icon: '🏆', title: 'Vainqueur de la Coupe du Monde', description: "Prédit l'équipe qui remportera le titre. +20 pts si correct.",                                              placeholder: 'Ex: France' },
  { type: 'top_scorer',        icon: '🥇', title: 'Meilleur buteur',                description: 'Prédit le joueur qui marquera le plus de buts. +20 pts si correct.',                                        placeholder: 'Ex: Kylian Mbappé' },
  { type: 'top_assist',        icon: '🎯', title: 'Meilleur passeur',               description: 'Prédit le joueur qui délivrera le plus de passes décisives. +20 pts si correct.',                           placeholder: 'Ex: Lamine Yamal' },
  { type: 'top_scoring_team',  icon: '⚽', title: 'Équipe la plus prolifique',      description: "Prédit l'équipe qui marquera le plus de buts dans le tournoi. +20 pts si correct.",                         placeholder: 'Ex: Espagne' },
  { type: 'most_conceded_team',icon: '🥅', title: 'Équipe la plus poreuse',         description: "Prédit l'équipe qui encaissera le plus de buts dans le tournoi. +20 pts si correct.",                       placeholder: 'Ex: Arabie Saoudite' },
  { type: 'worst_group_team',  icon: '😬', title: 'Pire équipe des poules',         description: "Prédit l'équipe qui finira dernière de son groupe avec le pire bilan. +20 pts si correct.",                 placeholder: 'Ex: Canada' },
]

const EMPTY_PREDS = Object.fromEntries(TOURNAMENT_DEFIS.map(d => [d.type, null])) as Record<TourneyType, TournamentPrediction | null>
const EMPTY_COUNTS = Object.fromEntries(TOURNAMENT_DEFIS.map(d => [d.type, 0])) as Record<TourneyType, number>
const EMPTY_INPUTS = Object.fromEntries(TOURNAMENT_DEFIS.map(d => [d.type, ''])) as Record<TourneyType, string>
const EMPTY_VOTES = Object.fromEntries(TOURNAMENT_DEFIS.map(d => [d.type, []])) as unknown as Record<TourneyType, Array<{ name: string; initials: string; prediction: string }>>

export default function DefisPage({ profile }: DefisPageProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [teamStats, setTeamStats] = useState<TeamStat[]>([])
  const [loading, setLoading] = useState(true)
  const { activeMemberIds } = useLeague()

  const [tournamentPreds, setTournamentPreds] = useState<Record<TourneyType, TournamentPrediction | null>>(EMPTY_PREDS)
  const [tournamentCounts, setTournamentCounts] = useState<Record<TourneyType, number>>(EMPTY_COUNTS)
  const [leagueMemberCount, setLeagueMemberCount] = useState(0)
  const [tournamentInputs, setTournamentInputs] = useState<Record<TourneyType, string>>(EMPTY_INPUTS)
  const [tournamentVotes, setTournamentVotes] = useState<Record<TourneyType, Array<{ name: string; initials: string; prediction: string }>>>(EMPTY_VOTES)
  const [showVotes, setShowVotes] = useState<Set<string>>(new Set())
  const [savingTournament, setSavingTournament] = useState<string | null>(null)
  const [editingTournament, setEditingTournament] = useState<Set<string>>(new Set())

  const canEdit = Date.now() < TOURNAMENT_CUTOFF.getTime()

  useEffect(() => {
    computeChallenges(activeMemberIds)
    loadTournamentSection(activeMemberIds)
  }, [activeMemberIds, profile?.id])

  async function loadTournamentSection(memberIds: string[] | null) {
    if (!profile?.id) return

    const [profilesRes, predsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_initials'),
      supabase.from('tournament_predictions').select('*'),
    ])

    const allProfilesData = profilesRes.data || []
    const leagueIds = memberIds || allProfilesData.map((p: any) => p.id)
    const allPreds: TournamentPrediction[] = predsRes.data || []

    const myPreds = Object.fromEntries(
      TOURNAMENT_DEFIS.map(d => [
        d.type,
        allPreds.find(p => p.user_id === profile.id && p.type === d.type) ?? null,
      ])
    ) as Record<TourneyType, TournamentPrediction | null>

    const counts = Object.fromEntries(
      TOURNAMENT_DEFIS.map(d => [
        d.type,
        allPreds.filter(p => leagueIds.includes(p.user_id) && p.type === d.type).length,
      ])
    ) as Record<TourneyType, number>

    const votes = Object.fromEntries(
      TOURNAMENT_DEFIS.map(d => [
        d.type,
        allPreds
          .filter(p => leagueIds.includes(p.user_id) && p.type === d.type)
          .map(p => {
            const pr = allProfilesData.find((x: any) => x.id === p.user_id)
            return {
              name: pr?.full_name?.split(' ')[0] || '?',
              initials: pr?.avatar_initials || '?',
              prediction: p.prediction,
            }
          }),
      ])
    ) as Record<TourneyType, Array<{ name: string; initials: string; prediction: string }>>

    setTournamentPreds(myPreds)
    setTournamentCounts(counts)
    setTournamentVotes(votes)
    setLeagueMemberCount(leagueIds.length)
  }

  async function saveTournamentPred(type: TourneyType) {
    if (!profile?.id) return
    const value = tournamentInputs[type].trim()
    if (!value) return
    setSavingTournament(type)

    await supabase.from('tournament_predictions').upsert({
      user_id: profile.id, type, prediction: value, is_correct: false,
    }, { onConflict: 'user_id,type' })

    setEditingTournament(prev => { const n = new Set(prev); n.delete(type); return n })
    await loadTournamentSection(activeMemberIds)
    setSavingTournament(null)
  }

  function startEditing(type: TourneyType) {
    const pred = tournamentPreds[type]
    if (pred) setTournamentInputs(prev => ({ ...prev, [type]: pred.prediction }))
    setEditingTournament(prev => new Set([...prev, type]))
  }

  function toggleVotes(type: TourneyType) {
    setShowVotes(prev => {
      const n = new Set(prev)
      if (n.has(type)) n.delete(type)
      else n.add(type)
      return n
    })
  }

  async function computeChallenges(memberIds: string[] | null) {
    setLoading(true)
    const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, avatar_initials')
    const { data: predictions } = await supabase.from('predictions').select('*')
    const { data: matches } = await supabase.from('matches').select('*')

    if (!allProfiles || !predictions || !matches) { setLoading(false); return }

    const profiles = memberIds ? allProfiles.filter(p => memberIds.includes(p.id)) : allProfiles

    function bestUser(scorer: (uid: string) => number): ChallengeResult | null {
      let best: { uid: string; score: number } | null = null
      for (const p of profiles) {
        const score = scorer(p.id)
        if (!best || score > best.score) best = { uid: p.id, score }
      }
      if (!best || best.score === 0) return null
      const profile = profiles.find(p => p.id === best!.uid)
      return { leader_name: profile?.full_name || '?', leader_initials: profile?.avatar_initials || '?', score: best.score }
    }

    const groupPhases = ['Groupe A','Groupe B','Groupe C','Groupe D','Groupe E','Groupe F','Groupe G','Groupe H','Phase de groupes']
    const groupMatchIds = matches.filter(m => groupPhases.some(g => m.phase?.includes(g))).map(m => m.id)
    const r16MatchIds = matches.filter(m => m.phase?.includes('8e')).map(m => m.id)
    const sfMatchIds = matches.filter(m => m.phase?.includes('demi') || m.phase?.includes('Demi')).map(m => m.id)
    const finishedMatchIds = matches.filter(m => m.is_finished).map(m => m.id)

    const roiGroupes = bestUser(uid => predictions.filter(p => p.user_id === uid && groupMatchIds.includes(p.match_id)).reduce((s, p) => s + (p.points_earned || 0), 0))
    const sniper = bestUser(uid => predictions.filter(p => p.user_id === uid && p.points_earned >= 7).length)
    const serie = bestUser(uid => {
      const sorted = matches.filter(m => m.is_finished).sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
      let max = 0, cur = 0
      for (const m of sorted) {
        const p = predictions.find(pr => pr.user_id === uid && pr.match_id === m.id)
        if (p && p.points_earned > 0) { cur++; max = Math.max(max, cur) } else { cur = 0 }
      }
      return max
    })
    const maitre8 = bestUser(uid => predictions.filter(p => p.user_id === uid && r16MatchIds.includes(p.match_id)).reduce((s, p) => s + (p.points_earned || 0), 0))
    const oracleDemis = bestUser(uid => predictions.filter(p => p.user_id === uid && sfMatchIds.includes(p.match_id)).reduce((s, p) => s + (p.points_earned || 0), 0))
    const oraclePercent = bestUser(uid => {
      const userPreds = predictions.filter(p => p.user_id === uid && finishedMatchIds.includes(p.match_id))
      if (userPreds.length < 3) return 0
      return Math.round((userPreds.filter(p => (p.points_earned || 0) >= 3).length / userPreds.length) * 100)
    })

    const addScore = (r: ChallengeResult | null, suffix: string) => r ? { ...r, score: `${r.score}${suffix}` } : null

    setChallenges([
      { id: 'roi-groupes',   title: 'Roi des groupes',   description: 'Le plus de points sur la phase de groupes',                    icon: '👑', result: addScore(roiGroupes, ' pts') },
      { id: 'sniper',        title: 'Sniper ultime',     description: 'Le plus grand nombre de scores exacts',                         icon: '🎯', result: addScore(sniper, ' exacts') },
      { id: 'serie',         title: 'Série en feu',      description: 'La plus longue série de vainqueurs corrects consécutifs',       icon: '🔥', result: addScore(serie, ' de suite') },
      { id: 'maitre-8',      title: 'Maître des 8es',    description: 'Le plus de points sur les 8es de finale',                       icon: '⚔️', result: addScore(maitre8, ' pts') },
      { id: 'oracle-demis',  title: 'Oracle des demis',  description: 'Le plus de points sur les demi-finales',                        icon: '🔮', result: addScore(oracleDemis, ' pts') },
      { id: 'oracle-global', title: 'Voyant',            description: 'Le meilleur % de vainqueurs corrects (min. 3 matchs)',          icon: '👁️', result: addScore(oraclePercent, '%') },
    ])

    // Team stats
    const finishedMatches = matches.filter(m => m.is_finished && m.score_home !== null && m.score_away !== null)
    const teamMap: Record<string, { team: string; flag: string; scored: number; conceded: number; played: number }> = {}
    for (const m of finishedMatches) {
      if (!teamMap[m.team_home]) teamMap[m.team_home] = { team: m.team_home, flag: m.flag_home, scored: 0, conceded: 0, played: 0 }
      if (!teamMap[m.team_away]) teamMap[m.team_away] = { team: m.team_away, flag: m.flag_away, scored: 0, conceded: 0, played: 0 }
      teamMap[m.team_home].scored += m.score_home!; teamMap[m.team_home].conceded += m.score_away!; teamMap[m.team_home].played++
      teamMap[m.team_away].scored += m.score_away!; teamMap[m.team_away].conceded += m.score_home!; teamMap[m.team_away].played++
    }
    const teamList = Object.values(teamMap)
    const newTeamStats: TeamStat[] = []
    if (teamList.length > 0) {
      const topAttack = [...teamList].sort((a, b) => b.scored - a.scored)[0]
      newTeamStats.push({ id: 'top-attack', title: 'Équipe en feu', icon: '⚽', description: "L'équipe ayant marqué le plus de buts", teamName: topAttack.team, teamFlag: topAttack.flag, stat: `${topAttack.scored} buts marqués` })
      const qualified = teamList.filter(t => t.played >= 2)
      if (qualified.length > 0) {
        const bestDef = [...qualified].sort((a, b) => a.conceded - b.conceded)[0]
        newTeamStats.push({ id: 'best-defense', title: 'Forteresse', icon: '🛡️', description: "L'équipe ayant le moins encaissé (min. 2 matchs)", teamName: bestDef.team, teamFlag: bestDef.flag, stat: `${bestDef.conceded} buts encaissés` })
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

      {/* Tournament defis */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Défis Tournoi</h3>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 mb-3">
          <span>⏰</span>
          <span>Les votes sont ouverts jusqu'au <strong className="text-gray-600">17 juin 2026 à minuit</strong>. Après cette date, plus aucune modification ne sera possible.</span>
        </div>
        {TOURNAMENT_DEFIS.map(defi => {
          const myPred = tournamentPreds[defi.type]
          const count = tournamentCounts[defi.type]
          const votes = tournamentVotes[defi.type]
          const isEditing = editingTournament.has(defi.type)
          const isSaving = savingTournament === defi.type
          const showInput = !myPred || isEditing
          const votesVisible = showVotes.has(defi.type)

          return (
            <div key={defi.type} className="card rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl shrink-0">
                  {defi.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-dark text-sm">{defi.title}</h3>
                    {myPred?.is_correct && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        ✓ +20 pts gagnés !
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{defi.description}</p>
                </div>
              </div>

              {showInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tournamentInputs[defi.type]}
                    onChange={e => setTournamentInputs(prev => ({ ...prev, [defi.type]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveTournamentPred(defi.type)}
                    placeholder={defi.placeholder}
                    disabled={!canEdit}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  {canEdit && (
                    <button
                      onClick={() => saveTournamentPred(defi.type)}
                      disabled={isSaving || !tournamentInputs[defi.type].trim()}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      {isSaving ? '…' : 'Valider'}
                    </button>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => setEditingTournament(prev => { const n = new Set(prev); n.delete(defi.type); return n })}
                      className="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-400">Ta prédiction :</span>
                    <span className="text-sm font-semibold text-dark truncate">{myPred.prediction}</span>
                  </div>
                  {canEdit && !myPred.is_correct && (
                    <button
                      onClick={() => startEditing(defi.type)}
                      className="shrink-0 text-xs text-gray-400 hover:text-primary underline underline-offset-2 transition"
                    >
                      Modifier
                    </button>
                  )}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {count}/{leagueMemberCount} membres ont prédit
                </span>
                {count > 0 && (
                  <button
                    onClick={() => toggleVotes(defi.type)}
                    className="text-xs text-gray-400 hover:text-primary transition"
                  >
                    {votesVisible ? 'Masquer les votes' : 'Voir les votes'}
                  </button>
                )}
              </div>

              {votesVisible && votes.length > 0 && (
                <div className="mt-2 space-y-1">
                  {votes.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                        {v.initials}
                      </div>
                      <span className="text-xs text-gray-500 min-w-0 truncate">{v.name}</span>
                      <span className="text-xs font-semibold text-dark ml-auto shrink-0">{v.prediction}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {!canEdit && TOURNAMENT_DEFIS.every(d => !tournamentPreds[d.type]) && (
          <p className="text-xs text-gray-400 italic px-1">Les prédictions de tournoi sont closes depuis le début de la compétition.</p>
        )}
      </div>

      {/* Team stats */}
      {teamStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Stats du tournoi</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teamStats.map(stat => (
              <div key={stat.id} className="card card-hover rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl shrink-0">{stat.icon}</div>
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

      {/* Player challenges */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Classements joueurs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {challenges.map(challenge => (
            <div key={challenge.id} className="card card-hover rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-xl shrink-0">{challenge.icon}</div>
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
