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
    <div className="min-h-screen bg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/30">
            <span className="text-white text-2xl font-black">HS</span>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">HireSweet World Cup</h1>
          <p className="text-gray-400 mt-1 text-sm">Édition 2026 ⚽</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          {signupConfirm ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">📧</div>
              <h2 className="text-dark text-lg font-semibold mb-2">Vérifie ton email</h2>
              <p className="text-gray-500 text-sm">Un lien de confirmation t'a été envoyé à <strong>{email}</strong>.</p>
              <button
                onClick={() => { setSignupConfirm(false); setMode('login') }}
                className="mt-4 text-sm text-primary underline"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-dark text-lg font-semibold mb-1">
                {isLogin ? 'Connexion' : 'Créer un compte'}
              </h2>
              <p className="text-gray-400 text-sm mb-5">
                {isLogin
                  ? 'Entre tes identifiants pour accéder aux pronostics.'
                  : 'Rejoins HireSweet World Cup 2026.'}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom et nom</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                      placeholder="Prénom Nom"
                      required
                      autoComplete="name"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    placeholder="prenom@hiresweet.com"
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-primary text-white rounded-xl py-3 font-semibold text-sm hover:bg-primary/90 transition shadow-md shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="text-sm text-gray-500 hover:text-dark"
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
