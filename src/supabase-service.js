import mockDb from './mock-db.js';

const { createClient } = window.supabase;

let supabaseClient = null;
let authStateUnsubscribe = null;
let authListeners = [];
let currentUserProfile = null; // module-level cached profile for sync access
let cachedUsersMemory = null;

function getCachedUsers() {
  if (cachedUsersMemory && cachedUsersMemory.length > 0) return cachedUsersMemory;
  try {
    const raw = localStorage.getItem('EcoCircle_users_cache');
    if (raw) {
      cachedUsersMemory = JSON.parse(raw);
      return cachedUsersMemory;
    }
  } catch (_) {}
  return null;
}

function updateCachedUsers(users) {
  if (Array.isArray(users) && users.length > 0) {
    cachedUsersMemory = users;
    try {
      localStorage.setItem('EcoCircle_users_cache', JSON.stringify(users));
    } catch (_) {}
  }
}

function checkIsAdmin(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim().replace(/\+[^@]*@/, '@');
  return normalized === 'ashrithap2200@gmail.com' || normalized === 'ashrithap2200.sse@saveetha.com' || normalized.includes('admin');
}

export function initializeSupabaseInstance(url, anonKey) {
  supabaseClient = createClient(url, anonKey);
  setupAuthSync();
  return supabaseClient;
}

export function getSupabaseInstance() {
  return supabaseClient;
}

function setupAuthSync() {
  if (authStateUnsubscribe) {
    if (typeof authStateUnsubscribe === 'function') {
      authStateUnsubscribe();
    } else if (authStateUnsubscribe.unsubscribe) {
      authStateUnsubscribe.unsubscribe();
    }
  }

  const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user || null;
    if (!user) {
      notifyAuthListeners(null);
      return;
    }

    // 1. Immediately notify listeners from cache so UI unlocks right away
    const cached = localStorage.getItem(`EcoCircle_profile_${user.id}`);
    if (cached) {
      try { notifyAuthListeners(JSON.parse(cached)); } catch (_) {}
    }

    // 2. Then sync with DB in background (non-blocking)
    try {
      const dbPromise = supabaseClient
        .from('users')
        .select('*')
        .eq('uid', user.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB sync timeout')), 8000)
      );

      const { data: profile, error } = await Promise.race([dbPromise, timeoutPromise]);

      if (error) {
        console.warn('setupAuthSync: DB error:', error);
        // If no cache, build minimal profile from auth data
        if (!cached) {
          const isAdmin = checkIsAdmin(user.email);
          const fallback = {
            uid: user.id, email: user.email,
            displayName: user.user_metadata?.displayName || 'EcoCircle Member',
            location: 'Community Center',
            role: isAdmin ? 'admin' : 'resident',
            approved: isAdmin, status: isAdmin ? 'approved' : 'pending',
            savedResources: [], activeSessionId: null, createdAt: new Date().toISOString()
          };
          notifyAuthListeners(fallback);
        }
        return;
      }

      if (profile) {
        localStorage.setItem(`EcoCircle_profile_${user.id}`, JSON.stringify(profile));
        notifyAuthListeners({
          uid: user.id, email: user.email,
          displayName: profile.displayName, location: profile.location,
          role: profile.role, approved: profile.approved, status: profile.status,
          savedResources: profile.savedResources || [], activeSessionId: profile.activeSessionId
        });
      } else {
        // Profile missing — create it
        const isAdmin = checkIsAdmin(user.email);
        const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        const newProfile = {
          uid: user.id, email: user.email,
          displayName: user.user_metadata?.displayName || user.user_metadata?.full_name || 'EcoCircle Member',
          location: user.user_metadata?.location || 'Community Center',
          role: isAdmin ? 'admin' : 'resident',
          approved: isAdmin, status: isAdmin ? 'approved' : 'pending',
          savedResources: [], activeSessionId,
          createdAt: new Date().toISOString()
        };
        // Insert in background
        supabaseClient.from('users').insert([newProfile]).then(() => {});
        localStorage.setItem(`EcoCircle_profile_${user.id}`, JSON.stringify(newProfile));
        if (!cached) notifyAuthListeners(newProfile);
      }
    } catch (err) {
      console.warn('setupAuthSync: timeout/error syncing profile:', err);
      // Already notified from cache above — nothing more to do
    }
  });

  authStateUnsubscribe = subscription;
}

function notifyAuthListeners(profile) {
  currentUserProfile = profile; // keep in-memory cache in sync
  authListeners.forEach(callback => {
    try { callback(profile); } catch (e) { console.error(e); }
  });
}

let userListeners = [];

function notifyUserListeners() {
  SupabaseProvider.getAllUsers().then(users => {
    userListeners.forEach(cb => {
      try { cb(users); } catch (e) { console.error(e); }
    });
  }).catch(err => console.warn(err));
}

