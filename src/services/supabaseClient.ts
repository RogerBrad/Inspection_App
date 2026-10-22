import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// Same Supabase project as the SRAM web app. The publishable (anon) key is safe to ship
// in the app — access control is enforced by Row Level Security on the database.
const SUPABASE_URL = 'https://jncxkiuabozqfehxfhxa.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g_IceaDAojDGw2i_fxH0BQ_wqdq7CbQ';

export const PHOTO_BUCKET = 'vehicle-photos';

console.log('SupabaseClient: Initializing...');
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Only refresh the session token while the app is in the foreground
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
