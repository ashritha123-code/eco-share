import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let supabaseClient = null;
let authStateUnsubscribe = null;
let authListeners = [];

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

    // Check users table for profile
    try {
      let { data: profile, error } = await supabaseClient
        .from('users')
        .select('*')
        .eq('uid', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // User doc doesn't exist, create it
        const isAdmin = (user.email || '').toLowerCase() === 'admin@gmail.com' || (user.email || '').toLowerCase() === 'admin@ecoshare.com';
        const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        
        const newProfile = {
          uid: user.id,
          email: user.email,
          displayName: user.user_metadata?.displayName || user.user_metadata?.full_name || 'EcoShare Member',
          location: user.user_metadata?.location || 'Community Center',
          role: isAdmin ? 'admin' : 'resident',
          approved: isAdmin ? true : false,
          status: isAdmin ? 'approved' : 'pending',
          savedResources: [],
          activeSessionId,
          createdAt: new Date().toISOString()
        };

        const { error: insertErr } = await supabaseClient
          .from('users')
          .insert([newProfile]);
        
        if (!insertErr) {
          profile = newProfile;
        }
      }

      if (profile) {
        localStorage.setItem(`ecoshare_profile_${user.id}`, JSON.stringify(profile));
        notifyAuthListeners({
          uid: user.id,
          email: user.email,
          displayName: profile.displayName,
          location: profile.location,
          role: profile.role,
          approved: profile.approved,
          status: profile.status,
          savedResources: profile.savedResources || [],
          activeSessionId: profile.activeSessionId
        });
      }
    } catch (err) {
      console.error('Error syncing auth state with users table:', err);
    }
  });

  authStateUnsubscribe = subscription;
}

function notifyAuthListeners(profile) {
  authListeners.forEach(callback => {
    try { callback(profile); } catch (e) { console.error(e); }
  });
}

