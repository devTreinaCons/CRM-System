import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mdasvylxicarwtcfouao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kYXN2eWx4aWNhcnd0Y2ZvdWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Mzg2MDIsImV4cCI6MjA4NzUxNDYwMn0.40bILN3eD4vwPLcxn6SlB3bjQLxohOEEhWLSqYJNxTw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
