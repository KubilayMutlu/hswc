export interface Profile {
  id: string
  full_name: string
  avatar_initials: string
  is_admin: boolean
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
