import type { SupabaseClient, User } from '@supabase/supabase-js'

export type AtlasProfile = {
  id: string
  nickname: string
  avatar_seed: string
  country_code: string | null
  preferred_language: string
  timezone: string
  native_language: string
  learning_language: string
  korean_level: string
  daily_learning_goal: number
  show_romanization: boolean
  show_english_translation: boolean
  games_played: number
  wins: number
  total_score: number
}

const PROFILE_COLUMNS = 'id,nickname,avatar_seed,country_code,preferred_language,timezone,native_language,learning_language,korean_level,daily_learning_goal,show_romanization,show_english_translation,games_played,wins,total_score'

export async function getSharedAtlasProfile(client: SupabaseClient, user: User) {
  return client
    .from('sketchfy_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle<AtlasProfile>()
}
