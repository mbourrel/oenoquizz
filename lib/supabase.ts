import { createClient } from '@supabase/supabase-js'

// On met les valeurs directement pour contourner le problème de lecture du .env.local
const supabaseUrl = 'https://ptsbhlrxoopcmfyuazqz.supabase.co'
const supabaseAnonKey = 'sb_publishable_RQdVkrQs7Am-gimnA5o8oA_B1VLlT_k'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)