import { useState, useEffect } from 'react'
import type { Match } from '@/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { X, MapPin, User, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  findApiFootballFixture,
  fetchFixtureDetails,
  fetchLineups,
  fetchMatchStats,
  fetchGroupStandings,
  fetchTeamForm,
  type ApiFixtureRef,
  type FixtureInfo,
  type Lineup,
  type MatchStats,
  type TeamStanding,
  type FormMatch,
} from '@/lib/apiFootball'

type Tab = 'apercu' | 'compositions' | 'classement' | 'forme'

interface Props {
  match: Match
  onClose: () => void
}

function Spinner() {
  return <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
}

function StatBar({ label, home, away }: { label: string; home: string | number | null; away: string | number | null }) {
  const parseNum = (v: string | number | null) => {
    if (v === null || v === undefined) return 0
    if (typeof v === 'number') return v
    return parseFloat(v.replace('%', '')) || 0
  }
  const h = parseNum(home)
  const a = parseNum(away)
  const total = h + a || 1
  const hPct = Math.round((h / total) * 100)
  const isPercent = typeof home === 'string' && home?.includes('%')
  const display = (v: string | number | null) => v ?? '0'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span className="font-semibold text-dark">{display(home)}{isPercent ? '' : ''}</span>
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold text-dark">{display(away)}</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
        <div className="bg-primary transition-all" style={{ width: `${hPct}%` }} />
        <div className="bg-gray-300 transition-all" style={{ width: `${100 - hPct}%` }} />
      </div>
    </div>
  )
}

