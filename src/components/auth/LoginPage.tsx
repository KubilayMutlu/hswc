import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface LoginPageProps {
  onSignupSuccess?: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function LoginPage({ onSignupSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signupConfirm, setSignupConfirm] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou mot de passe incorrect.')
    setLoading(false)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const initials = getInitials(fullName)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, avatar_initials: initials },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      onSignupSuccess?.()
    } else {
      setSignupConfirm(true)
    }
    setLoading(false)
  }

  const isLogin = mode === 'login'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1040] via-[#0B0E1A] to-[#0D1829] flex items-center justify-center p-4">
      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#F5B942]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/40">
            <span className="text-white text-2xl font-black">HS</span>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">HireSweet World Cup</h1>
          <p className="text-white/40 mt-1 text-sm">Édition 2026 ⚽</p>
        </div>

        <div className="glass-card rounded-2xl p-6 shadow-2xl shadow-black/40">
          {signupConfirm ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">📧</div>
              <h2 className="text-white text-lg font-semibold mb-2">Vérifie ton email</h2>
              <p className="text-white/50 text-sm">Un lien de confirmation t'a été envoyé à <strong className="text-white/80">{email}</strong>.</p>
              <button
                onClick={() => { setSignupConfirm(false); setMode('login') }}
                className="mt-4 text-sm text-primary hover:underline"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-white text-lg font-semibold mb-1">
                {isLogin ? 'Connexion' : 'Créer un compte'}
              </h2>
              <p className="text-white/40 text-sm mb-5">
                {isLogin
                  ? 'Entre tes identifiants pour accéder aux pronostics.'
                  : 'Rejoins HireSweet World Cup 2026.'}
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-1.5">Prénom et nom</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="input-dark"
                      placeholder="Prénom Nom"
                      required
                      autoComplete="name"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-dark"
                    placeholder="prenom@hiresweet.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1.5">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-dark"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary mt-2"
                >
                  {loading
                    ? isLogin ? 'Connexion…' : 'Création…'
                    : isLogin ? 'Se connecter' : "S'inscrire"}
                </button>
              </form>

              <div className="mt-4 text-center">
                {isLogin ? (
                  <button
                    onClick={() => { setMode('signup'); setError(null) }}
                    className="text-sm text-primary hover:underline"
                  >
                    Créer un compte
                  </button>
                ) : (
                  <button
                    onClick={() => { setMode('login'); setError(null) }}
                    className="text-sm text-white/40 hover:text-white/70 transition"
                  >
                    ← Retour à la connexion
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
