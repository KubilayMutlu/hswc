import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getCountryFlag } from '@/lib/footballApi'

interface TeamStats {
  played: number
  win: number
  draw: number
  lose: number
  goals: { for: number; against: number }
}

interface TeamStanding {
  rank: number
  team: { id: number; name: string }
  points: number
  goalsDiff: number
  group: string
  description: string | null
  all: TeamStats
}

export default function StandingsPage() {
  const [groups, setGroups] = useState<TeamStanding[][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => { fetchStandings() }, [])

  async function fetchStandings() {
    setLoading(true)
    setError(false)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('apifootball-proxy', {
        body: { path: '/standings', params: { league: 1, season: 2026 } },
      })
      if (fnError) throw fnError
      const standings: TeamStanding[][] = data?.response?.[0]?.league?.standings
      if (!Array.isArray(standings) || standings.length === 0) throw new Error('empty')
      setGroups(standings)
    } catch (err) {
      console.error('[Standings] fetch error:', err)
      setError(true)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-gray-400 text-sm">Chargement des classements…</p>
      </div>
    )
  }

  if (error || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="text-4xl">📡</div>
        <p className="font-semibold text-dark">Données non disponibles</p>
        <p className="text-sm text-gray-400 max-w-xs">
          Les classements de groupe seront disponibles dès le début de la Coupe du Monde le 11 juin 2026.
        </p>
        <button
          onClick={fetchStandings}
          className="mt-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition"
        >
          Réessayer
        </button>
      </div>
    )
  }

  // Separate group-stage standings from any knockout data
  const groupStandings = groups.filter(g => g[0]?.group?.startsWith('Group'))
  const knockoutStandings = groups.filter(g => !g[0]?.group?.startsWith('Group'))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-dark mb-1">Classements</h2>
        <p className="text-sm text-gray-500">Coupe du Monde 2026 — Phase de groupes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {groupStandings.map((group) => {
          const groupName = group[0]?.group ?? '—'
          const letter = groupName.replace('Group ', '')

          return (
            <div key={groupName} className="card rounded-2xl overflow-hidden">
              {/* Group header */}
              <div className="bg-dark px-4 py-2.5 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{letter}</span>
                </div>
                <h3 className="text-white font-semibold text-sm">Groupe {letter}</h3>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left pl-3 pr-1 py-2 text-[11px] font-semibold text-gray-400 w-5">#</th>
                      <th className="text-left px-2 py-2 text-[11px] font-semibold text-gray-400">Équipe</th>
                      <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">J</th>
                      <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">G</th>
                      <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">N</th>
                      <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">P</th>
                      <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">BP</th>
                      <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">BC</th>
                      <th className="text-center px-2 py-2 text-[11px] font-bold text-gray-600 w-9">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.map((entry, idx) => {
                      const qualified = idx < 2
                      return (
                        <tr
                          key={entry.team.id}
                          className={qualified ? 'bg-primary/[0.03]' : ''}
                        >
                          <td className="pl-3 pr-1 py-2.5">
                            <span className={`text-[11px] font-bold ${
                              idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-gray-300'
                            }`}>
                              {entry.rank}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm leading-none shrink-0">
                                {getCountryFlag(entry.team.name)}
                              </span>
                              <span className="text-xs font-medium text-dark truncate">
                                {entry.team.name}
                              </span>
                            </div>
                          </td>
                          <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.played}</td>
                          <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.win}</td>
                          <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.draw}</td>
                          <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.lose}</td>
                          <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.goals.for}</td>
                          <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.goals.against}</td>
                          <td className="text-center px-2 py-2.5">
                            <span className={`text-xs font-bold ${qualified ? 'text-primary' : 'text-dark'}`}>
                              {entry.points}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Qualification legend */}
              <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                <span className="text-[10px] text-gray-400">2 premiers qualifiés pour le 32e de finale</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Knockout phase (shown if API returns bracket data) */}
      {knockoutStandings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Phases finales</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {knockoutStandings.map((bracket, i) => {
              const stageName = bracket[0]?.group ?? `Phase ${i + 1}`
              return (
                <div key={stageName} className="card rounded-2xl overflow-hidden">
                  <div className="bg-dark px-4 py-2.5">
                    <h3 className="text-white font-semibold text-sm">{stageName}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left pl-3 pr-1 py-2 text-[11px] font-semibold text-gray-400 w-5">#</th>
                          <th className="text-left px-2 py-2 text-[11px] font-semibold text-gray-400">Équipe</th>
                          <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">J</th>
                          <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">G</th>
                          <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">N</th>
                          <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">P</th>
                          <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">BP</th>
                          <th className="text-center px-1 py-2 text-[11px] font-semibold text-gray-400 w-7">BC</th>
                          <th className="text-center px-2 py-2 text-[11px] font-bold text-gray-600 w-9">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {bracket.map((entry) => (
                          <tr key={entry.team.id}>
                            <td className="pl-3 pr-1 py-2.5 text-[11px] font-bold text-gray-400">{entry.rank}</td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm leading-none shrink-0">{getCountryFlag(entry.team.name)}</span>
                                <span className="text-xs font-medium text-dark truncate">{entry.team.name}</span>
                              </div>
                            </td>
                            <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.played}</td>
                            <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.win}</td>
                            <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.draw}</td>
                            <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.lose}</td>
                            <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.goals.for}</td>
                            <td className="text-center px-1 py-2.5 text-xs text-gray-600">{entry.all.goals.against}</td>
                            <td className="text-center px-2 py-2.5 text-xs font-bold text-dark">{entry.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
