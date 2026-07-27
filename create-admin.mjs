// Script to create/check admin account in Supabase
// Run with: node create-admin.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rgyytihgpwbibnmbnkmo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OSfTdsS1P2bnJJ1oK2A3MQ_D7CQTXUL';

const ADMIN_EMAIL = 'ashrithap2200.sse@saveetha.com';
const ADMIN_PASSWORD = 'Password123';
const ADMIN_NAME = 'Ashritha Admin';
const ADMIN_LOCATION = 'Saveetha, Chennai';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('Attempting to create admin account in Supabase...\n');

  // Step 1: Try signing up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    options: {
      data: {
        displayName: ADMIN_NAME,
        location: ADMIN_LOCATION
      }
    }
  });

  if (signUpError) {
    if (signUpError.message.includes('already registered') || signUpError.message.includes('User already registered')) {
      console.log('✅ Account already exists in Supabase Auth.');
      console.log('   The password might be different. Sending password reset email...');
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(ADMIN_EMAIL);
      if (resetError) {
        console.error('❌ Failed to send password reset:', resetError.message);
      } else {
        console.log('📧 Password reset email sent to:', ADMIN_EMAIL);
        console.log('   Check your inbox and reset the password to: Password123');
      }
    } else {
      console.error('❌ Sign up failed:', signUpError.message);
    }
    return;
  }

  const user = signUpData.user;
  const session = signUpData.session;

  if (!user) {
    console.error('❌ Sign up returned no user.');
    return;
  }

  if (!session) {
    console.log('⚠️  Account created but EMAIL CONFIRMATION IS REQUIRED.');
    console.log('   A verification email was sent to:', ADMIN_EMAIL);
    console.log('   Please check your inbox and click the verification link.');
    console.log('\n   OR: Go to your Supabase Dashboard → Authentication → Email Templates');
    console.log('   and disable "Confirm email" under Auth → Settings → Email Auth');
    return;
  }

  console.log('✅ Admin account created successfully! Session active.');
  console.log('   UID:', user.id);

  // Step 2: Insert into users table
  const adminProfile = {
    uid: user.id,
    email: ADMIN_EMAIL,
    displayName: ADMIN_NAME,
    location: ADMIN_LOCATION,
    role: 'admin',
    approved: true,
    status: 'approved',
    savedResources: [],
    activeSessionId: 'sess_admin_' + Date.now(),
    createdAt: new Date().toISOString()
  };

  const { error: insertError } = await supabase
    .from('users')
    .upsert([adminProfile], { onConflict: 'uid' });

  if (insertError) {
    console.warn('⚠️  Could not insert into users table:', insertError.message);
  } else {
    console.log('✅ Admin profile inserted into users table.');
  }

  console.log('\n🎉 Done! You can now log in with:');
  console.log('   Email:    ', ADMIN_EMAIL);
  console.log('   Password: ', ADMIN_PASSWORD);
}

main().catch(console.error);