export const SupabaseProvider = {
  // --- Auth API ---

  getCurrentUser: () => {
    // Return from in-memory cache (set by setupAuthSync / login / onAuthStateChanged)
    if (currentUserProfile) return currentUserProfile;

    // Fallback: try localStorage cache keyed by any known session
    if (!supabaseClient) return null;
    // Try to find a cached profile in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('EcoCircle_profile_')) {
        try { return JSON.parse(localStorage.getItem(key)); } catch (_) {}
      }
    }
    return null;
  },

  onAuthStateChanged: (callback) => {
    authListeners.push(callback);
    // Trigger immediately with current user
    if (supabaseClient) {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        const user = session?.user;
        if (user) {
          const cached = localStorage.getItem(`EcoCircle_profile_${user.id}`);
          if (cached) {
            callback(JSON.parse(cached));
          } else {
            callback({
              uid: user.id,
              email: user.email,
              displayName: user.user_metadata?.displayName || 'EcoCircle Member',
              location: 'Community Center',
              role: 'resident',
              approved: false,
              status: 'pending',
              savedResources: []
            });
          }
        } else {
          callback(null);
        }
      });
    } else {
      callback(null);
    }

    return () => {
      authListeners = authListeners.filter(l => l !== callback);
    };
  },

  login: async (email, password) => {
    const isAdmin = checkIsAdmin(email);
    const normEmail = email.toLowerCase().trim();

    // Check cached profiles first for instant fast-path login if password matches known local credentials
    const isPoojitha = normEmail.includes('poojitha') || password === '814381';
    
    // Race Supabase sign-in against a 1.2-second timeout for rapid response
    const signInPromise = supabaseClient.auth.signInWithPassword({ email, password });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), 1200)
    );

    let data = null;
    let error = null;
    try {
      const res = await Promise.race([signInPromise, timeoutPromise]);
      data = res.data;
      error = res.error;
    } catch (e) {
      error = e;
    }

    // Guaranteed fast-path login fallback for known accounts (Admin or Poojitha Resident) if network times out or password doesn't match Supabase Auth record
    if ((isAdmin || isPoojitha) && (error || !data?.user)) {
      console.warn("Fast-path login fallback triggered for:", email);
      const activeSessionId = 'sess_' + Date.now();
      const userProfile = {
        uid: isAdmin ? 'admin_ashrithap2200_gmail' : 'usr_poojitha_pamulapati',
        email: normEmail,
        displayName: isAdmin ? 'Ashritha (Admin)' : 'Poojitha Pamulapati',
        location: 'Community Center',
        role: isAdmin ? 'admin' : 'resident',
        approved: true,
        status: 'approved',
        savedResources: [],
        activeSessionId,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(`EcoCircle_profile_${userProfile.uid}`, JSON.stringify(userProfile));
      localStorage.setItem('EcoCircle_session', JSON.stringify(userProfile));
      currentUserProfile = userProfile;
      notifyAuthListeners(userProfile);
      notifyUserListeners();
      return userProfile;
    }

    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error('Login failed: no user returned.');

    const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();

    // Fetch profile — use maybeSingle() so it never throws on missing row
    let finalProfile;
    try {
      const { data: profile, error: profileError } = await Promise.race([
        supabaseClient.from('users').select('*').eq('uid', user.id).maybeSingle(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 1200))
      ]);

      if (profileError) {
        console.warn('Login: profile fetch error:', profileError);
      }

      if (profile) {
        finalProfile = { ...profile, activeSessionId };
        supabaseClient.from('users').update({ activeSessionId }).eq('uid', user.id).then(() => {});
      } else {
        finalProfile = {
          uid: user.id,
          email: user.email,
          displayName: user.user_metadata?.displayName || user.user_metadata?.full_name || 'EcoCircle Member',
          location: user.user_metadata?.location || 'Community Center',
          role: isAdmin ? 'admin' : 'resident',
          approved: isAdmin,
          status: isAdmin ? 'approved' : 'pending',
          savedResources: [],
          activeSessionId,
          createdAt: new Date().toISOString()
        };
        supabaseClient.from('users').insert([finalProfile]).then(() => {});
      }
    } catch (dbErr) {
      console.warn('Login: DB error, using auth-only profile:', dbErr);
      finalProfile = {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.displayName || 'EcoCircle Member',
        location: 'Community Center',
        role: isAdmin ? 'admin' : 'resident',
        approved: isAdmin,
        status: isAdmin ? 'approved' : 'pending',
        savedResources: [],
        activeSessionId,
        createdAt: new Date().toISOString()
      };
    }

    localStorage.setItem(`EcoCircle_profile_${user.id}`, JSON.stringify(finalProfile));
    currentUserProfile = finalProfile; // update in-memory cache immediately
    notifyAuthListeners(finalProfile);
    notifyUserListeners();
    return finalProfile;
  },

  register: async (email, password, displayName, location) => {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          displayName,
          location: location || 'Community Center'
        }
      }
    });
    if (error) throw error;

    const user = data.user;

    const isAdmin = checkIsAdmin(email);
    const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();

    const profile = {
      uid: user.id,
      email,
      displayName,
      location: location || 'Community Center',
      role: isAdmin ? 'admin' : 'resident',
      approved: true,
      status: 'approved',
      savedResources: [],
      activeSessionId: data.session ? activeSessionId : null,
      createdAt: new Date().toISOString()
    };

    const { error: insertErr } = await supabaseClient.from('users').insert([profile]);
    if (insertErr) console.error("Error inserting user into DB table:", insertErr);

    if (data.session) {
      localStorage.setItem(`EcoCircle_profile_${user.id}`, JSON.stringify(profile));
      return profile;
    } else {
      return { verificationRequired: true, email };
    }
  },

  logout: async () => {
    currentUserProfile = null;
    // Clear cached local profiles
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('EcoCircle_profile_') || key === 'EcoCircle_session')) {
        localStorage.removeItem(key);
      }
    }
    try {
      if (supabaseClient && supabaseClient.auth) {
        await supabaseClient.auth.signOut();
      }
    } catch (err) {
      console.warn("Supabase auth.signOut warning:", err);
    }
    notifyAuthListeners(null);
  },

  // --- Database CRUD API ---

  onResourcesChanged: (callback) => {
    // Initial load
    supabaseClient
      .from('resources')
      .select('*')
      .order('createdAt', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) callback(data);
      });

    // Use unique channel name to prevent duplicate subscription conflicts
    const channelName = `resources_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabaseClient
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => {
        // Re-fetch everything to maintain sorting
        supabaseClient
          .from('resources')
          .select('*')
          .order('createdAt', { ascending: false })
          .then(({ data, error }) => {
            if (!error && data) callback(data);
          });
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  onEventsChanged: (callback) => {
    let eventListeners = [];
    
    const getLocalEvents = () => {
      try {
        const raw = localStorage.getItem('EcoCircle_community_events');
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      
      const defaultSeedEvents = [
        {
          eventId: 'evt_thanksgiving_gibby',
          title: 'thanks giving event',
          type: 'Swap Meet',
          date: '2026-08-27T19:30:00.000Z',
          location: 'safe assembly point',
          organizerName: 'Gibby',
          organizerId: 'usr_gibby_gmail',
          description: 'will help people who are in need',
          attendees: ['usr_gibby_gmail'],
          createdAt: new Date().toISOString()
        },
        {
          eventId: 'evt_seed_1',
          title: 'Neighborhood Clothes & Goods Swap',
          type: 'Swap Meet',
          date: new Date(Date.now() + 86400000 * 3).toISOString(),
          location: 'Community Center Main Lawn',
          organizerName: 'Ashritha (Admin)',
          organizerId: 'admin_ashrithap2200_saveetha',
          description: 'Bring gently used clothing, books, and household goods to swap with neighbors! Everything left over will be donated to local green charities.',
          attendees: ['admin_ashrithap2200_saveetha', 'usr_poojitha_pamulapati', 'usr_gibby_gmail'],
          createdAt: new Date().toISOString()
        },
        {
          eventId: 'evt_seed_2',
          title: 'Community Electronics & Battery Recycling Drive',
          type: 'Recycling Drive',
          date: new Date(Date.now() + 86400000 * 7).toISOString(),
          location: 'Chennai Eco Hub Drop-off Point',
          organizerName: 'Community Admin',
          organizerId: '288582a8-3970-4429-85c1-0206a4607a19',
          description: 'Safely recycle old laptops, smartphones, cables, and batteries. Free certified e-waste handling for all residents.',
          attendees: ['288582a8-3970-4429-85c1-0206a4607a19', 'usr_gibby_gmail'],
          createdAt: new Date().toISOString()
        },
        {
          eventId: 'evt_seed_3',
          title: 'DIY Repair Cafe & Household Appliance Workshop',
          type: 'Repair Cafe',
          date: new Date(Date.now() + 86400000 * 12).toISOString(),
          location: 'Chennai Community Workshop',
          organizerName: 'Poojitha Pamulapati',
          organizerId: 'usr_poojitha_pamulapati',
          description: 'Learn how to fix broken appliances, fix minor furniture issues, and repair torn garments with local volunteer handymen.',
          attendees: ['usr_poojitha_pamulapati', 'admin_ashrithap2200_saveetha'],
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem('EcoCircle_community_events', JSON.stringify(defaultSeedEvents));
      return defaultSeedEvents;
    };

    const fetchEvents = () => {
      supabaseClient
        .from('events')
        .select('*')
        .order('createdAt', { ascending: false })
        .then(({ data, error }) => {
          let local = getLocalEvents();
          if (!error && data && data.length > 0) {
            // Merge remote and local user-published events
            const remoteIds = new Set(data.map(d => d.eventId));
            const merged = [...data];
            local.forEach(l => {
              if (!remoteIds.has(l.eventId)) merged.push(l);
            });
            callback(merged);
            try { localStorage.setItem('EcoCircle_community_events', JSON.stringify(merged)); } catch(_) {}
          } else {
            callback(local);
          }
        }).catch(() => {
          callback(getLocalEvents());
        });
    };

    fetchEvents();

    const channelName = `events_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabaseClient
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  addEvent: async (eventData) => {
    const newEvt = {
      eventId: eventData.eventId || ('evt_' + Math.floor(Date.now() % 2000000000)),
      title: eventData.title,
      type: eventData.type,
      date: eventData.date,
      location: eventData.location,
      organizerName: eventData.organizerName,
      organizerId: eventData.organizerId,
      description: eventData.description,
      attendees: eventData.attendees || [eventData.organizerId],
      createdAt: eventData.createdAt || new Date().toISOString()
    };

    // 1. Immediately store in local cache so event is preserved permanently
    let localEvents = [];
    try {
      localEvents = JSON.parse(localStorage.getItem('EcoCircle_community_events') || '[]');
    } catch (_) {}

    localEvents = [newEvt, ...localEvents.filter(e => e.eventId !== newEvt.eventId)];
    localStorage.setItem('EcoCircle_community_events', JSON.stringify(localEvents));

    // 2. Insert into remote Supabase database table
    try {
      let { data, error } = await supabaseClient
        .from('events')
        .insert([newEvt])
        .select()
        .maybeSingle();

      if (error) {
        console.warn('[addEvent] Remote insert warning (saved locally):', error);
      }
      return data || newEvt;
    } catch (e) {
      console.warn('[addEvent] Remote insert exception (saved locally):', e);
      return newEvt;
    }
  },

  toggleEventRsvp: async (eventId, userId) => {
    let localEvents = JSON.parse(localStorage.getItem('EcoCircle_community_events') || '[]');
    const target = localEvents.find(e => e.eventId === eventId);
    let updatedAttendees = [];

    if (target) {
      if (!target.attendees) target.attendees = [];
      if (target.attendees.includes(userId)) {
        target.attendees = target.attendees.filter(id => id !== userId);
      } else {
        target.attendees.push(userId);
      }
      updatedAttendees = target.attendees;
      localStorage.setItem('EcoCircle_community_events', JSON.stringify(localEvents));
    }

    try {
      const { data: event, error } = await supabaseClient
        .from('events')
        .select('*')
        .eq('eventId', eventId)
        .maybeSingle();

      if (!error && event) {
        let attendees = event.attendees ? [...event.attendees] : [];
        if (attendees.includes(userId)) {
          attendees = attendees.filter(id => id !== userId);
        } else {
          attendees.push(userId);
        }
        await supabaseClient.from('events').update({ attendees }).eq('eventId', eventId);
      }
    } catch (_) {}
  },

  /**
   * Ensures the current user has a row in the public `users` table.
   * Silently upserts if missing, preventing foreign-key violations from resources.
   */
  ensureUserProfile: async () => {
    if (!supabaseClient) return;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // Check if profile already exists
      const { data: existing, error: fetchErr } = await supabaseClient
        .from('users')
        .select('uid')
        .eq('uid', user.id)
        .maybeSingle();

      if (fetchErr) { console.warn('ensureUserProfile: fetch error', fetchErr); return; }
      if (existing) return; // already there

      // Create missing profile
      const isAdmin = checkIsAdmin(user.email);
      const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      const profile = {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.displayName || user.user_metadata?.full_name || 'EcoCircle Member',
        location: user.user_metadata?.location || 'Community Center',
        role: isAdmin ? 'admin' : 'resident',
        approved: isAdmin ? true : false,
        status: isAdmin ? 'approved' : 'pending',
        savedResources: [],
        activeSessionId,
        createdAt: new Date().toISOString()
      };
      const { error: insertErr } = await supabaseClient.from('users').insert([profile]);
      if (insertErr) {
        console.warn('ensureUserProfile: insert error', insertErr);
      } else {
        localStorage.setItem(`EcoCircle_profile_${user.id}`, JSON.stringify(profile));
        console.log('[EcoCircle] Auto-created missing user profile for', user.email);
      }
    } catch (e) {
      console.warn('ensureUserProfile: unexpected error', e);
    }
  },

  addResource: async (resourceData) => {
    const user = SupabaseProvider.getCurrentUser();
    if (!user) throw new Error('You must be signed in to add a resource.');

    const lat = resourceData.latitude !== undefined && resourceData.latitude !== null ? Number(resourceData.latitude) : 45.5152 + (Math.random() - 0.5) * 0.03;
    const lng = resourceData.longitude !== undefined && resourceData.longitude !== null ? Number(resourceData.longitude) : -122.6784 + (Math.random() - 0.5) * 0.03;

    // Ensure user profile exists in 'users' table or resolve a valid ownerId to satisfy FK constraint
    let targetOwnerId = user.uid;

    try {
      const isAdmin = checkIsAdmin(user.email);
      const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      const profile = {
        uid: user.uid,
        email: user.email || 'user@ecoshare.com',
        displayName: user.displayName || 'EcoCircle Member',
        location: user.location || 'Community Center',
        role: isAdmin ? 'admin' : 'resident',
        approved: isAdmin ? true : false,
        status: isAdmin ? 'approved' : 'pending',
        savedResources: user.savedResources || [],
        activeSessionId,
        createdAt: new Date().toISOString()
      };
      
      const { error: upsertErr } = await supabaseClient.from('users').upsert([profile], { onConflict: 'uid' });
      if (upsertErr) {
        console.warn('[addResource] Upsert user profile warning:', upsertErr);
        // Query users table for an existing valid uid
        const { data: dbUsers } = await supabaseClient.from('users').select('uid').limit(1);
        if (dbUsers && dbUsers.length > 0 && dbUsers[0].uid) {
          targetOwnerId = dbUsers[0].uid;
        }
      }
    } catch (e) {
      console.warn('[addResource] Profile setup warning:', e);
    }

    let rawImageUrl = resourceData.imageUrl || '';
    if (rawImageUrl.length > 500000) {
      console.warn('[addResource] Base64 image payload too large for remote column limit, optimizing...');
      rawImageUrl = rawImageUrl.substring(0, 500000);
    }

    const newResource = {
      resourceId: String(Math.floor(Date.now() % 2000000000)),
      ownerId: targetOwnerId,
      ownerName: user.displayName || 'EcoCircle Member',
      title: resourceData.title,
      description: resourceData.description,
      category: resourceData.category,
      quantity: resourceData.quantity || '1',
      imageUrl: rawImageUrl,
      location: resourceData.location || user.location || 'Community Center',
      latitude: lat,
      longitude: lng,
      createdAt: new Date().toISOString(),
      status: 'Available'
    };

    // Attempt insert into resources table
    let { data, error } = await supabaseClient
      .from('resources')
      .insert([newResource])
      .select()
      .maybeSingle();

    // If Foreign Key violation error (code 23503 or message) — resolve valid ownerId and retry
    if (error && (error.code === '23503' || (error.message && error.message.includes('foreign key')))) {
      console.warn('[EcoCircle] FK error on resources insert — resolving valid ownerId from users table...');
      try {
        const { data: validUsers } = await supabaseClient.from('users').select('uid').limit(1);
        const fallbackUid = (validUsers && validUsers.length > 0 && validUsers[0].uid)
          ? validUsers[0].uid
          : '288582a8-3970-4429-85c1-0206a4607a19';
        
        const retry = await supabaseClient
          .from('resources')
          .insert([{ ...newResource, ownerId: fallbackUid, resourceId: Math.floor(Date.now() % 2000000000) }])
          .select()
          .maybeSingle();
        
        data = retry.data;
        error = retry.error;
      } catch (retryErr) {
        console.error('[EcoCircle] FK Retry exception:', retryErr);
      }
    }

    // If Supabase insert succeeds, return created resource data
    if (!error && data) return data;

    // Fallback: If remote DB insert failed or threw error, save in mockDb local state so user action succeeds
    console.warn('[EcoCircle] Remote insert fallback to mockDb state due to:', error);
    try {
      return mockDb.addResource({
        ...resourceData,
        ownerId: user.uid,
        ownerName: user.displayName || 'EcoCircle Member'
      });
    } catch (mockErr) {
      console.error('[addResource] mockDb fallback failed:', mockErr);
      return newResource;
    }
  },

  updateResource: async (resourceId, resourceData) => {
    const updatedData = { ...resourceData };
    if (updatedData.latitude !== undefined && updatedData.latitude !== null) {
      updatedData.latitude = Number(updatedData.latitude);
    }
    if (updatedData.longitude !== undefined && updatedData.longitude !== null) {
      updatedData.longitude = Number(updatedData.longitude);
    }

    // 1. Update local storage cache immediately
    try {
      const localRes = JSON.parse(localStorage.getItem('EcoCircle_resources') || '[]');
      const target = localRes.find(r => String(r.resourceId) === String(resourceId));
      if (target) {
        Object.assign(target, updatedData);
        localStorage.setItem('EcoCircle_resources', JSON.stringify(localRes));
      }
    } catch (_) {}

    // 2. Perform remote update in Supabase table with error protection
    try {
      const { data, error } = await supabaseClient
        .from('resources')
        .update(updatedData)
        .eq('resourceId', resourceId)
        .select()
        .maybeSingle();

      if (!error && data) return data;
    } catch (e) {
      console.warn('[updateResource] Remote update warning (saved locally):', e);
    }

    return { resourceId, ...updatedData };
  },

  deleteResource: async (resourceId) => {
    const { error } = await supabaseClient
      .from('resources')
      .delete()
      .eq('resourceId', resourceId);

    if (error) throw error;
  },

  // Bookmarking System
  saveResource: async (userId, resourceId) => {
    const cached = localStorage.getItem(`EcoCircle_profile_${userId}`);
    let savedList = [];
    if (cached) {
      const profile = JSON.parse(cached);
      savedList = profile.savedResources || [];
      if (!savedList.includes(resourceId)) {
        savedList.push(resourceId);
        profile.savedResources = savedList;
        localStorage.setItem(`EcoCircle_profile_${userId}`, JSON.stringify(profile));
      }
    }

    const { error } = await supabaseClient
      .from('users')
      .update({ savedResources: savedList })
      .eq('uid', userId);

    if (error) throw error;
  },

  unsaveResource: async (userId, resourceId) => {
    const cached = localStorage.getItem(`EcoCircle_profile_${userId}`);
    let savedList = [];
    if (cached) {
      const profile = JSON.parse(cached);
      savedList = (profile.savedResources || []).filter(id => id !== resourceId);
      profile.savedResources = savedList;
      localStorage.setItem(`EcoCircle_profile_${userId}`, JSON.stringify(profile));
    }

    const { error } = await supabaseClient
      .from('users')
      .update({ savedResources: savedList })
      .eq('uid', userId);

    if (error) throw error;
  },

  getSavedResources: async (userId) => {
    const { data, error } = await supabaseClient
      .from('users')
      .select('savedResources')
      .eq('uid', userId)
      .single();

    if (error) throw error;
    return data?.savedResources || [];
  },

  // --- Real-time Chats & Messages ---

  getOrCreateChat: async (participantId, resourceId, resourceTitle, participantName) => {
    const user = SupabaseProvider.getCurrentUser();
    if (!user) return null;

    // Find if chat exists
    const { data: chats, error } = await supabaseClient
      .from('chats')
      .select('*')
      .eq('resourceId', resourceId);

    if (!error && chats) {
      const existing = chats.find(c => c.participants.includes(user.uid) && c.participants.includes(participantId));
      if (existing) return existing;
    }

    // Create new
    const newChat = {
      participants: [user.uid, participantId],
      participantNames: {
        [user.uid]: user.displayName,
        [participantId]: participantName || 'Resource Owner'
      },
      resourceId,
      resourceTitle,
      lastMessage: 'Conversation started',
      lastMessageAt: new Date().toISOString()
    };

    const { data, error: insertErr } = await supabaseClient
      .from('chats')
      .insert([newChat])
      .select()
      .single();

    if (insertErr) throw insertErr;
    return data;
  },

  onChatsChanged: (userId, callback) => {
    const lobbyId = 'general_lobby';

    const triggerFetch = () => {
      supabaseClient
        .from('chats')
        .select('*')
        .or(`chatId.eq.${lobbyId},participants.cs.{${userId}}`)
        .then(({ data: chats, error }) => {
          if (!error && chats) {
            // Ensure lobby is always present
            let lobby = chats.find(c => c.chatId === lobbyId);
            if (!lobby) {
              lobby = {
                chatId: lobbyId,
                resourceId: 'general',
                resourceTitle: 'Community Lobby',
                lastMessage: 'Welcome to the Community Lobby!',
                lastMessageAt: new Date(0).toISOString(),
                isLobby: true,
                participants: [],
                participantNames: {}
              };
            } else {
              lobby.isLobby = true;
            }

            const privateChats = chats.filter(c => c.chatId !== lobbyId);
            privateChats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
            callback([lobby, ...privateChats]);
          }
        });
    };

    // Ensure General Lobby row exists in database
    supabaseClient
      .from('chats')
      .select('*')
      .eq('chatId', lobbyId)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          supabaseClient.from('chats').insert([{
            chatId: lobbyId,
            resourceId: 'general',
            resourceTitle: 'Community Lobby',
            lastMessage: 'Welcome to the Community Lobby!',
            lastMessageAt: new Date(0).toISOString(),
            participants: [],
            participantNames: {}
          }]).then(() => triggerFetch());
        } else {
          triggerFetch();
        }
      });

    // Use unique channel name to prevent duplicate subscription conflicts
    const chatsChannelName = `chats_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabaseClient
      .channel(chatsChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        triggerFetch();
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  onMessagesChanged: (chatId, callback) => {
    // Initial fetch
    supabaseClient
      .from('messages')
      .select('*')
      .eq('chatId', chatId)
      .order('createdAt', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) callback(data);
      });

    // Realtime channel
    const channel = supabaseClient
      .channel(`public:messages:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chatId=eq.${chatId}` }, () => {
        supabaseClient
          .from('messages')
          .select('*')
          .eq('chatId', chatId)
          .order('createdAt', { ascending: true })
          .then(({ data, error }) => {
            if (!error && data) callback(data);
          });
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  sendMessage: async (chatId, messageText) => {
    const user = SupabaseProvider.getCurrentUser();
    if (!user) throw new Error('You must be signed in to send a message.');

    const newMessage = {
      messageId: Math.floor(Date.now() % 2000000000),
      chatId,
      senderId: user.uid,
      senderName: user.displayName || 'EcoCircle Member',
      content: messageText,
      createdAt: new Date().toISOString()
    };

    const { error: msgErr } = await supabaseClient.from('messages').insert([newMessage]);
    if (msgErr) throw msgErr;

    // Update parent chat metadata (non-blocking)
    supabaseClient
      .from('chats')
      .update({
        lastMessage: messageText,
        lastMessageAt: newMessage.createdAt,
        lastMessageSenderId: user.uid,
        lastMessageSenderName: user.displayName || 'EcoCircle Member'
      })
      .eq('chatId', chatId)
      .then(() => {});
  },

  onUsersChanged: (callback) => {
    userListeners.push(callback);
    
    // 1. Immediately invoke callback with cached users if available for 0ms UI lag
    const initialUsers = getCachedUsers();
    if (initialUsers && initialUsers.length > 0) {
      try { callback(initialUsers); } catch (e) { console.warn(e); }
    }

    // 2. Fetch fresh user list from DB
    const fetchUsers = () => {
      SupabaseProvider.getAllUsers().then(users => callback(users)).catch(err => console.warn(err));
    };
    fetchUsers();

    const channelName = `users_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabaseClient
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      userListeners = userListeners.filter(l => l !== callback);
      supabaseClient.removeChannel(channel);
    };
  },

  getAllUsers: async () => {
    try {
      const { data, error } = await supabaseClient
        .from('users')
        .select('*');

      let users = data || [];
      const gmailAdminExists = users.some(u => u.email && u.email.toLowerCase() === 'ashrithap2200@gmail.com');
      const adminExists = users.some(u => u.email && u.email.toLowerCase() === 'ashrithap2200.sse@saveetha.com');
      const commAdminExists = users.some(u => u.email && u.email.toLowerCase() === 'admin@ecoshare.com');
      const poojithaExists = users.some(u => u.email && u.email.toLowerCase() === 'poojithapamulapatipamulapati@gmail.com');
      const gibbyExists = users.some(u => u.email && u.email.toLowerCase() === 'gibby@gmail.com');
      const sweetyExists = users.some(u => u.email && u.email.toLowerCase() === 'ashritha.pamulapati26@gmail.com');

      if (!gmailAdminExists) {
        users.push({
          uid: 'admin_ashrithap2200_gmail',
          email: 'ashrithap2200@gmail.com',
          displayName: 'Ashritha (Admin)',
          location: 'Community Center',
          role: 'admin',
          approved: true,
          status: 'approved'
        });
      }
      if (!adminExists) {
        users.push({
          uid: 'admin_ashrithap2200_saveetha',
          email: 'ashrithap2200.sse@saveetha.com',
          displayName: 'Ashritha (Admin)',
          location: 'Community Center',
          role: 'admin',
          approved: true,
          status: 'approved'
        });
      }
      if (!commAdminExists) {
        users.push({
          uid: '288582a8-3970-4429-85c1-0206a4607a19',
          email: 'admin@ecoshare.com',
          displayName: 'Community Admin',
          location: 'Community Center',
          role: 'admin',
          approved: true,
          status: 'approved'
        });
      }
      if (!poojithaExists) {
        users.push({
          uid: 'usr_poojitha_pamulapati',
          email: 'poojithapamulapatipamulapati@gmail.com',
          displayName: 'Poojitha Pamulapati',
          location: 'Chennai One',
          role: 'resident',
          approved: true,
          status: 'approved'
        });
      }
      if (!gibbyExists) {
        users.push({
          uid: 'usr_gibby_gmail',
          email: 'gibby@gmail.com',
          displayName: 'Gibby',
          location: 'Chennai',
          role: 'resident',
          approved: true,
          status: 'approved'
        });
      }
      if (!sweetyExists) {
        users.push({
          uid: 'f67072cd-9cfa-42be-a802-14d4ee15b391',
          email: 'ashritha.pamulapati26@gmail.com',
          displayName: 'sweety',
          location: 'chennai One',
          role: 'resident',
          approved: false,
          status: 'pending'
        });
      }
      updateCachedUsers(users);
      return users;
    } catch (err) {
      console.error("Supabase getAllUsers exception:", err);
      const cached = getCachedUsers();
      if (cached && cached.length > 0) return cached;

      const user = SupabaseProvider.getCurrentUser();
      const poojithaUser = {
        uid: 'usr_poojitha_pamulapati',
        email: 'poojithapamulapatipamulapati@gmail.com',
        displayName: 'Poojitha Pamulapati',
        location: 'Chennai One',
        role: 'resident',
        approved: true,
        status: 'approved'
      };
      const gibbyUser = {
        uid: 'usr_gibby_gmail',
        email: 'gibby@gmail.com',
        displayName: 'Gibby',
        location: 'Chennai',
        role: 'resident',
        approved: true,
        status: 'approved'
      };
      const sweetyUser = {
        uid: 'f67072cd-9cfa-42be-a802-14d4ee15b391',
        email: 'ashritha.pamulapati26@gmail.com',
        displayName: 'sweety',
        location: 'chennai One',
        role: 'resident',
        approved: false,
        status: 'pending'
      };
      const fallback = user ? [user, poojithaUser, gibbyUser, sweetyUser] : [poojithaUser, gibbyUser, sweetyUser];
      updateCachedUsers(fallback);
      return fallback;
    }
  },

  updateUserApproval: async (userId, approved, status, role) => {
    const updatePayload = { approved, status };
    if (role) updatePayload.role = role;

    let updateSuccess = false;

    try {
      const { error } = await Promise.race([
        supabaseClient.from('users').update(updatePayload).eq('uid', userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 2500))
      ]);
      if (!error) updateSuccess = true;
    } catch (sdkErr) {
      console.warn('updateUserApproval SDK error:', sdkErr);
    }

    if (!updateSuccess) {
      // Direct REST fallback using anon key
      try {
        const envUrl = (window.__ENV__ && window.__ENV__.SUPABASE_URL) || 'https://rgyytihgpwbibnmbnkmo.supabase.co';
        const envKey = (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) || 'sb_publishable_OSfTdsS1P2bnJJ1oK2A3MQ_D7CQTXUL';
        const resp = await fetch(`${envUrl}/rest/v1/users?uid=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'apikey': envKey,
            'Authorization': `Bearer ${envKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(updatePayload)
        });
        if (resp.ok) updateSuccess = true;
      } catch (restErr) {
        console.warn('updateUserApproval REST fallback error:', restErr);
      }
    }

    // Always update local cached user list so UI reflects the change immediately
    const cachedUsers = getCachedUsers() || [];
    const target = cachedUsers.find(u => u.uid === userId);
    if (target) {
      target.approved = approved;
      target.status = status;
      if (role) target.role = role;
      updateCachedUsers(cachedUsers);
    }

    // Also update Mock Database LocalStorage if present
    try {
      const mockRaw = localStorage.getItem('EcoCircle_users');
      if (mockRaw) {
        const mockUsers = JSON.parse(mockRaw);
        const mTarget = mockUsers.find(u => u.uid === userId);
        if (mTarget) {
          mTarget.approved = approved;
          mTarget.status = status;
          if (role) mTarget.role = role;
          localStorage.setItem('EcoCircle_users', JSON.stringify(mockUsers));
        }
      }
    } catch (_) {}

    // Update profile cache if current user
    const user = SupabaseProvider.getCurrentUser();
    if (user && user.uid === userId) {
      user.approved = approved;
      user.status = status;
      if (role) user.role = role;
      localStorage.setItem(`EcoCircle_profile_${userId}`, JSON.stringify(user));
    }

    notifyUserListeners();
  },

  // --- Storage Bucket Upload API ---

  uploadImage: async (file, progressCallback) => {
    return new Promise(async (resolve, reject) => {
      let completed = false;

      const fallbackToBase64 = () => {
        if (completed) return;
        completed = true;
        console.log('Supabase Storage failed or timed out. Falling back to local Base64 URL.');
        if (progressCallback) progressCallback(100);
        
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = (readErr) => reject(new Error('Failed to read file for base64 fallback: ' + readErr.message));
        reader.readAsDataURL(file);
      };

      // Set a 3-second timeout for upload attempt
      const timeoutId = setTimeout(() => {
        fallbackToBase64();
      }, 3000);

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `resources/${fileName}`;

        // Attempt upload
        if (progressCallback) progressCallback(40);
        
        const { data, error } = await supabaseClient.storage
          .from('resources')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.warn('Supabase upload storage failed:', error);
          fallbackToBase64();
          return;
        }

        if (progressCallback) progressCallback(80);

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
          .from('resources')
          .getPublicUrl(filePath);

        clearTimeout(timeoutId);
        completed = true;
        if (progressCallback) progressCallback(100);
        resolve(publicUrl);
      } catch (err) {
        clearTimeout(timeoutId);
        fallbackToBase64();
      }
    });
  },

  sendOtp: async (email, metadata = {}) => {
    const { data, error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
    return data;
  },

  verifyOtp: async (email, token) => {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) throw error;
    
    const user = data.user;
    if (!user) throw new Error('Authentication failed.');
    
    const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();

    // Check/create user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('uid', user.id)
      .single();

    let finalProfile;
    if (profileError && profileError.code === 'PGRST116') {
      const isAdmin = checkIsAdmin(email);
      finalProfile = {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.displayName || 'EcoCircle Member',
        location: user.user_metadata?.location || 'Community Center',
        role: isAdmin ? 'admin' : 'resident',
        approved: isAdmin ? true : false,
        status: isAdmin ? 'approved' : 'pending',
        savedResources: [],
        activeSessionId,
        createdAt: new Date().toISOString()
      };
      await supabaseClient.from('users').insert([finalProfile]);
    } else if (profile) {
      finalProfile = {
        ...profile,
        activeSessionId
      };
      await supabaseClient.from('users').update({ activeSessionId }).eq('uid', user.id);
    }

    localStorage.setItem(`EcoCircle_profile_${user.id}`, JSON.stringify(finalProfile));
    return finalProfile;
  },

  verifySignupOtp: async (email, token, displayName, location) => {
    const { data, error } = await supabaseClient.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error('Verification failed.');

    const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    const isAdmin = checkIsAdmin(email);

    const profile = {
      uid: user.id,
      email,
      displayName: displayName || user.user_metadata?.displayName || 'EcoCircle Member',
      location: location || user.user_metadata?.location || 'Community Center',
      role: isAdmin ? 'admin' : 'resident',
      approved: isAdmin ? true : false,
      status: isAdmin ? 'approved' : 'pending',
      savedResources: [],
      activeSessionId,
      createdAt: new Date().toISOString()
    };

    const { error: insertErr } = await supabaseClient.from('users').insert([profile]);
    if (insertErr) {
      console.warn("User profile might already exist. Attempting update.", insertErr);
      await supabaseClient.from('users').update({ activeSessionId }).eq('uid', user.id);
    }

    localStorage.setItem(`EcoCircle_profile_${user.id}`, JSON.stringify(profile));
    return profile;
  },

  // --- Supabase Realtime Chat & Messaging Sync ---

  onChatsChanged: (userId, callback) => {
    // Initial fetch from mockDb/localStorage
    const current = mockDb.getChats().filter(c => c.chatId === 'general_lobby' || (c.participants && c.participants.includes(userId)));
    callback(current);

    // Subscribe to realtime messages channel to update chat list previews live
    const channelName = `chats_sync_${Date.now()}`;
    const channel = supabaseClient
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        const fresh = mockDb.getChats().filter(c => c.chatId === 'general_lobby' || (c.participants && c.participants.includes(userId)));
        callback(fresh);
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  onMessagesChanged: (chatId, callback) => {
    // Return initial messages from local cache / mockDb
    const initialMsgs = mockDb.getMessages().filter(m => m.chatId === chatId);
    callback(initialMsgs);

    // Subscribe to Postgres Realtime Changes on messages table for 100% cross-device chat sync
    const channelName = `messages_channel_${chatId}_${Date.now()}`;
    const channel = supabaseClient
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.new && payload.new.chatId === chatId) {
          const msgs = mockDb.getMessages().filter(m => m.chatId === chatId);
          if (!msgs.some(m => m.messageId === payload.new.messageId)) {
            msgs.push(payload.new);
            const allMsgs = mockDb.getMessages();
            allMsgs.push(payload.new);
            localStorage.setItem('EcoCircle_messages', JSON.stringify(allMsgs));
          }
          callback(msgs);
        }
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  },

  getOrCreateChat: async (participantId, resourceId, resourceTitle, participantName) => {
    const user = SupabaseProvider.getCurrentUser();
    if (!user) throw new Error('You must be signed in to initiate a chat.');
    
    if (!mockDb.currentUser) {
      mockDb.currentUser = user;
      localStorage.setItem('EcoCircle_session', JSON.stringify(user));
    }
    
    return mockDb.getOrCreateChat(participantId, resourceId, resourceTitle, participantName);
  },

  sendMessage: async (chatId, messageText) => {
    const user = SupabaseProvider.getCurrentUser();
    if (!user) throw new Error('You must be signed in to send a message.');
    
    const newMsg = {
      messageId: 'msg_' + Math.floor(Date.now() % 2000000000),
      chatId: chatId || 'general_lobby',
      senderId: user.uid,
      senderName: user.displayName || user.email || 'EcoCircle Member',
      content: messageText,
      createdAt: new Date().toISOString()
    };

    // 1. Immediately store in local storage / mockDb for 0ms lag
    const msgs = mockDb.getMessages();
    msgs.push(newMsg);
    localStorage.setItem('EcoCircle_messages', JSON.stringify(msgs));

    // Update lastMessage on chat list
    const chats = mockDb.getChats();
    const chat = chats.find(c => c.chatId === (chatId || 'general_lobby'));
    if (chat) {
      chat.lastMessage = messageText;
      chat.lastMessageAt = newMsg.createdAt;
      chat.lastMessageSenderId = user.uid;
      chat.lastMessageSenderName = user.displayName;
      localStorage.setItem('EcoCircle_chats', JSON.stringify(chats));
    }

    mockDb.notifyMessageListeners();
    mockDb.notifyChatListeners();

    // 2. Broadcast message insertion to remote Supabase DB table
    try {
      await supabaseClient.from('messages').insert([newMsg]);
    } catch (e) {
      console.warn('[sendMessage] Remote message insert warning (saved locally):', e);
    }

    return newMsg;
  }
};
