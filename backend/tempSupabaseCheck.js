const { supabaseAdmin } = require('./supabase');
console.log('supabaseAdmin type:', typeof supabaseAdmin);
console.log('has from:', typeof supabaseAdmin.from);
console.log('supabaseAdmin from is function:', typeof supabaseAdmin.from === 'function');
