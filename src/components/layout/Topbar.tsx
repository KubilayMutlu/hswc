import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'
import { useLeague } from '@/context/LeagueContext'
import { Shield, LogOut, Users } from 'lucide-react'

interface TopbarProps {
  profile: Profile | null
  onAdminClick: () => void
  showingAdmin: boolean
  onLiguesClick: () => void
}

export default function Topbar({ profile, onAdminClick, showingAdmin, onLiguesClick }: TopbarProps) {
  const { userLeagues, activeLeague, setActiveLeague } = useLeague()

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <header className="bg-[#080B16]/95 backdrop-blur-xl text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-white/8 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
          <span className="text-white text-xs font-black">HS</span>
        </div>
        <div className="leading-tight">
          <span className="font-bold text-sm text-white">HireSweet World Cup</span>
          <span className="text-white/40 text-xs ml-1.5">2026 ⚽</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {userLeagues.length > 0 && !showingAdmin && (
          <select
            value={activeLeague?.id ?? ''}
            onChange={e => {
              const id = e.target.value
              setActiveLeague(id ? (userLeagues.find(l => l.id === id) ?? null) : null)
            }}
            className="bg-white/8 text-white text-xs rounded-lg px-2 py-1.5 border border-white/15 focus:outline-none focus:border-primary cursor-pointer max-w-36 truncate"
          >
            <option value="" className="bg-[#0D1020] text-white">Vue globale</option>
            {userLeagues.map(l => (
              <option key={l.id} value={l.id} className="bg-[#0D1020] text-white">{l.name}</option>
            ))}
          </select>
        )}

        {profile?.is_admin && (
          <button
            onClick={onAdminClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              showingAdmin
                ? 'bg-primary text-white shadow-sm shadow-primary/30'
                : 'text-white/50 hover:text-white hover:bg-white/8'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showingAdmin ? '← Retour' : 'Admin'}</span>
          </button>
        )}

        <button
          onClick={onLiguesClick}
          className="p-1.5 text-white/50 hover:text-white transition rounded-lg hover:bg-white/8"
          title="Mes ligues"
        >
          <Users className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm shadow-primary/40">
            {profile?.avatar_initials || '?'}
          </div>
          <span className="hidden sm:inline text-sm font-medium text-white/90">
            {profile?.full_name?.split(' ')[0] || 'Utilisateur'}
          </span>
        </div>

        <button
          onClick={handleSignOut}
          className="p-1.5 text-white/50 hover:text-white transition rounded-lg hover:bg-white/8"
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
