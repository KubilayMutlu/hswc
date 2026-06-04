import { supabase } from '@/lib/supabase'

async function apiFetch(path: string, params?: Record<string, string | number>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('apifootball-proxy', {
    body: { path, params },
  })
  if (error) throw new Error(`apifootball-proxy: ${error.message}`)
  return data
}

export interface Player {
  id: number
  name: string
  number: number
  pos: string
}

export interface Lineup {
  team: { id: number; name: string }
  formation: string
  startXI: Player[]
  substitutes: Player[]
  coach: string
}

export interface FixtureInfo {
  venue: { name: string; city: string; capacity: number | null }
  referee: string | null
}

export interface StatValue {
  type: string
  value: string | number | null
}

export interface MatchStats {
  home: StatValue[]
  away: StatValue[]
}

export interface TeamStanding {
  rank: number
  team: { id: number; name: string }
  points: number
  goalsDiff: number
  group: string
  all: { played: number; win: number; draw: number; lose: number }
}

export interface FormMatch {
  date: string
  opponent: string
  goalsFor: number
  goalsAgainst: number
  result: 'W' | 'D' | 'L'
  home: boolean
}

export interface ApiFixtureRef {
  fixtureId: number
  homeTeamId: number
  awayTeamId: number
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

export async function findApiFootballFixture(
  kickoffAt: string,
  teamHome: string,
  teamAway: string,
): Promise<ApiFixtureRef | null> {
  try {
    const date = kickoffAt.split('T')[0]
    const data = await apiFetch('/fixtures', { league: 1, season: 2026, date })
    const fixtures: any[] = data?.response ?? []

    const hn = normalize(teamHome)
    const an = normalize(teamAway)

    const found = fixtures.find((f: any) => {
      const fhn = normalize(f.teams?.home?.name ?? '')
      const fan = normalize(f.teams?.away?.name ?? '')
      return (fhn.includes(hn) || hn.includes(fhn)) && (fan.includes(an) || an.includes(fan))
    })

    if (!found) return null
    return {
      fixtureId: found.fixture?.id,
      homeTeamId: found.teams?.home?.id,
      awayTeamId: found.teams?.away?.id,
    }
  } catch {
    return null
  }
}

export async function fetchFixtureDetails(fixtureId: number): Promise<FixtureInfo> {
  const data = await apiFetch('/fixtures', { id: fixtureId })
  const item = data?.response?.[0]
  if (!item) throw new Error('No fixture data')
  return {
    venue: {
      name: item.fixture?.venue?.name ?? '',
      city: item.fixture?.venue?.city ?? '',
      capacity: item.fixture?.venue?.capacity ?? null,
    },
    referee: item.fixture?.referee ?? null,
  }
}

export async function fetchLineups(fixtureId: number): Promise<Lineup[]> {
  const data = await apiFetch('/fixtures/lineups', { fixture: fixtureId })
  const response: any[] = data?.response ?? []
  return response.map((item: any) => ({
    team: { id: item.team?.id, name: item.team?.name },
    formation: item.formation ?? '',
    coach: item.coach?.name ?? '',
    startXI: (item.startXI ?? []).map((p: any) => ({
      id: p.player?.id,
      name: p.player?.name,
      number: p.player?.number,
      pos: p.player?.pos ?? '',
    })),
    substitutes: (item.substitutes ?? []).map((p: any) => ({
      id: p.player?.id,
      name: p.player?.name,
      number: p.player?.number,
      pos: p.player?.pos ?? '',
    })),
  }))
}

export async function fetchMatchStats(fixtureId: number): Promise<MatchStats | null> {
  const data = await apiFetch('/fixtures/statistics', { fixture: fixtureId })
  const response: any[] = data?.response ?? []
  if (response.length < 2) return null
  return {
    home: response[0]?.statistics ?? [],
    away: response[1]?.statistics ?? [],
  }
}

export async function fetchGroupStandings(groupLetter: string): Promise<TeamStanding[]> {
  const data = await apiFetch('/standings', { league: 1, season: 2026 })
  const leagues: any[] = data?.response ?? []
  for (const l of leagues) {
    const allGroups: any[][] = l.league?.standings ?? []
    for (const group of allGroups) {
      if (group?.[0]?.group?.endsWith(groupLetter)) {
        return group.map((t: any) => ({
          rank: t.rank,
          team: { id: t.team?.id, name: t.team?.name },
          points: t.points,
          goalsDiff: t.goalsDiff,
          group: t.group,
          all: {
            played: t.all?.played,
            win: t.all?.win,
            draw: t.all?.draw,
            lose: t.all?.lose,
          },
        }))
      }
    }
  }
  return []
}

export async function fetchTeamForm(teamId: number): Promise<FormMatch[]> {
  const data = await apiFetch('/fixtures', { league: 1, season: 2026, team: teamId, last: 5 })
  const fixtures: any[] = data?.response ?? []
  return fixtures
    .map((f: any) => {
      const isHome = f.teams?.home?.id === teamId
      const goalsFor = isHome ? (f.goals?.home ?? 0) : (f.goals?.away ?? 0)
      const goalsAgainst = isHome ? (f.goals?.away ?? 0) : (f.goals?.home ?? 0)
      const homeWon = f.teams?.home?.winner
      const awayWon = f.teams?.away?.winner
      let result: 'W' | 'D' | 'L' = 'D'
      if (isHome && homeWon) result = 'W'
      else if (!isHome && awayWon) result = 'W'
      else if ((isHome && awayWon) || (!isHome && homeWon)) result = 'L'
      return {
        date: (f.fixture?.date ?? '').split('T')[0],
        opponent: isHome ? (f.teams?.away?.name ?? '') : (f.teams?.home?.name ?? ''),
        goalsFor,
        goalsAgainst,
        result,
        home: isHome,
      }
    })
    .reverse()
}
