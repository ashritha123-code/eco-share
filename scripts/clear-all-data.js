const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '../.env');
let supabaseUrl = 'https://rgyytihgpwbibnmbnkmo.supabase.co';
let supabaseAnonKey = 'sb_publishable_OSfTdsS1P2bnJJ1oK2A3MQ_D7CQTXUL';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('SUPABASE_URL=')) {
      supabaseUrl = trimmed.split('=')[1].trim();
    }
    if (trimmed.startsWith('SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = trimmed.split('=')[1].trim();
    }
  });
}

console.log('[Clear All Data] Supabase Target URL:', supabaseUrl);

async function clearSupabaseTable(tableName, primaryKeyName) {
  try {
    const endpoint = `${supabaseUrl}/rest/v1/${tableName}?${primaryKeyName}=neq.DUMMY_NEQ_VALUE`;
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    });

    if (response.ok) {
      console.log(`[Clear All Data] ✅ Cleared Supabase table: "${tableName}"`);
    } else {
      const errText = await response.text();
      console.warn(`[Clear All Data] ⚠️ Could not clear "${tableName}": status ${response.status}`, errText);
    }
  } catch (err) {
    console.error(`[Clear All Data] ❌ Error clearing table "${tableName}":`, err.message);
  }
}

async function run() {
  console.log('[Clear All Data] Clearing all records from Supabase cloud database...');
  await clearSupabaseTable('messages', 'messageId');
  await clearSupabaseTable('chats', 'chatId');
  await clearSupabaseTable('resources', 'resourceId');
  await clearSupabaseTable('users', 'uid');
  console.log('[Clear All Data] Done.');
}

run();
