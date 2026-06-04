import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { League } from '@/types'

interface LeagueContextValue {
  userLeagues: League[]
  activeLeague: League | null
  activeMemberIds: string[] | null
  setActiveLeague: (league: League | null) => void
  refreshLeagues: () => void
}

const LeagueContext = createContext<LeagueContextValue>({
  userLeagues: [],
  activeLeague: null,
  activeMemberIds: null,
  setActiveLeague: () => {},
  refreshLeagues: () => {},
})

export function useLeague() {
  return useContext(LeagueContext)
}

export function LeagueProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [userLeagues, setUserLeagues] = useState<League[]>([])
  const [activeLeague, setActiveLeagueState] = useState<League | null>(null)
  const [memberIdsByLeague, setMemberIdsByLeague] = useState<Record<string, string[]>>({})

  const loadMembersForLeague = useCallback(async (leagueId: string) => {
    const { data } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', leagueId)
    if (data) {
      setMemberIdsByLeague(prev => ({ ...prev, [leagueId]: data.map((m: any) => m.user_id) }))
    }
  }, [])

  const loadLeagues = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('league_members')
      .select('leagues(*)')
      .eq('user_id', uid)

    if (!data) return
    const leagues = data.map((d: any) => d.leagues as League).filter(Boolean)
    setUserLeagues(leagues)
    setActiveLeagueState(prev => prev ?? (leagues[0] ?? null))
    await Promise.all(leagues.map((l: League) => loadMembersForLeague(l.id)))
  }, [loadMembersForLeague])

  useEffect(() => {
    if (userId) {
      loadLeagues(userId)
    } else {
      setUserLeagues([])
      setActiveLeagueState(null)
      setMemberIdsByLeague({})
    }
  }, [userId, loadLeagues])

  const setActiveLeague = useCallback((league: League | null) => {
    setActiveLeagueState(league)
    if (league && !memberIdsByLeague[league.id]) {
      loadMembersForLeague(league.id)
    }
  }, [memberIdsByLeague, loadMembersForLeague])

  const refreshLeagues = useCallback(() => {
    if (userId) loadLeagues(userId)
  }, [userId, loadLeagues])

  const activeMemberIds = activeLeague ? (memberIdsByLeague[activeLeague.id] ?? null) : null

  return (
    <LeagueContext.Provider value={{ userLeagues, activeLeague, activeMemberIds, setActiveLeague, refreshLeagues }}>
      {children}
    </LeagueContext.Provider>
  )
}
