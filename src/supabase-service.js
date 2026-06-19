const { createClient } = window.supabase;

let supabaseClient = null;
let authStateUnsubscribe = null;
let authListeners = [];
let currentUserProfile = null; // module-level cached profile for sync access

function checkIsAdmin(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim().replace(/\+[^@]*@/, '@');
  return normalized === 'admin@gmail.com' || normalized === 'admin@ecocircle.com' || normalized === 'ashrithap2200.sse@saveetha.com';
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
    // Race Supabase sign-in against a 15-second timeout
    const signInPromise = supabaseClient.auth.signInWithPassword({ email, password });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Sign in timed out. Please check your internet connection and try again.')), 15000)
    );

    const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error('Login failed: no user returned.');

    const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();

    // Fetch profile — use maybeSingle() so it never throws on missing row
    let finalProfile;
    try {
      const { data: profile, error: profileError } = await Promise.race([
        supabaseClient.from('users').select('*').eq('uid', user.id).maybeSingle(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 8000))
      ]);

      if (profileError) {
        console.warn('Login: profile fetch error:', profileError);
      }

      if (profile) {
        finalProfile = { ...profile, activeSessionId };
        // Update session ID in background — don't await to avoid blocking
        supabaseClient.from('users').update({ activeSessionId }).eq('uid', user.id).then(() => {});
      } else {
        // Profile missing — create it
        const isAdmin = checkIsAdmin(email);
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
      // DB call failed/timed out — build a minimal profile from auth data so login still succeeds
      console.warn('Login: DB error, using auth-only profile:', dbErr);
      const isAdmin = checkIsAdmin(email);
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
      approved: isAdmin ? true : false,
      status: isAdmin ? 'approved' : 'pending',
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
    currentUserProfile = null; // clear in-memory cache
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
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

    const newResource = {
      resourceId: Math.floor(Date.now() % 2000000000),
      ownerId: user.uid,
      ownerName: user.displayName || 'EcoCircle Member',
      title: resourceData.title,
      description: resourceData.description,
      category: resourceData.category,
      quantity: resourceData.quantity || '1',
      imageUrl: resourceData.imageUrl || '',
      location: resourceData.location || user.location || 'Community Center',
      latitude: lat,
      longitude: lng,
      createdAt: new Date().toISOString(),
      status: 'Available'
    };

    // First attempt
    let { data, error } = await supabaseClient
      .from('resources')
      .insert([newResource])
      .select()
      .single();

    // If FK violation — auto-create profile and retry once
    if (error && (error.code === '23503' || (error.message && error.message.includes('foreign key')))) {
      console.warn('[EcoCircle] FK error on resources insert — auto-creating user profile and retrying...');
      const isAdmin = checkIsAdmin(user.email);
      const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      const profile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'EcoCircle Member',
        location: user.location || 'Community Center',
        role: isAdmin ? 'admin' : 'resident',
        approved: isAdmin,
        status: isAdmin ? 'approved' : 'pending',
        savedResources: [],
        activeSessionId,
        createdAt: new Date().toISOString()
      };
      // Insert user profile (ignore conflict if already exists)
      await supabaseClient.from('users').upsert([profile], { onConflict: 'uid' });
      localStorage.setItem(`EcoCircle_profile_${user.uid}`, JSON.stringify(profile));

      // Retry resource insert
      const retry = await supabaseClient
        .from('resources')
        .insert([{ ...newResource, resourceId: Math.floor(Date.now() % 2000000000) }])
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    return data;
  },

  updateResource: async (resourceId, resourceData) => {
    const updatedData = { ...resourceData };
    if (updatedData.latitude !== undefined && updatedData.latitude !== null) {
      updatedData.latitude = Number(updatedData.latitude);
    }
    if (updatedData.longitude !== undefined && updatedData.longitude !== null) {
      updatedData.longitude = Number(updatedData.longitude);
    }

    const { data, error } = await supabaseClient
      .from('resources')
      .update(updatedData)
      .eq('resourceId', resourceId)
      .select()
      .single();

    if (error) throw error;
    return data;
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

  getAllUsers: async () => {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*');

    if (error) throw error;
    return data || [];
  },

  updateUserApproval: async (userId, approved, status) => {
    const { error } = await supabaseClient
      .from('users')
      .update({ approved, status })
      .eq('uid', userId);

    if (error) throw error;

    // Update cache if current user
    const user = SupabaseProvider.getCurrentUser();
    if (user && user.uid === userId) {
      user.approved = approved;
      user.status = status;
      localStorage.setItem(`EcoCircle_profile_${userId}`, JSON.stringify(user));
    }
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
  }
};
