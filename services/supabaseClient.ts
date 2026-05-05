
import { createClient } from '@supabase/supabase-js';

// Credenciales proporcionadas por el usuario para conexión directa
const supabaseUrl = 'https://iaurkkzcrxifpvtmzodv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdXJra3pjcnhpZnB2dG16b2R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjU3MjUsImV4cCI6MjA4MzYwMTcyNX0.nWk5kKK7v3y2coJUmInmvkbO6d-57Wy1UY5GiAXNusY';

// Flag para saber si tenemos una configuración real (siempre true ahora que tenemos las llaves)
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey && supabaseUrl.includes('supabase.co');

export const supabase = createClient(supabaseUrl, supabaseKey);
