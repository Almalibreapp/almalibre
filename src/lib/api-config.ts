const SUPABASE_FUNCTIONS_URL = 'https://nrfhtviwgrkbyiujxlrd.supabase.co/functions/v1';

// No auth headers needed - Edge Functions are public
export const API_HEADERS: Record<string, string> = {};

// Headers for POST requests only
export const API_POST_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
};

export const API_ENDPOINTS = {
  ventas: `${SUPABASE_FUNCTIONS_URL}/ventas`,
  estado: `${SUPABASE_FUNCTIONS_URL}/estado`,
  stock: `${SUPABASE_FUNCTIONS_URL}/stock`,
  temperatura: `${SUPABASE_FUNCTIONS_URL}/temperatura`,
  productos: `${SUPABASE_FUNCTIONS_URL}/productos`,
  control: `${SUPABASE_FUNCTIONS_URL}/control`,
} as const;
