import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jncxkiuabozqfehxfhxa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuY3hraXVhYm96cWZlaHhmaHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTE2OTYsImV4cCI6MjA5NzQyNzY5Nn0.SvTHZ6irp6Q6tmJ4cg2LU5y9bfnzRyK_LDQeh0SmY6c';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL or Anon Key is missing!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
