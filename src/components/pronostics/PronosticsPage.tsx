import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Match, Profile } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Lock } from 'lucide-react'
import MatchDetailModal from '@/components/matchs/MatchDetailModal'
import { useLeague } from '@/context/LeagueContext'

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

interface SpyResult {
  targetName: string
  targetUserId: string
  predicted_home: number | null
  predicted_away: number | null
}

interface ConfirmModal {
  type: 'double' | 'spy'
  matchId: string
  targetUserId?: string
  targetName?: string
}

function deriveWinner(home: number, away: number): 'home' | 'away' | 'draw' {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

const LIVE_STATUSES = ['IN_PLAY', 'PAUSED', 'FINISHED', 'SUSPENDED', 'POSTPONED', 'CANCELLED', 'AWARDED']

function isLocked(match: MatchWithPrediction): boolean {
  if (match.external_id != null) {
    if (match.status && LIVE_STATUSES.includes(match.status)) return true
    return new Date(match.kickoff_at).getTime() - Date.now() < 5 * 60 * 1000
  }
  return false
}

export default function PronosticsPage({ profile }: PronosticsPageProps) {
  const { activeMemberIds } = useLeague()
  const [matches, setMatches] = useState<MatchWithPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, { home: string; away: string }>>({})
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPrediction | null>(null)
  const [powerUps, setPowerUps] = useState({ spy: 3, double: 3 })
  const [doubleUses, setDoubleUses] = useState<Set<string>>(new Set())
  const [spyResults, setSpyResults] = useState<Record<string, SpyResult>>({})
  const [spyModalOpen, setSpyModalOpen] = useState<string | null>(null)
  const [leagueProfiles, setLeagueProfiles] = useState<{ id: string; full_name: string }[]>([])
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)

  const pollingIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  useEffect(() => {
    fetchMatchesAndPredictions()
    loadPowerUps()
    return () => { Object.values(pollingIntervals.current).forEach(clearInterval) }
  }, [])

  function startSpyPolling(matchId: string, targetUserId: string) {
    if (pollingIntervals.current[matchId]) return
    pollingIntervals.current[matchId] = setInterval(async () => {
      const { data: pred } = await supabase
        .from('predictions')
        .select('predicted_home, predicted_away')
        .eq('user_id', targetUserId)
        .eq('match_id', matchId)
        .maybeSingle()
      if (pred?.predicted_home !== null && pred?.predicted_home !== undefined) {
        setSpyResults(prev => ({
          ...prev,
          [matchId]: { ...prev[matchId], predicted_home: pred.predicted_home, predicted_away: pred.predicted_away },
        }))
        clearInterval(pollingIntervals.current[matchId])
        delete pollingIntervals.current[matchId]
      }
    }, 30000)
  }

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

  async function loadPowerUps() {
    if (!profile) return

    const [profilesRes, pupsRes, usesRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name'),
      supabase.from('power_ups').select('*').eq('user_id', profile.id),
      supabase.from('power_up_uses').select('*').eq('user_id', profile.id),
    ])

    if (profilesRes.data) setLeagueProfiles(profilesRes.data)

    if (pupsRes.data) {
      const spy = pupsRes.data.find((p: any) => p.type === 'spy')
      const dbl = pupsRes.data.find((p: any) => p.type === 'double')
      setPowerUps({ spy: spy?.uses_remaining ?? 0, double: dbl?.uses_remaining ?? 0 })
    }

    if (usesRes.data) {
      const doublesSet = new Set(
        usesRes.data.filter((u: any) => u.type === 'double').map((u: any) => u.match_id as string)
      )
      setDoubleUses(doublesSet)

      const spyUsesList = usesRes.data.filter((u: any) => u.type === 'spy')
      if (spyUsesList.length > 0) {
        const profiles = profilesRes.data || []
        const resolved = await Promise.all(spyUsesList.map(async (use: any) => {
          const tp = profiles.find((p: any) => p.id === use.target_user_id)
          const { data: pred } = await supabase
            .from('predictions')
            .select('predicted_home, predicted_away')
            .eq('user_id', use.target_user_id)
            .eq('match_id', use.match_id)
            .maybeSingle()
          return {
            matchId: use.match_id as string,
            result: {
              targetName: tp?.full_name?.split(' ')[0] || '?',
              targetUserId: use.target_user_id as string,
              predicted_home: pred?.predicted_home ?? null,
              predicted_away: pred?.predicted_away ?? null,
            } as SpyResult,
          }
        }))
        const results: Record<string, SpyResult> = {}
        resolved.forEach(({ matchId, result }) => {
          results[matchId] = result
          if (result.predicted_home === null) startSpyPolling(matchId, result.targetUserId)
        })
        setSpyResults(results)
      }
    }
  }

  async function handleSave(match: MatchWithPrediction) {
    const input = inputs[match.id]
    if (!input || input.home === '' || input.away === '' || !profile) return
    setSaving(match.id)
    const h = parseInt(input.home)
    const a = parseInt(input.away)
    await supabase.from('predictions').upsert({
      user_id: profile.id,
      match_id: match.id,
      predicted_home: h,
      predicted_away: a,
      predicted_winner: deriveWinner(h, a),
      points_earned: 0,
    }, { onConflict: 'user_id,match_id' })
    await fetchMatchesAndPredictions()
    setSaving(null)
  }

  async function handleDouble(matchId: string) {
    if (!profile || doubleUses.has(matchId) || powerUps.double <= 0) return
    const { error } = await supabase
      .from('power_ups')
      .update({ uses_remaining: powerUps.double - 1 })
      .eq('user_id', profile.id)
      .eq('type', 'double')
    if (error) return
    await supabase.from('power_up_uses').insert({ user_id: profile.id, match_id: matchId, type: 'double' })
    setPowerUps(prev => ({ ...prev, double: prev.double - 1 }))
    setDoubleUses(prev => new Set([...prev, matchId]))
  }

  async function handleSpy(matchId: string, targetUserId: string) {
    if (!profile || powerUps.spy <= 0) return
    const targetProfile = leagueProfiles.find(p => p.id === targetUserId)
    const targetName = targetProfile?.full_name?.split(' ')[0] || '?'
    const { error } = await supabase
      .from('power_ups')
      .update({ uses_remaining: powerUps.spy - 1 })
      .eq('user_id', profile.id)
      .eq('type', 'spy')
    if (error) return
    await supabase.from('power_up_uses').insert({
      user_id: profile.id, match_id: matchId, type: 'spy', target_user_id: targetUserId,
    })
    const { data: pred } = await supabase
      .from('predictions')
      .select('predicted_home, predicted_away')
      .eq('user_id', targetUserId)
      .eq('match_id', matchId)
      .maybeSingle()
    setPowerUps(prev => ({ ...prev, spy: prev.spy - 1 }))
    const result: SpyResult = {
      targetName,
      targetUserId,
      predicted_home: pred?.predicted_home ?? null,
      predicted_away: pred?.predicted_away ?? null,
    }
    setSpyResults(prev => ({ ...prev, [matchId]: result }))
    if (result.predicted_home === null) startSpyPolling(matchId, targetUserId)
  }

  async function handleConfirm() {
    if (!confirmModal) return
    const { type, matchId, targetUserId } = confirmModal
    setConfirmModal(null)
    if (type === 'double') await handleDouble(matchId)
    else if (type === 'spy' && targetUserId) await handleSpy(matchId, targetUserId)
  }

  function setInput(matchId: string, field: 'home' | 'away', value: string) {
    setInputs(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }))
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-400">Chargement…</p></div>
  }

  const upcoming = matches.filter(m => !isLocked(m))
  const locked = matches.filter(m => isLocked(m))
  const spyTargets = leagueProfiles.filter(p =>
    p.id !== profile?.id && (!activeMemberIds || activeMemberIds.includes(p.id))
  )

  const confirmDescriptions: Record<string, string> = {}
  if (confirmModal?.type === 'double') {
    confirmDescriptions['double'] = `Les points que tu gagnes sur ce match seront doublés. Tu utiliseras 1 atout Double Score (il t'en restera ${powerUps.double - 1}). Cette action est irréversible.`
  }
  if (confirmModal?.type === 'spy') {
    confirmDescriptions['spy'] = `Tu vas révéler le pronostic de ${confirmModal.targetName} sur ce match. Tu utiliseras 1 atout Espion (il t'en restera ${powerUps.spy - 1}). Cette action est définitive.`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-dark mb-2">Mes pronostics</h2>
        <div className="text-sm text-gray-500 space-y-0.5">
          <div>🎯 Score exact : <span className="font-semibold text-dark">7 pts</span></div>
          <div>✅ Bon résultat + 1 score partiel : <span className="font-semibold text-dark">4 pts</span></div>
          <div>✅ Bon résultat uniquement : <span className="font-semibold text-dark">3 pts</span></div>
          <div>〽️ 1 score partiel : <span className="font-semibold text-dark">1 pt</span></div>
        </div>
      </div>

      {upcoming.length === 0 && locked.length === 0 && (
        <div className="card rounded-2xl p-10 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="font-semibold text-dark">Tous les pronostics sont faits !</p>
          <p className="text-sm text-gray-500 mt-1">Reviens après les prochains matchs.</p>
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
              : derivedWinner === 'draw' ? 'Match nul' : null
            const isDoubleActive = doubleUses.has(match.id)
            const spyResult = spyResults[match.id]
            const isSpyDone = !!spyResult

            return (
              <div key={match.id} className="card card-hover rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-100 flex items-center justify-between cursor-pointer" onClick={() => setSelectedMatch(match)}>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{match.phase}</span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(match.kickoff_at), 'EEE d MMM · HH:mm', { locale: fr })}
                  </span>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-2xl">{match.flag_home}</span>
                      <span className="font-semibold text-dark text-sm">{match.team_home}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="0" max="20" value={input.home}
                        onChange={e => setInput(match.id, 'home', e.target.value)}
                        className="w-12 h-10 bg-white border-2 border-gray-200 rounded-lg text-center font-bold text-gray-800 focus:outline-none focus:border-primary transition text-lg"
                        placeholder="0"
                      />
                      <span className="text-gray-300 font-bold">–</span>
                      <input
                        type="number" min="0" max="20" value={input.away}
                        onChange={e => setInput(match.id, 'away', e.target.value)}
                        className="w-12 h-10 bg-white border-2 border-gray-200 rounded-lg text-center font-bold text-gray-800 focus:outline-none focus:border-primary transition text-lg"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex-1 flex items-center gap-2 justify-end">
                      <span className="font-semibold text-dark text-sm text-right">{match.team_away}</span>
                      <span className="text-2xl">{match.flag_away}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium transition-all ${winnerLabel ? 'text-primary' : 'text-gray-300'}`}>
                      {winnerLabel ? `→ ${winnerLabel}` : '→ Saisir un score'}
                    </span>
                    <div className="flex items-center gap-2">
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

                      {/* Double Score button */}
                      <div className="relative">
                        <button
                          onClick={() => !isDoubleActive && setConfirmModal({ type: 'double', matchId: match.id })}
                          disabled={!isDoubleActive && powerUps.double <= 0}
                          title={isDoubleActive ? 'Double score activé !' : `×2 Score (${powerUps.double} restant${powerUps.double > 1 ? 's' : ''})`}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                            isDoubleActive
                              ? 'bg-green-100 text-green-600 cursor-default'
                              : powerUps.double > 0
                              ? 'bg-violet-100 text-violet-600 hover:bg-violet-200 cursor-pointer'
                              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {isDoubleActive ? '✓' : '×2'}
                        </button>
                        {!isDoubleActive && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary text-white rounded-full text-[9px] flex items-center justify-center font-bold pointer-events-none">
                            {powerUps.double}
                          </span>
                        )}
                      </div>

                      {/* Spy button */}
                      <div className="relative">
                        <button
                          onClick={() => !isSpyDone && setSpyModalOpen(spyModalOpen === match.id ? null : match.id)}
                          disabled={powerUps.spy <= 0 && !isSpyDone}
                          title={isSpyDone ? 'Espion utilisé' : `Espionner un joueur (${powerUps.spy} restant${powerUps.spy > 1 ? 's' : ''})`}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition ${
                            isSpyDone
                              ? 'bg-blue-100 cursor-default'
                              : powerUps.spy > 0
                              ? 'bg-violet-100 text-violet-600 hover:bg-violet-200 cursor-pointer'
                              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          🔍
                        </button>
                        {!isSpyDone && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary text-white rounded-full text-[9px] flex items-center justify-center font-bold pointer-events-none">
                            {powerUps.spy}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Spy result */}
                  {spyResult && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                      <span>🔍 Prono de <span className="font-medium text-dark">{spyResult.targetName}</span> :</span>
                      {spyResult.predicted_home !== null
                        ? <span className="font-bold text-dark">{spyResult.predicted_home}–{spyResult.predicted_away}</span>
                        : <span className="italic">{spyResult.targetName} n'a pas encore pronostiqué ce match</span>
                      }
                    </div>
                  )}

                  {/* Spy target selector */}
                  {spyModalOpen === match.id && (
                    <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">Choisir qui espionner :</p>
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {spyTargets.map(target => (
                          <button
                            key={target.id}
                            onClick={() => {
                              setSpyModalOpen(null)
                              setConfirmModal({
                                type: 'spy',
                                matchId: match.id,
                                targetUserId: target.id,
                                targetName: target.full_name.split(' ')[0],
                              })
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-dark hover:bg-white rounded-lg transition"
                          >
                            {target.full_name}
                          </button>
                        ))}
                        {spyTargets.length === 0 && (
                          <p className="text-xs text-gray-400 italic px-1">Aucun membre dans votre ligue active</p>
                        )}
                      </div>
                    </div>
                  )}
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
            <div key={match.id} className="card card-hover rounded-xl px-5 py-3 flex items-center justify-between opacity-60 cursor-pointer" onClick={() => setSelectedMatch(match)}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{match.flag_home}</span>
                <span className="font-medium text-sm text-dark">{match.team_home}</span>
                <span className="text-gray-300 mx-1">vs</span>
                <span className="font-medium text-sm text-dark">{match.team_away}</span>
                <span className="text-xl">{match.flag_away}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {match.prediction && (
                  <span className="font-mono font-semibold text-gray-600">
                    {match.prediction.predicted_home}–{match.prediction.predicted_away}
                  </span>
                )}
                <Lock className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedMatch && (
        <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}

      {/* Confirmation modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">
                {confirmModal.type === 'double' ? '×2' : '🔍'}
              </div>
              <h3 className="font-bold text-dark text-base">
                {confirmModal.type === 'double' ? '×2 Double Score' : '🔍 Espionner un joueur'}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6 text-center leading-relaxed">
              {confirmModal.type === 'double' && confirmDescriptions['double']}
              {confirmModal.type === 'spy' && confirmDescriptions['spy']}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