function ResultBadge({ result }: { result: 'W' | 'D' | 'L' }) {
  const cls = result === 'W'
    ? 'bg-green-100 text-green-700'
    : result === 'L'
    ? 'bg-red-100 text-red-700'
    : 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${cls}`}>
      {result}
    </span>
  )
}

function extractGroupLetter(phase: string): string | null {
  const m = phase.match(/Groupe ([A-Z])/i)
  return m ? m[1].toUpperCase() : null
}

const KEY_STATS = ['Ball Possession', 'Shots on Goal', 'Total Shots', 'Corner Kicks', 'Yellow Cards']

export default function MatchDetailModal({ match, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('apercu')

  const [apiRef, setApiRef] = useState<ApiFixtureRef | null>(null)
  const [hasApiData, setHasApiData] = useState<boolean | null>(null)

  const [fixtureInfo, setFixtureInfo] = useState<FixtureInfo | null>(null)
  const [lineups, setLineups] = useState<Lineup[] | null>(null)
  const [stats, setStats] = useState<MatchStats | null>(null)
  const [standings, setStandings] = useState<TeamStanding[] | null>(null)
  const [homeForm, setHomeForm] = useState<FormMatch[] | null>(null)
  const [awayForm, setAwayForm] = useState<FormMatch[] | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)

  const [loadingLineups, setLoadingLineups] = useState(false)
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingStandings, setLoadingStandings] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)
  const [loadingAI, setLoadingAI] = useState(false)
  const [loadingFixture, setLoadingFixture] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    loadAIAnalysis()
    if (match.external_id) {
      loadApiData()
    } else {
      setHasApiData(false)
    }
  }, [])

  async function loadAIAnalysis() {
    setLoadingAI(true)
    try {
      const { data } = await supabase.functions.invoke('match-analysis', {
        body: {
          teamHome: match.team_home,
          teamAway: match.team_away,
          phase: match.phase,
          kickoffAt: match.kickoff_at,
          isFinished: match.is_finished,
          scoreHome: match.score_home,
          scoreAway: match.score_away,
        },
      })
      setAiAnalysis(data?.analysis ?? null)
    } catch {
      setAiAnalysis(null)
    }
    setLoadingAI(false)
  }

  async function loadApiData() {
    setLoadingFixture(true)
    const ref = await findApiFootballFixture(match.kickoff_at, match.team_home, match.team_away)
    setLoadingFixture(false)

    if (!ref) { setHasApiData(false); return }
    setApiRef(ref)
    setHasApiData(true)

    // Fixture details
    fetchFixtureDetails(ref.fixtureId)
      .then(info => setFixtureInfo(info))
      .catch(() => {})

    // Lineups
    setLoadingLineups(true)
    fetchLineups(ref.fixtureId)
      .then(l => setLineups(l))
      .catch(() => setLineups([]))
      .finally(() => setLoadingLineups(false))

    // Stats (only if finished)
    if (match.is_finished) {
      setLoadingStats(true)
      fetchMatchStats(ref.fixtureId)
        .then(s => setStats(s))
        .catch(() => setStats(null))
        .finally(() => setLoadingStats(false))
    }

    // Group standings
    const groupLetter = extractGroupLetter(match.phase)
    if (groupLetter) {
      setLoadingStandings(true)
      fetchGroupStandings(groupLetter)
        .then(s => setStandings(s))
        .catch(() => setStandings([]))
        .finally(() => setLoadingStandings(false))
    }

    // Team form
    setLoadingForm(true)
    Promise.all([fetchTeamForm(ref.homeTeamId), fetchTeamForm(ref.awayTeamId)])
      .then(([hf, af]) => { setHomeForm(hf); setAwayForm(af) })
      .catch(() => { setHomeForm([]); setAwayForm([]) })
      .finally(() => setLoadingForm(false))
  }

  const groupLetter = extractGroupLetter(match.phase)
  const hasStandings = !!groupLetter

  const tabs: { id: Tab; label: string }[] = [
    { id: 'apercu', label: 'Aperçu' },
    { id: 'compositions', label: 'Compositions' },
    ...(hasStandings ? [{ id: 'classement' as Tab, label: 'Classement' }] : []),
    { id: 'forme', label: 'Forme' },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-br from-dark to-[#2A2F5C] text-white p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Teams */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-5xl">{match.flag_home}</span>
              <span className="font-bold text-sm text-center">{match.team_home}</span>
            </div>

            <div className="text-center shrink-0">
              {match.is_finished ? (
                <div className="text-3xl font-black tabular-nums">
                  {match.score_home} – {match.score_away}
                </div>
              ) : (
                <div className="text-white/50 font-bold text-xl">vs</div>
              )}
              <div className="text-xs text-white/40 mt-1">
                {format(new Date(match.kickoff_at), 'EEE d MMM · HH:mm', { locale: fr })}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center gap-1">
              <span className="text-5xl">{match.flag_away}</span>
              <span className="font-bold text-sm text-center">{match.team_away}</span>
            </div>
          </div>

          {/* Phase + venue */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50">
            <span className="font-medium text-white/70">{match.phase}</span>
            {fixtureInfo?.venue.name && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {fixtureInfo.venue.name}, {fixtureInfo.venue.city}
                {fixtureInfo.venue.capacity && ` · ${fixtureInfo.venue.capacity.toLocaleString()} places`}
              </span>
            )}
            {fixtureInfo?.referee && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {fixtureInfo.referee}
              </span>
            )}
            {loadingFixture && <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Chargement…</span>}
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-b border-gray-100 px-4 shrink-0 bg-white">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ── APERÇU ── */}
          {activeTab === 'apercu' && (
            <div className="space-y-4">
              {/* Stats */}
              {match.is_finished && (
                <div className="card rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-dark mb-3">Statistiques</h3>
                  {loadingStats ? (
                    <div className="py-4"><Spinner /></div>
                  ) : stats ? (
                    <div className="space-y-3">
                      {KEY_STATS.map(statName => {
                        const h = stats.home.find(s => s.type === statName)?.value ?? null
                        const a = stats.away.find(s => s.type === statName)?.value ?? null
                        if (h === null && a === null) return null
                        return <StatBar key={statName} label={statName} home={h} away={a} />
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-2">Statistiques non disponibles</p>
                  )}
                </div>
              )}

              {!match.is_finished && (
                <div className="card rounded-xl p-4 text-center text-sm text-gray-400">
                  Les statistiques seront disponibles après le match.
                </div>
              )}

              {/* AI Analysis */}
              <div className="card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🤖</span>
                  <h3 className="text-sm font-semibold text-dark">Analyse IA</h3>
                </div>
                {loadingAI ? (
                  <div className="py-4"><Spinner /></div>
                ) : aiAnalysis ? (
                  <p className="text-sm text-gray-600 leading-relaxed">{aiAnalysis}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Analyse non disponible.</p>
                )}
              </div>
            </div>
          )}

          {/* ── COMPOSITIONS ── */}
          {activeTab === 'compositions' && (
            <div>
              {!hasApiData && hasApiData !== null ? (
                <div className="text-center text-sm text-gray-400 py-10">
                  Compositions non disponibles pour ce match.
                </div>
              ) : loadingLineups ? (
                <div className="py-10"><Spinner /></div>
              ) : lineups && lineups.length >= 2 ? (
                <div className="grid grid-cols-2 gap-4">
                  {lineups.slice(0, 2).map((lineup, idx) => (
                    <div key={idx}>
                      <div className="text-center mb-3">
                        <div className="font-bold text-dark text-sm">{lineup.team.name}</div>
                        <div className="text-xs text-primary font-semibold">{lineup.formation}</div>
                        {lineup.coach && <div className="text-xs text-gray-400 mt-0.5">Coach : {lineup.coach}</div>}
                      </div>
                      <div className="space-y-1">
                        {lineup.startXI.map(p => (
                          <div key={p.id} className="flex items-center gap-2 text-xs">
                            <span className="w-5 text-right text-gray-400 font-mono shrink-0">{p.number}</span>
                            <span className="text-dark truncate">{p.name}</span>
                            <span className="text-gray-300 text-[10px] shrink-0">{p.pos}</span>
                          </div>
                        ))}
                      </div>
                      {lineup.substitutes.length > 0 && (
                        <>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider my-2 font-medium">Remplaçants</div>
                          <div className="space-y-1">
                            {lineup.substitutes.map(p => (
                              <div key={p.id} className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="w-5 text-right font-mono shrink-0">{p.number}</span>
                                <span className="truncate">{p.name}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : lineups && lineups.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-10">
                  {new Date(match.kickoff_at).getTime() - Date.now() > 60 * 60 * 1000
                    ? 'Compositions disponibles environ 1h avant le coup d\'envoi.'
                    : 'Compositions non encore disponibles.'}
                </div>
              ) : (
                <div className="py-10"><Spinner /></div>
              )}
            </div>
          )}

          {/* ── CLASSEMENT ── */}
          {activeTab === 'classement' && (
            <div>
              {loadingStandings ? (
                <div className="py-10"><Spinner /></div>
              ) : standings && standings.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-dark mb-3">
                    {standings[0]?.group ?? `Groupe ${groupLetter}`}
                  </h3>
                  <div className="card rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-left">
                          <th className="px-4 py-2.5 font-medium w-6">#</th>
                          <th className="px-2 py-2.5 font-medium">Équipe</th>
                          <th className="px-2 py-2.5 font-medium text-center">J</th>
                          <th className="px-2 py-2.5 font-medium text-center">G</th>
                          <th className="px-2 py-2.5 font-medium text-center">N</th>
                          <th className="px-2 py-2.5 font-medium text-center">P</th>
                          <th className="px-3 py-2.5 font-medium text-center font-semibold">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {standings.map((team) => {
                          const isMatchTeam =
                            team.team.name.toLowerCase().includes(match.team_home.toLowerCase()) ||
                            team.team.name.toLowerCase().includes(match.team_away.toLowerCase()) ||
                            match.team_home.toLowerCase().includes(team.team.name.toLowerCase()) ||
                            match.team_away.toLowerCase().includes(team.team.name.toLowerCase())
                          return (
                            <tr
                              key={team.team.id}
                              className={isMatchTeam ? 'bg-primary/5 font-semibold' : 'hover:bg-gray-50'}
                            >
                              <td className="px-4 py-2.5 text-gray-500">{team.rank}</td>
                              <td className="px-2 py-2.5 text-dark">{team.team.name}</td>
                              <td className="px-2 py-2.5 text-center text-gray-600">{team.all.played}</td>
                              <td className="px-2 py-2.5 text-center text-gray-600">{team.all.win}</td>
                              <td className="px-2 py-2.5 text-center text-gray-600">{team.all.draw}</td>
                              <td className="px-2 py-2.5 text-center text-gray-600">{team.all.lose}</td>
                              <td className="px-3 py-2.5 text-center text-primary font-bold">{team.points}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-400 py-10">
                  Classement non disponible.
                </div>
              )}
            </div>
          )}

          {/* ── FORME ── */}
          {activeTab === 'forme' && (
            <div className="space-y-5">
              {!hasApiData && hasApiData !== null ? (
                <div className="text-center text-sm text-gray-400 py-10">
                  Données de forme non disponibles pour ce match.
                </div>
              ) : loadingForm ? (
                <div className="py-10"><Spinner /></div>
              ) : (
                [
                  { label: match.team_home, flag: match.flag_home, form: homeForm },
                  { label: match.team_away, flag: match.flag_away, form: awayForm },
                ].map(({ label, flag, form }) => (
                  <div key={label}>
                    <h3 className="text-sm font-semibold text-dark mb-2 flex items-center gap-1.5">
                      <span>{flag}</span> Forme récente — {label}
                    </h3>
                    {form && form.length > 0 ? (
                      <div className="card rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 flex gap-1.5 border-b border-gray-50">
                          {[...form].reverse().map((m, i) => <ResultBadge key={i} result={m.result} />)}
                        </div>
                        <div className="divide-y divide-gray-50">
                          {form.map((m, i) => (
                            <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                              <span className="text-gray-400 w-20 shrink-0">{m.date}</span>
                              <span className="text-gray-500 shrink-0">{m.home ? 'D' : 'E'}</span>
                              <span className="flex-1 text-dark truncate">{m.opponent}</span>
                              <span className="font-mono text-gray-600 shrink-0">
                                {m.goalsFor}–{m.goalsAgainst}
                              </span>
                              <ResultBadge result={m.result} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : form !== null ? (
                      <div className="card rounded-xl p-4 text-center text-sm text-gray-400">
                        Aucune donnée de forme disponible.
                      </div>
                    ) : (
                      <div className="py-4"><Spinner /></div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
