import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = APP_CONFIG.SUPABASE_URL;
const supabaseAnonKey = APP_CONFIG.SUPABASE_ANON_KEY;

let supabaseClient = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  console.log('[Supabase] Client initialized.');
} else {
  console.warn('[Supabase] Missing URL or anon key. Auth will fall back to mock mode.');
}

window.__supabase = supabaseClient;

/**
 * Dispatch event so Alpine stores/components can react.
 * Module scripts run AFTER deferred scripts (Alpine), so
 * listeners registered during alpine:init will catch this event.
 */
document.dispatchEvent(new CustomEvent('supabase:ready', { detail: { client: supabaseClient } }));
