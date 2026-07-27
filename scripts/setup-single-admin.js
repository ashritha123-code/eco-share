const fs = require('fs');
const path = require('path');

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

console.log('[Setup Single Admin] Target URL:', supabaseUrl);

async function clearTable(tableName, keyName) {
  try {
    const endpoint = `${supabaseUrl}/rest/v1/${tableName}?${keyName}=neq.DUMMY_KEY_VAL`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    });
    if (res.ok) {
      console.log(`[Setup Single Admin] ✅ Table "${tableName}" cleared.`);
    } else {
      console.warn(`[Setup Single Admin] Warning clearing "${tableName}": ${res.status}`);
    }
  } catch (err) {
    console.error(`[Setup Single Admin] Error clearing "${tableName}":`, err.message);
  }
}

async function insertUser(userData) {
  try {
    const endpoint = `${supabaseUrl}/rest/v1/users`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(userData)
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`[Setup Single Admin] ✅ Inserted Single Admin user:`, data[0]?.email);
    } else {
      const errText = await res.text();
      console.error(`[Setup Single Admin] ❌ Failed to insert user: ${res.status}`, errText);
    }
  } catch (err) {
    console.error(`[Setup Single Admin] Error inserting user:`, err.message);
  }
}

async function insertGeneralLobby() {
  try {
    const endpoint = `${supabaseUrl}/rest/v1/chats`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        chatId: 'general_lobby',
        participants: [],
        participantNames: {},
        resourceId: 'general',
        resourceTitle: 'Community Lobby',
        lastMessage: 'Welcome to the Community Lobby!',
        lastMessageAt: new Date().toISOString(),
        isLobby: true
      })
    });
    if (res.ok) {
      console.log(`[Setup Single Admin] ✅ Created Community Lobby chat.`);
    }
  } catch (err) {
    console.error(`[Setup Single Admin] Error creating lobby:`, err.message);
  }
}

async function run() {
  console.log('[Setup Single Admin] Clearing existing database tables...');
  await clearTable('messages', 'messageId');
  await clearTable('chats', 'chatId');
  await clearTable('resources', 'resourceId');
  await clearTable('users', 'uid');

  console.log('[Setup Single Admin] Creating single admin user: ashrithap2200.sse@saveetha.com...');
  const singleAdmin = {
    uid: 'admin_ashrithap2200_saveetha',
    email: 'ashrithap2200.sse@saveetha.com',
    displayName: 'Ashritha (Admin)',
    location: 'Community Center',
    role: 'admin',
    approved: true,
    status: 'approved',
    savedResources: [],
    createdAt: new Date().toISOString()
  };

  await insertUser(singleAdmin);
  await insertGeneralLobby();
  console.log('[Setup Single Admin] Complete!');
}

run();
