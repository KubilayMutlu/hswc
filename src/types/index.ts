export interface Profile {
  id: string
  full_name: string
  avatar_initials: string
  is_admin: boolean
  bonus_points?: number
}

export interface TournamentPrediction {
  id: string
  user_id: string
  type: 'top_scorer' | 'top_assist'
  prediction: string
  is_correct: boolean
  created_at: string
}

export interface Match {
  id: string
  phase: string
  team_home: string
  team_away: string
  flag_home: string
  flag_away: string
  kickoff_at: string
  score_home: number | null
  score_away: number | null
  is_finished: boolean
  external_id?: number | null
  status?: string | null
}

export interface Prediction {
  id: string
  user_id: string
  match_id: string
  predicted_home: number
  predicted_away: number
  predicted_winner: 'home' | 'away' | 'draw'
  points_earned: number
  created_at: string
}

export interface LeaderboardEntry {
  profile: Profile
  total_points: number
  exact_scores: number
  correct_winners: number
  rank: number
}

export interface League {
  id: string
  name: string
  code: string
  created_by: string
  created_at: string
}

export interface PowerUp {
  id: string
  user_id: string
  type: 'spy' | 'double'
  uses_remaining: number
}

export interface PowerUpUse {
  id: string
  user_id: string
  match_id: string
  type: 'spy' | 'double'
  target_user_id?: string
  created_at: string
}
