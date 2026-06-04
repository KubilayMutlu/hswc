import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'
import LoginPage from '@/components/auth/LoginPage'
import Topbar from '@/components/layout/Topbar'
import Navigation from '@/components/layout/Navigation'
import ClassementPage from '@/components/classement/ClassementPage'
import PronosticsPage from '@/components/pronostics/PronosticsPage'
import MatchsPage from '@/components/matchs/MatchsPage'
import DefisPage from '@/components/defis/DefisPage'
import AdminPage from '@/components/admin/AdminPage'

export type Tab = 'classement' | 'pronostics' | 'matchs' | 'defis'

function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('classement')
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[fetchProfile] Supabase error:', error.message, error.code)
    }

    setProfile(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-lg">HS</span>
          </div>
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  if (showAdmin && profile?.is_admin) {
    return (
      <div className="min-h-screen bg-background">
        <Topbar profile={profile} onAdminClick={() => setShowAdmin(false)} showingAdmin />
        <main className="max-w-5xl mx-auto px-4 py-6">
          <AdminPage />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Topbar profile={profile} onAdminClick={() => setShowAdmin(true)} showingAdmin={false} />
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'classement' && <ClassementPage profile={profile} />}
        {activeTab === 'pronostics' && <PronosticsPage profile={profile} />}
        {activeTab === 'matchs' && <MatchsPage profile={profile} />}
        {activeTab === 'defis' && <DefisPage />}
      </main>
    </div>
  )
}

export default App