export const SupabaseProvider = {
  // --- Auth API ---

  getCurrentUser: () => {
    if (!supabaseClient) return null;
    // Get currently active session synchronously
    const session = supabaseClient.auth.session ? supabaseClient.auth.session() : null; 
    const user = session?.user || supabaseClient.auth.user?.();
    if (!user) return null;

    const cached = localStorage.getItem(`ecoshare_profile_${user.id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    return {
      uid: user.id,
      email: user.email,
      displayName: user.user_metadata?.displayName || 'EcoShare Member',
      location: 'Community Center',
      role: 'resident',
      approved: false,
      status: 'pending',
      savedResources: []
    };
  },

  onAuthStateChanged: (callback) => {
    authListeners.push(callback);
    // Trigger immediately with current user
    if (supabaseClient) {
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        const user = session?.user;
        if (user) {
          const cached = localStorage.getItem(`ecoshare_profile_${user.id}`);
          if (cached) {
            callback(JSON.parse(cached));
          } else {
            callback({
              uid: user.id,
              email: user.email,
              displayName: user.user_metadata?.displayName || 'EcoShare Member',
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
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    
    const user = data.user;
    const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();

    // Update users table
    const { data: profile, error: profileError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('uid', user.id)
      .single();

    let finalProfile;
    if (profileError && profileError.code === 'PGRST116') {
      const isAdmin = email.toLowerCase() === 'admin@gmail.com' || email.toLowerCase() === 'admin@ecoshare.com';
      finalProfile = {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.displayName || 'EcoShare Member',
        location: 'Community Center',
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

    localStorage.setItem(`ecoshare_profile_${user.id}`, JSON.stringify(finalProfile));
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

    // If confirmation is required, session is null
    if (!data.session) {
      throw new Error("Email verification is enabled in Supabase. Please toggle OFF 'Confirm email' under Authentication -> Providers -> Email in your Supabase Dashboard to register without OTP.");
    }

    const isAdmin = email.toLowerCase() === 'admin@gmail.com' || email.toLowerCase() === 'admin@ecoshare.com';
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
      activeSessionId,
      createdAt: new Date().toISOString()
    };

    const { error: insertErr } = await supabaseClient.from('users').insert([profile]);
    if (insertErr) console.error("Error inserting user into DB table:", insertErr);

    localStorage.setItem(`ecoshare_profile_${user.id}`, JSON.stringify(profile));
    return profile;
  },

  logout: async () => {
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

  addResource: async (resourceData) => {
    const user = SupabaseProvider.getCurrentUser();
    const lat = resourceData.latitude !== undefined && resourceData.latitude !== null ? Number(resourceData.latitude) : 45.5152 + (Math.random() - 0.5) * 0.03;
    const lng = resourceData.longitude !== undefined && resourceData.longitude !== null ? Number(resourceData.longitude) : -122.6784 + (Math.random() - 0.5) * 0.03;

    const newResource = {
      ownerId: user ? user.uid : 'anonymous',
      ownerName: user ? user.displayName : 'Anonymous Resident',
      title: resourceData.title,
      description: resourceData.description,
      category: resourceData.category,
      quantity: resourceData.quantity || '1',
      imageUrl: resourceData.imageUrl || '',
      location: resourceData.location || (user ? user.location : 'Community Center'),
      latitude: lat,
      longitude: lng,
      createdAt: new Date().toISOString(),
      status: 'Available'
    };

    const { data, error } = await supabaseClient
      .from('resources')
      .insert([newResource])
      .select()
      .single();

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
    const cached = localStorage.getItem(`ecoshare_profile_${userId}`);
    let savedList = [];
    if (cached) {
      const profile = JSON.parse(cached);
      savedList = profile.savedResources || [];
      if (!savedList.includes(resourceId)) {
        savedList.push(resourceId);
        profile.savedResources = savedList;
        localStorage.setItem(`ecoshare_profile_${userId}`, JSON.stringify(profile));
      }
    }

    const { error } = await supabaseClient
      .from('users')
      .update({ savedResources: savedList })
      .eq('uid', userId);

    if (error) throw error;
  },

  unsaveResource: async (userId, resourceId) => {
    const cached = localStorage.getItem(`ecoshare_profile_${userId}`);
    let savedList = [];
    if (cached) {
      const profile = JSON.parse(cached);
      savedList = (profile.savedResources || []).filter(id => id !== resourceId);
      profile.savedResources = savedList;
      localStorage.setItem(`ecoshare_profile_${userId}`, JSON.stringify(profile));
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
    if (!user) return;

    const newMessage = {
      chatId,
      senderId: user.uid,
      senderName: user.displayName,
      content: messageText,
      createdAt: new Date().toISOString()
    };

    const { error: msgErr } = await supabaseClient.from('messages').insert([newMessage]);
    if (msgErr) throw msgErr;

    // Update parent chat metadata
    await supabaseClient
      .from('chats')
      .update({
        lastMessage: messageText,
        lastMessageAt: newMessage.createdAt,
        lastMessageSenderId: user.uid,
        lastMessageSenderName: user.displayName
      })
      .eq('chatId', chatId);
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
      localStorage.setItem(`ecoshare_profile_${userId}`, JSON.stringify(user));
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
      const isAdmin = email.toLowerCase() === 'admin@gmail.com' || email.toLowerCase() === 'admin@ecoshare.com';
      finalProfile = {
        uid: user.id,
        email: user.email,
        displayName: user.user_metadata?.displayName || 'EcoShare Member',
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

    localStorage.setItem(`ecoshare_profile_${user.id}`, JSON.stringify(finalProfile));
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
    const isAdmin = email.toLowerCase() === 'admin@gmail.com' || email.toLowerCase() === 'admin@ecoshare.com';

    const profile = {
      uid: user.id,
      email,
      displayName: displayName || user.user_metadata?.displayName || 'EcoShare Member',
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

    localStorage.setItem(`ecoshare_profile_${user.id}`, JSON.stringify(profile));
    return profile;
  }
};
