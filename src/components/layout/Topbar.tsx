import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'
import { Shield, LogOut } from 'lucide-react'

interface TopbarProps {
  profile: Profile | null
  onAdminClick: () => void
  showingAdmin: boolean
}

export default function Topbar({ profile, onAdminClick, showingAdmin }: TopbarProps) {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <header className="bg-dark text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/40">
          <span className="text-white text-xs font-black">HS</span>
        </div>
        <div className="leading-tight">
          <span className="font-bold text-sm">HireSweet World Cup</span>
          <span className="text-gray-400 text-xs ml-1.5">2026 ⚽</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {profile?.is_admin && (
          <button
            onClick={onAdminClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              showingAdmin
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showingAdmin ? '← Retour' : 'Admin'}</span>
          </button>
        )}

        <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {profile?.avatar_initials || '?'}
          </div>
          <span className="hidden sm:inline text-sm font-medium text-gray-100">
            {profile?.full_name?.split(' ')[0] || 'Utilisateur'}
          </span>
        </div>

        <button
          onClick={handleSignOut}
          className="p-1.5 text-gray-400 hover:text-white transition rounded-lg hover:bg-white/10"
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
