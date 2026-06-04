import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile, League } from '@/types'
import { useLeague } from '@/context/LeagueContext'
import { Plus, UserPlus, LogOut, Copy, Check } from 'lucide-react'

function generateCode(): string {
  return Array.from({ length: 6 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  ).join('')
}

interface LeaguesPageProps {
  profile: Profile | null
}

export default function LeaguesPage({ profile }: LeaguesPageProps) {
  const { userLeagues, activeLeague, setActiveLeague, refreshLeagues } = useLeague()

  const [createName, setCreateName] = useState('')
  const [createCode, setCreateCode] = useState(generateCode())
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  const [joinCode, setJoinCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null)

  const [leagueMeta, setLeagueMeta] = useState<Record<string, { memberCount: number; creatorName: string }>>({})
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    if (userLeagues.length > 0) loadLeagueMeta()
  }, [userLeagues])

  async function loadLeagueMeta() {
    const leagueIds = userLeagues.map(l => l.id)
    const creatorIds = [...new Set(userLeagues.map(l => l.created_by))]

    const [membersRes, creatorsRes] = await Promise.all([
      supabase.from('league_members').select('league_id').in('league_id', leagueIds),
      supabase.from('profiles').select('id, full_name').in('id', creatorIds),
    ])

    const members = (membersRes.data ?? []) as { league_id: string }[]
    const creators = (creatorsRes.data ?? []) as { id: string; full_name: string }[]

    const meta: Record<string, { memberCount: number; creatorName: string }> = {}
    for (const l of userLeagues) {
      meta[l.id] = {
        memberCount: members.filter(m => m.league_id === l.id).length,
        creatorName: creators.find(c => c.id === l.created_by)?.full_name ?? 'Inconnu',
      }
    }
    setLeagueMeta(meta)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setCreateLoading(true)
    setCreateError(null)
    setCreateSuccess(null)

    const code = createCode.toUpperCase()

    const { data: existing } = await supabase
      .from('leagues')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (existing) {
      setCreateError('Ce code existe déjà. Génère-en un autre.')
      setCreateLoading(false)
      return
    }

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({ name: createName, code, created_by: profile.id })
      .select()
      .single()

    if (leagueError || !league) {
      setCreateError('Erreur lors de la création de la ligue.')
      setCreateLoading(false)
      return
    }

    const { error: joinErr } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: profile.id })

    if (joinErr) {
      setCreateError("Ligue créée mais erreur lors de l'inscription.")
    } else {
      setCreateSuccess(`Ligue "${createName}" créée !`)
      setCreateName('')
      setCreateCode(generateCode())
      refreshLeagues()
    }
    setCreateLoading(false)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setJoinLoading(true)
    setJoinError(null)
    setJoinSuccess(null)

    const code = joinCode.toUpperCase().trim()
    const { data: league } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('code', code)
      .maybeSingle() as { data: { id: string; name: string } | null }

    if (!league) {
      setJoinError('Code invalide. Vérifie et réessaie.')
      setJoinLoading(false)
      return
    }

    if (userLeagues.some(l => l.id === league.id)) {
      setJoinError('Tu es déjà membre de cette ligue.')
      setJoinLoading(false)
      return
    }

    const { error } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: profile.id })

    if (error) {
      setJoinError('Impossible de rejoindre cette ligue.')
    } else {
      setJoinSuccess(`Tu as rejoint "${league.name}" !`)
      setJoinCode('')
      refreshLeagues()
    }
    setJoinLoading(false)
  }

  async function handleLeave(league: League) {
    if (!profile) return
    if (!confirm(`Quitter la ligue "${league.name}" ?`)) return

    const { error } = await supabase
      .from('league_members')
      .delete()
      .eq('league_id', league.id)
      .eq('user_id', profile.id)

    if (!error) {
      if (activeLeague?.id === league.id) {
        const remaining = userLeagues.filter(l => l.id !== league.id)
        setActiveLeague(remaining[0] ?? null)
      }
      refreshLeagues()
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-dark mb-1">Mes Ligues</h2>
        <p className="text-sm text-gray-500">Crée ou rejoins des groupes privés pour comparer tes pronostics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create */}
        <div className="card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-dark">Créer une ligue</h3>
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la ligue</label>
              <input
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                className="input-field"
                placeholder="HireSweet 2026"
                required
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code d'invitation</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createCode}
                  onChange={e => setCreateCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10))}
                  className="input-field font-mono tracking-wider"
                  style={{ flex: 1, width: 'auto' }}
                  required
                  minLength={4}
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={() => setCreateCode(generateCode())}
                  className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
                >
                  Regénérer
                </button>
              </div>
            </div>

            {createError && <p className="text-xs text-red-600">{createError}</p>}
            {createSuccess && <p className="text-xs text-green-600">{createSuccess}</p>}

            <button
              type="submit"
              disabled={createLoading}
              className="btn-primary"
            >
              {createLoading ? 'Création…' : 'Créer la ligue'}
            </button>
          </form>
        </div>

        {/* Join */}
        <div className="card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="font-semibold text-dark">Rejoindre une ligue</h3>
          </div>

          <form onSubmit={handleJoin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code d'invitation</label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                className="input-field font-mono tracking-wider"
                placeholder="ABCDEF"
                required
              />
            </div>

            {joinError && <p className="text-xs text-red-600">{joinError}</p>}
            {joinSuccess && <p className="text-xs text-green-600">{joinSuccess}</p>}

            <button
              type="submit"
              disabled={joinLoading}
              className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50 shadow-sm shadow-green-600/20"
            >
              {joinLoading ? 'Recherche…' : 'Rejoindre'}
            </button>
          </form>
        </div>
      </div>

      {/* My leagues list */}
      <div className="card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-dark">Mes ligues actuelles</h3>
        </div>

        {userLeagues.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            Tu n'es membre d'aucune ligue pour l'instant.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {userLeagues.map(league => {
              const meta = leagueMeta[league.id]
              const isCreator = league.created_by === profile?.id
              return (
                <div key={league.id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg shrink-0">
                    🌐
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-dark text-sm">{league.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {meta
                        ? `${meta.memberCount} membre${meta.memberCount > 1 ? 's' : ''} · créée par ${meta.creatorName}`
                        : '…'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1.5">
                      <span className="text-xs font-mono text-gray-600 tracking-wider">{league.code}</span>
                      <button
                        onClick={() => copyCode(league.code)}
                        className="text-gray-400 hover:text-primary transition ml-1"
                        title="Copier le code"
                      >
                        {copiedCode === league.code ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    {isCreator ? (
                      <span className="text-xs text-gray-400 px-2 hidden sm:inline">Créateur</span>
                    ) : (
                      <button
                        onClick={() => handleLeave(league)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <LogOut className="w-3 h-3" />
                        <span className="hidden sm:inline">Quitter</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
