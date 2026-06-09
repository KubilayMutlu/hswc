import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchWorldCupMatches, fetchMatchScore, mapApiMatchToSupabase, sleep, getCountryFlag } from '@/lib/footballApi'
import type { Match } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, CheckCircle, RefreshCw, Download, AlertCircle, Info, Trophy } from 'lucide-react'

type StatusMsg = { type: 'success' | 'error' | 'info'; message: string }

interface TournamentPredRow {
  id: string
  user_id: string
  type: string
  prediction: string
  is_correct: boolean
  profiles: { full_name: string; avatar_initials: string } | null
}

function calcPoints(
  predHome: number, predAway: number, predWinner: string,
  scoreHome: number, scoreAway: number, actualWinner: string,
): number {
  if (predHome === scoreHome && predAway === scoreAway) return 7
  const correctWinner = predWinner === actualWinner
  const partialScore = (predHome === scoreHome) !== (predAway === scoreAway)
  if (correctWinner && partialScore) return 4
  if (correctWinner) return 3
  if (partialScore) return 1
  return 0
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [scoreInputs, setScoreInputs] = useState<Record<string, { home: string; away: string }>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [newMatch, setNewMatch] = useState({
    phase: '', team_home: '', team_away: '', flag_home: '', flag_away: '', kickoff_at: '',
  })
  const [addingMatch, setAddingMatch] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [updatingScores, setUpdatingScores] = useState(false)
  const [syncStatus, setSyncStatus] = useState<StatusMsg | null>(null)
  const [updateProgress, setUpdateProgress] = useState('')
  const [tournamentPreds, setTournamentPreds] = useState<TournamentPredRow[]>([])
  const [tournamentProfiles, setTournamentProfiles] = useState<any[]>([])
  const [actualWinnerInput, setActualWinnerInput] = useState({ top_scorer: '', top_assist: '' })
  const [validatingTournament, setValidatingTournament] = useState<string | null>(null)
  const [tournamentStatus, setTournamentStatus] = useState<StatusMsg | null>(null)

  useEffect(() => {
    fetchMatches()
    loadTournamentData()
  }, [])

  async function fetchMatches() {
    const { data } = await supabase.from('matches').select('*').order('kickoff_at', { ascending: true })
    setMatches(data || [])
    setLoading(false)
  }

  async function loadTournamentData() {
    const [predsRes, profilesRes] = await Promise.all([
      supabase.from('tournament_predictions').select('*, profiles(full_name, avatar_initials)').order('created_at'),
      supabase.from('profiles').select('id, full_name, bonus_points'),
    ])
    if (predsRes.data) setTournamentPreds(predsRes.data as TournamentPredRow[])
    if (profilesRes.data) setTournamentProfiles(profilesRes.data)
  }

  async function handleValidateTournament(type: 'top_scorer' | 'top_assist') {
    const actual = actualWinnerInput[type].trim()
    if (!actual) return
    setValidatingTournament(type)
    setTournamentStatus(null)

    const actualNorm = actual.toLowerCase()
    const matching = tournamentPreds.filter(p =>
      p.type === type && p.prediction.trim().toLowerCase() === actualNorm && !p.is_correct
    )

    for (const pred of matching) {
      await supabase.from('tournament_predictions').update({ is_correct: true }).eq('id', pred.id)
      const profile = tournamentProfiles.find(p => p.id === pred.user_id)
      const currentBonus = profile?.bonus_points || 0
      await supabase.from('profiles').update({ bonus_points: currentBonus + 20 }).eq('id', pred.user_id)
    }

    await loadTournamentData()
    setValidatingTournament(null)
    setTournamentStatus({
      type: matching.length > 0 ? 'success' : 'info',
      message: matching.length > 0
        ? `✓ ${matching.length} gagnant${matching.length > 1 ? 's' : ''} validé${matching.length > 1 ? 's' : ''} · +20 pts chacun`
        : 'Aucune prédiction ne correspond exactement (vérifier la casse)',
    })
  }

  async function handleSyncMatches() {
    setSyncing(true)
    setSyncStatus(null)
    try {
      const apiMatches = await fetchWorldCupMatches()

      // Count existing external IDs
      const { data: existing } = await supabase.from('matches').select('external_id').not('external_id', 'is', null)
      const existingIds = new Set(existing?.map(m => m.external_id) ?? [])

      let imported = 0, updated = 0
      const toUpsert = apiMatches.map((m: any) => {
        if (existingIds.has(m.id)) updated++
        else imported++
        return mapApiMatchToSupabase(m)
      })

      const { error } = await supabase
        .from('matches')
        .upsert(toUpsert, { onConflict: 'external_id' })

      if (error) throw new Error(error.message)

      await fetchMatches()
      setSyncStatus({ type: 'success', message: `✓ ${imported} matchs importés, ${updated} mis à jour` })
    } catch (err) {
      setSyncStatus({ type: 'error', message: `Erreur sync: ${err instanceof Error ? err.message : 'Inconnue'}` })
    }
    setSyncing(false)
  }

  async function handleUpdateScores() {
    setUpdatingScores(true)
    setSyncStatus(null)
    setUpdateProgress('')

    try {
      const now = new Date().toISOString()
      const { data: matchesToUpdate } = await supabase
        .from('matches')
        .select('*')
        .eq('is_finished', false)
        .not('external_id', 'is', null)
        .lt('kickoff_at', now)

      if (!matchesToUpdate || matchesToUpdate.length === 0) {
        setSyncStatus({ type: 'info', message: 'Aucun match à mettre à jour pour l\'instant.' })
        setUpdatingScores(false)
        return
      }

      let processed = 0, totalPoints = 0

      for (let i = 0; i < matchesToUpdate.length; i++) {
        const match = matchesToUpdate[i]
        setUpdateProgress(`${i + 1}/${matchesToUpdate.length}`)

        await sleep(100)

        try {
          const scoreData = await fetchMatchScore(match.external_id)

          if (scoreData.status === 'FINISHED' && scoreData.home !== null && scoreData.away !== null) {
            const scoreHome = scoreData.home
            const scoreAway = scoreData.away
            const actualWinner = scoreHome > scoreAway ? 'home' : scoreAway > scoreHome ? 'away' : 'draw'

            await supabase.from('matches').update({
              score_home: scoreHome,
              score_away: scoreAway,
              is_finished: true,
              status: 'FINISHED',
            }).eq('id', match.id)

            const { data: preds } = await supabase
              .from('predictions')
              .select('*')
              .eq('match_id', match.id)

            if (preds) {
              const { data: doubleUses } = await supabase
                .from('power_up_uses')
                .select('user_id')
                .eq('match_id', match.id)
                .eq('type', 'double')
              const doubleUserIds = new Set(doubleUses?.map((u: any) => u.user_id) ?? [])

              for (const pred of preds) {
                const base = calcPoints(pred.predicted_home, pred.predicted_away, pred.predicted_winner, scoreHome, scoreAway, actualWinner)
                const points = base * (doubleUserIds.has(pred.user_id) ? 2 : 1)
                totalPoints += points
                await supabase.from('predictions').update({ points_earned: points }).eq('id', pred.id)
              }
            }
            processed++
          }
        } catch (e) {
          console.error(`Échec mise à jour match ${match.external_id}:`, e)
        }
      }

      await fetchMatches()
      setUpdateProgress('')
      setSyncStatus({
        type: 'success',
        message: `✓ ${processed} match${processed > 1 ? 's' : ''} terminé${processed > 1 ? 's' : ''} traité${processed > 1 ? 's' : ''}, ${totalPoints} pts attribués`,
      })
    } catch (err) {
      setSyncStatus({ type: 'error', message: `Erreur: ${err instanceof Error ? err.message : 'Inconnue'}` })
    }

    setUpdatingScores(false)
    setUpdateProgress('')
  }

  async function handleFinishMatch(match: Match) {
    const input = scoreInputs[match.id]
    if (!input || input.home === '' || input.away === '') return
    setSubmitting(match.id)

    const scoreHome = parseInt(input.home)
    const scoreAway = parseInt(input.away)
    const actualWinner = scoreHome > scoreAway ? 'home' : scoreAway > scoreHome ? 'away' : 'draw'

    await supabase.from('matches').update({
      score_home: scoreHome,
      score_away: scoreAway,
      is_finished: true,
      status: 'FINISHED',
    }).eq('id', match.id)

    const { data: preds } = await supabase.from('predictions').select('*').eq('match_id', match.id)
    if (preds) {
      const { data: doubleUses } = await supabase
        .from('power_up_uses')
        .select('user_id')
        .eq('match_id', match.id)
        .eq('type', 'double')
      const doubleUserIds = new Set(doubleUses?.map((u: any) => u.user_id) ?? [])

      for (const pred of preds) {
        const base = calcPoints(pred.predicted_home, pred.predicted_away, pred.predicted_winner, scoreHome, scoreAway, actualWinner)
        const points = base * (doubleUserIds.has(pred.user_id) ? 2 : 1)
        await supabase.from('predictions').update({ points_earned: points }).eq('id', pred.id)
      }
    }

    await fetchMatches()
    setSubmitting(null)
  }

  async function handleAddMatch() {
    setAddingMatch(true)
    setAddError(null)
    setAddSuccess(false)
    const { error } = await supabase.from('matches').insert([{
      phase: newMatch.phase,
      team_home: newMatch.team_home,
      team_away: newMatch.team_away,
      flag_home: newMatch.flag_home || getCountryFlag(newMatch.team_home),
      flag_away: newMatch.flag_away || getCountryFlag(newMatch.team_away),
      kickoff_at: new Date(newMatch.kickoff_at).toISOString(),
      is_finished: false,
      status: 'SCHEDULED',
    }])
    if (error) {
      setAddError(`Erreur : ${error.message}`)
    } else {
      setNewMatch({ phase: '', team_home: '', team_away: '', flag_home: '', flag_away: '', kickoff_at: '' })
      setAddSuccess(true)
      setTimeout(() => setAddSuccess(false), 3000)
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

  const statusColors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const statusIcon = {
    success: <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="text-primary text-sm">⚙️</span>
        </div>
        <h1 className="text-lg font-bold text-dark">Panel Admin</h1>
      </div>

      {/* API Sync section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-dark mb-1 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Synchronisation API Football
        </h2>
        <p className="text-xs text-gray-400 mb-4">Données via football-data.org — WC 2026</p>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleSyncMatches}
            disabled={syncing || updatingScores}
            className="flex-1 flex items-center justify-center gap-2 bg-dark text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-dark/90 transition disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation…' : 'Synchroniser les matchs'}
          </button>
          <button
            onClick={handleUpdateScores}
            disabled={syncing || updatingScores}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-2.5 font-semibold text-sm hover:bg-primary/90 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${updatingScores ? 'animate-spin' : ''}`} />
            {updatingScores
              ? updateProgress ? `Mise à jour… (${updateProgress})` : 'Mise à jour…'
              : 'Mettre à jour les scores'}
          </button>
        </div>

        {syncStatus && (
          <div className={`mt-3 flex items-center gap-2 text-sm border rounded-lg px-3 py-2 ${statusColors[syncStatus.type]}`}>
            {statusIcon[syncStatus.type]}
            <span>{syncStatus.message}</span>
          </div>
        )}
      </div>

      {/* Add match form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-dark mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Ajouter un match manuellement</h2>
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
            <label className="text-xs font-medium text-gray-500 mb-1 block">Équipe domicile</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="France"
              value={newMatch.team_home}
              onChange={e => setNewMatch(prev => ({ ...prev, team_home: e.target.value }))}
              onBlur={e => {
                const flag = getCountryFlag(e.target.value)
                if (flag !== '🏳️') setNewMatch(prev => ({ ...prev, flag_home: flag }))
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Drapeau domicile (auto)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="🇫🇷" value={newMatch.flag_home} onChange={e => setNewMatch(prev => ({ ...prev, flag_home: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Équipe extérieure</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Brésil"
              value={newMatch.team_away}
              onChange={e => setNewMatch(prev => ({ ...prev, team_away: e.target.value }))}
              onBlur={e => {
                const flag = getCountryFlag(e.target.value)
                if (flag !== '🏳️') setNewMatch(prev => ({ ...prev, flag_away: flag }))
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Drapeau extérieur (auto)</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="🇧🇷" value={newMatch.flag_away} onChange={e => setNewMatch(prev => ({ ...prev, flag_away: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Date et heure de coup d'envoi</label>
            <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={newMatch.kickoff_at} onChange={e => setNewMatch(prev => ({ ...prev, kickoff_at: e.target.value }))} />
          </div>
        </div>
        {addError && (
          <div className="mt-3 flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-red-50 border-red-200 text-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{addError}</span>
          </div>
        )}
        {addSuccess && (
          <div className="mt-3 flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-green-50 border-green-200 text-green-800">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <span>Match ajouté — visible dans Pronostics.</span>
          </div>
        )}
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
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-400">{match.phase}</span>
                {match.status && match.status !== 'SCHEDULED' && match.status !== 'FINISHED' && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-1.5 py-0.5 rounded-full">{match.status}</span>
                )}
              </div>
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
            Aucun match. Utilise la sync API ou ajoute-en un manuellement.
          </div>
        )}
      </div>

      {/* Tournament defis section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-dark mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" /> Défis Tournoi
        </h2>

        {tournamentStatus && (
          <div className={`mb-4 flex items-center gap-2 text-sm border rounded-lg px-3 py-2 ${
            tournamentStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-800'
            : tournamentStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {tournamentStatus.type === 'success' ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              : tournamentStatus.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              : <Info className="w-4 h-4 text-blue-500 shrink-0" />}
            <span>{tournamentStatus.message}</span>
          </div>
        )}

        <div className="space-y-6">
          {([
            { type: 'top_scorer' as const, icon: '🥇', label: 'Meilleur buteur' },
            { type: 'top_assist' as const, icon: '🎯', label: 'Meilleur passeur' },
          ]).map(defi => {
            const preds = tournamentPreds.filter(p => p.type === defi.type)
            return (
              <div key={defi.type}>
                <h3 className="text-sm font-semibold text-dark mb-3">{defi.icon} {defi.label}</h3>

                {preds.length === 0 ? (
                  <p className="text-xs text-gray-400 italic mb-3">Aucune prédiction pour l'instant.</p>
                ) : (
                  <div className="space-y-1 mb-3 max-h-48 overflow-y-auto rounded-xl border border-gray-100 divide-y divide-gray-50">
                    {preds.map(pred => (
                      <div key={pred.id} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">
                            {pred.profiles?.avatar_initials || '?'}
                          </div>
                          <span className="text-sm text-gray-600">{pred.profiles?.full_name || pred.user_id.slice(0, 8)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-dark">{pred.prediction}</span>
                          {pred.is_correct && (
                            <span className="text-xs bg-green-100 text-green-700 font-semibold px-1.5 py-0.5 rounded-full">✓ +20</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`Vrai ${defi.label.toLowerCase()}…`}
                    value={actualWinnerInput[defi.type]}
                    onChange={e => setActualWinnerInput(prev => ({ ...prev, [defi.type]: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => handleValidateTournament(defi.type)}
                    disabled={validatingTournament === defi.type || !actualWinnerInput[defi.type].trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {validatingTournament === defi.type ? '…' : 'Valider les gagnants'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">La comparaison ignore la casse. Seules les prédictions non encore validées sont traitées.</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
