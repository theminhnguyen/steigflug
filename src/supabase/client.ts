import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

/**
 * Ein einziger Client für die ganze App. Die Sitzung wird im Browser abgelegt
 * und automatisch erneuert, damit eine Anmeldung monatelang hält.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Nach der Rückkehr von Google steht der Code in der Adresszeile und wird
    // hier automatisch gegen eine Sitzung eingetauscht.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
