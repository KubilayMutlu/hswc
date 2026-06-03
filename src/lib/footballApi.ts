const BASE_URL = 'https://api.football-data.org/v4'

function getHeaders() {
  return { 'X-Auth-Token': import.meta.env.VITE_FOOTBALL_API_KEY }
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const countryFlags: Record<string, string> = {
  // CONCACAF
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Mexico': '🇲🇽', 'Canada': '🇨🇦',
  'Honduras': '🇭🇳', 'Jamaica': '🇯🇲', 'Costa Rica': '🇨🇷', 'Panama': '🇵🇦',
  'El Salvador': '🇸🇻', 'Guatemala': '🇬🇹', 'Cuba': '🇨🇺', 'Trinidad and Tobago': '🇹🇹',
  'Curaçao': '🇨🇼', 'Haiti': '🇭🇹', 'Suriname': '🇸🇷',
  // South America
  'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'Colombia': '🇨🇴', 'Uruguay': '🇺🇾',
  'Ecuador': '🇪🇨', 'Paraguay': '🇵🇾', 'Chile': '🇨🇱', 'Peru': '🇵🇪',
  'Bolivia': '🇧🇴', 'Venezuela': '🇻🇪',
  // Europe
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Italy': '🇮🇹',
  'Croatia': '🇭🇷', 'Switzerland': '🇨🇭', 'Denmark': '🇩🇰', 'Austria': '🇦🇹',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Turkey': '🇹🇷', 'Serbia': '🇷🇸', 'Poland': '🇵🇱',
  'Ukraine': '🇺🇦', 'Romania': '🇷🇴', 'Hungary': '🇭🇺', 'Slovakia': '🇸🇰',
  'Czech Republic': '🇨🇿', 'Czechia': '🇨🇿', 'Greece': '🇬🇷', 'Norway': '🇳🇴',
  'Sweden': '🇸🇪', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Ireland': '🇮🇪', 'Finland': '🇫🇮',
  'Albania': '🇦🇱', 'Slovenia': '🇸🇮', 'Georgia': '🇬🇪', 'Iceland': '🇮🇸',
  'Bosnia and Herzegovina': '🇧🇦', 'North Macedonia': '🇲🇰', 'Montenegro': '🇲🇪',
  'Kosovo': '🇽🇰', 'Bulgaria': '🇧🇬', 'Luxembourg': '🇱🇺', 'Belarus': '🇧🇾',
  // Africa
  'Morocco': '🇲🇦', 'Nigeria': '🇳🇬', 'Senegal': '🇸🇳', 'Egypt': '🇪🇬',
  'Cameroon': '🇨🇲', 'Ghana': '🇬🇭', "Côte d'Ivoire": '🇨🇮', 'Ivory Coast': '🇨🇮',
  'Algeria': '🇩🇿', 'Tunisia': '🇹🇳', 'South Africa': '🇿🇦', 'Mali': '🇲🇱',
  'DR Congo': '🇨🇩', 'Zambia': '🇿🇲', 'Tanzania': '🇹🇿', 'Burkina Faso': '🇧🇫',
  'Guinea': '🇬🇳', 'Gabon': '🇬🇦', 'Angola': '🇦🇴', 'Uganda': '🇺🇬',
  'Kenya': '🇰🇪', 'Cape Verde': '🇨🇻', 'Mozambique': '🇲🇿', 'Rwanda': '🇷🇼',
  'Comoros': '🇰🇲', 'Equatorial Guinea': '🇬🇶', 'Liberia': '🇱🇷', 'Namibia': '🇳🇦',
  // Asia
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Korea Republic': '🇰🇷', 'Australia': '🇦🇺',
  'Saudi Arabia': '🇸🇦', 'Iran': '🇮🇷', 'Qatar': '🇶🇦', 'China': '🇨🇳',
  'China PR': '🇨🇳', 'Indonesia': '🇮🇩', 'Uzbekistan': '🇺🇿', 'Jordan': '🇯🇴',
  'Iraq': '🇮🇶', 'United Arab Emirates': '🇦🇪', 'UAE': '🇦🇪', 'Oman': '🇴🇲',
  'Bahrain': '🇧🇭', 'Kuwait': '🇰🇼', 'Philippines': '🇵🇭', 'India': '🇮🇳',
  'Thailand': '🇹🇭', 'Vietnam': '🇻🇳', 'Tajikistan': '🇹🇯', 'Kyrgyzstan': '🇰🇬',
  // Oceania
  'New Zealand': '🇳🇿', 'Papua New Guinea': '🇵🇬', 'Fiji': '🇫🇯',
  'Solomon Islands': '🇸🇧', 'Vanuatu': '🇻🇺', 'New Caledonia': '🇳🇨',
}

export function getCountryFlag(countryName: string): string {
  return countryFlags[countryName] ?? '🏳️'
}

function mapStageToPhase(stage: string, group?: string | null): string {
  if (stage === 'GROUP_STAGE' && group) {
    return `Groupe ${group.replace('GROUP_', '')}`
  }
  const stageMap: Record<string, string> = {
    'GROUP_STAGE': 'Phase de groupes',
    'ROUND_OF_32': '32e de finale',
    'ROUND_OF_16': '8e de finale',
    'QUARTER_FINALS': 'Quart de finale',
    'SEMI_FINALS': 'Demi-finale',
    'THIRD_PLACE': '3e place',
    'FINAL': 'Finale',
  }
  return stageMap[stage] ?? stage
}

export function mapApiMatchToSupabase(apiMatch: any) {
  return {
    external_id: apiMatch.id,
    kickoff_at: apiMatch.utcDate,
    status: apiMatch.status,
    phase: mapStageToPhase(apiMatch.stage, apiMatch.group),
    team_home: apiMatch.homeTeam.name ?? 'TBD',
    team_away: apiMatch.awayTeam.name ?? 'TBD',
    flag_home: getCountryFlag(apiMatch.homeTeam.name ?? ''),
    flag_away: getCountryFlag(apiMatch.awayTeam.name ?? ''),
    score_home: apiMatch.score?.fullTime?.home ?? null,
    score_away: apiMatch.score?.fullTime?.away ?? null,
    is_finished: apiMatch.status === 'FINISHED',
  }
}

export async function fetchWorldCupMatches(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/competitions/WC/matches`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`API football-data: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return data.matches ?? []
}

export async function fetchMatchScore(externalId: number): Promise<{ home: number | null; away: number | null; status: string }> {
  const res = await fetch(`${BASE_URL}/matches/${externalId}`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`API football-data: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return {
    home: data.score?.fullTime?.home ?? null,
    away: data.score?.fullTime?.away ?? null,
    status: data.status,
  }
}
