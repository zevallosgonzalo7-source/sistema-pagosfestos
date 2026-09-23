import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fhygacwwzhuxndownvve.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoeWdhY3d3emh1eG5kb3dudnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDg5MTEsImV4cCI6MjEwNDMyNDkxMX0.U_KZf33wN1_eaqRVpyW9psSbrOxigKeodra6To0PaHU'

// La anon key es pública por diseño. La protección real de V29 está en
// Supabase Auth + JWT + RLS. Nunca colocar service_role en el frontend.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
