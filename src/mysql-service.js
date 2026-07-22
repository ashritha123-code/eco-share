// MySQL client-side adapter for local XAMPP database
// Uses standard fetch() API to communicate with Express server API endpoints

let currentUserProfile = null;
let authListeners = [];
let activeSessionCheckInterval = null;

function checkIsAdmin(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim().replace(/\+[^@]*@/, '@');
  return normalized === 'admin@gmail.com' || normalized === 'admin@ecocircle.com' || normalized === 'ashrithap2200.sse@saveetha.com';
}

function notifyAuthListeners(profile) {
  currentUserProfile = profile;
  authListeners.forEach(callback => {
    try { callback(profile); } catch (e) { console.error(e); }
  });
}

function getBaseUrl() {
  const isWebView = window.location.origin === 'https://localhost' || window.location.protocol === 'file:' || (window.Capacitor && window.Capacitor.platform !== 'web');
  if (isWebView) {
    const customUrl = localStorage.getItem('EcoCircle_mysql_server_url');
    return customUrl || 'http://10.0.2.2:3000';
  }
  return '';
}

export const MysqlProvider = {
  // --- Auth API ---

  getCurrentUser: () => {
    if (currentUserProfile) return currentUserProfile;
    // Fallback to localStorage
    const saved = localStorage.getItem('EcoCircle_session');
    if (saved) {
      try {
        currentUserProfile = JSON.parse(saved);
        return currentUserProfile;
      } catch (_) {}
    }
    return null;
  },

  onAuthStateChanged: (callback) => {
    authListeners.push(callback);
    // Trigger immediately with current state
    const current = MysqlProvider.getCurrentUser();
    callback(current);

    // Setup active session lock polling (checks if another session logged in or role was updated)
    if (!activeSessionCheckInterval && current) {
      activeSessionCheckInterval = setInterval(async () => {
        const user = MysqlProvider.getCurrentUser();
        if (!user) return;
        try {
          const response = await fetch(`${getBaseUrl()}/api/auth/me?uid=${user.uid}`);
          if (response.ok) {
            const profile = await response.json();
            // 1. Single session lock check
            if (profile.activeSessionId && user.activeSessionId && profile.activeSessionId !== user.activeSessionId) {
              console.warn('[MySQL Auth] Single session lock triggered: Another session is active.');
              clearInterval(activeSessionCheckInterval);
              activeSessionCheckInterval = null;
              MysqlProvider.logout();
              if (window.showToastNotification) {
                window.showToastNotification('You have been signed out because another session was started.', 'error');
              }
              return;
            }

            // 2. Check for updates to role or approval status
            if (profile.role !== user.role || profile.approved !== user.approved || profile.status !== user.status) {
              localStorage.setItem('EcoCircle_session', JSON.stringify(profile));
              notifyAuthListeners(profile);
            }
          }
        } catch (e) {
          console.warn('[MySQL Auth] Failed to verify user profile in background.', e);
        }
      }, 5000);
    }

    return () => {
      authListeners = authListeners.filter(l => l !== callback);
      if (authListeners.length === 0 && activeSessionCheckInterval) {
        clearInterval(activeSessionCheckInterval);
        activeSessionCheckInterval = null;
      }
    };
  },

  login: async (email, password) => {
    const response = await fetch(`${getBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Login failed.');
    }

    const profile = await response.json();
    localStorage.setItem('EcoCircle_session', JSON.stringify(profile));
    notifyAuthListeners(profile);
    return profile;
  },

  register: async (email, password, displayName, location) => {
    const response = await fetch(`${getBaseUrl()}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, location })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Registration failed.');
    }

    const profile = await response.json();
    // If not approved yet (non-admin), they'll see the pending screen
    localStorage.setItem('EcoCircle_session', JSON.stringify(profile));
    notifyAuthListeners(profile);
    return profile;
  },

  logout: async () => {
    currentUserProfile = null;
    localStorage.removeItem('EcoCircle_session');
    notifyAuthListeners(null);
    if (activeSessionCheckInterval) {
      clearInterval(activeSessionCheckInterval);
      activeSessionCheckInterval = null;
    }
  },

  // --- Resources API ---

  onResourcesChanged: (callback) => {
    let lastHash = '';
    
    const fetchResources = async () => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/resources`);
        if (response.ok) {
          const resources = await response.json();
          // Generate a simple string hash to verify if elements changed before triggering callbacks
          const currentHash = JSON.stringify(resources.map(r => r.resourceId + r.status + r.title + r.quantity));
          if (currentHash !== lastHash) {
            lastHash = currentHash;
            callback(resources);
          }
        }
      } catch (err) {
        console.error('[MySQL DB] Error polling resources:', err);
      }
    };

    // Execute immediately
    fetchResources();

    // Setup Polling every 3 seconds
    const intervalId = setInterval(fetchResources, 3000);

    return () => {
      clearInterval(intervalId);
    };
  },

  addResource: async (resourceData) => {
    const user = MysqlProvider.getCurrentUser();
    if (!user) throw new Error('You must be signed in to add a resource.');

    const lat = resourceData.latitude !== undefined && resourceData.latitude !== null ? Number(resourceData.latitude) : 45.5152 + (Math.random() - 0.5) * 0.03;
    const lng = resourceData.longitude !== undefined && resourceData.longitude !== null ? Number(resourceData.longitude) : -122.6784 + (Math.random() - 0.5) * 0.03;

    const payload = {
      ownerId: user.uid,
      ownerName: user.displayName,
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

    const response = await fetch(`${getBaseUrl()}/api/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add resource.');
    }

    return await response.json();
  },

  updateResource: async (resourceId, resourceData) => {
    const response = await fetch(`${getBaseUrl()}/api/resources/${resourceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resourceData)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update resource.');
    }

    return await response.json();
  },

  deleteResource: async (resourceId) => {
    const response = await fetch(`${getBaseUrl()}/api/resources/${resourceId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete resource.');
    }

    return await response.json();
  },

  // --- Bookmarking (Saved Items) ---

  saveResource: async (userId, resourceId) => {
    const response = await fetch(`${getBaseUrl()}/api/resources/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, resourceId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save resource.');
    }

    const savedResources = await response.json();
    const user = MysqlProvider.getCurrentUser();
    if (user && user.uid === userId) {
      user.savedResources = savedResources;
      localStorage.setItem('EcoCircle_session', JSON.stringify(user));
      notifyAuthListeners(user);
    }
  },

  unsaveResource: async (userId, resourceId) => {
    const response = await fetch(`${getBaseUrl()}/api/resources/unsave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, resourceId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to unsave resource.');
    }

    const savedResources = await response.json();
    const user = MysqlProvider.getCurrentUser();
    if (user && user.uid === userId) {
      user.savedResources = savedResources;
      localStorage.setItem('EcoCircle_session', JSON.stringify(user));
      notifyAuthListeners(user);
    }
  },

  getSavedResources: async (userId) => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/auth/me?uid=${userId}`);
      if (response.ok) {
        const profile = await response.json();
        return profile.savedResources || [];
      }
    } catch (e) {
      console.warn('[MySQL DB] Error fetching saved resources list:', e);
    }
    return [];
  },

  // --- Real-time Chats & Messages ---

  getOrCreateChat: async (participantId, resourceId, resourceTitle, participantName) => {
    const user = MysqlProvider.getCurrentUser();
    if (!user) return null;

    const response = await fetch(`${getBaseUrl()}/api/chats/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uid,
        displayName: user.displayName,
        participantId,
        resourceId,
        resourceTitle,
        participantName
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to initialize chat.');
    }

    return await response.json();
  },

  onChatsChanged: (userId, callback) => {
    let lastHash = '';

    const fetchChats = async () => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/chats?userId=${userId}`);
        if (response.ok) {
          const chats = await response.json();
          // Sort Chats
          chats.sort((a, b) => {
            if (a.chatId === 'general_lobby' || a.isLobby) return -1;
            if (b.chatId === 'general_lobby' || b.isLobby) return 1;
            return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
          });

          const currentHash = JSON.stringify(chats.map(c => c.chatId + c.lastMessage + c.lastMessageAt));
          if (currentHash !== lastHash) {
            lastHash = currentHash;
            callback(chats);
          }
        }
      } catch (err) {
        console.error('[MySQL DB] Error polling chats:', err);
      }
    };

    fetchChats();
    const intervalId = setInterval(fetchChats, 3000);

    return () => {
      clearInterval(intervalId);
    };
  },

  onMessagesChanged: (chatId, callback) => {
    let lastHash = '';

    const fetchMessages = async () => {
      try {
        const response = await fetch(`${getBaseUrl()}/api/messages/${chatId}`);
        if (response.ok) {
          const messages = await response.json();
          const currentHash = JSON.stringify(messages.map(m => m.messageId + m.createdAt));
          if (currentHash !== lastHash) {
            lastHash = currentHash;
            callback(messages);
          }
        }
      } catch (err) {
        console.error('[MySQL DB] Error polling messages:', err);
      }
    };

    fetchMessages();
    const intervalId = setInterval(fetchMessages, 3000);

    return () => {
      clearInterval(intervalId);
    };
  },

  sendMessage: async (chatId, messageText) => {
    const user = MysqlProvider.getCurrentUser();
    if (!user) throw new Error('You must be signed in to send a message.');

    const response = await fetch(`${getBaseUrl()}/api/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        senderId: user.uid,
        senderName: user.displayName,
        content: messageText
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to send message.');
    }

    return await response.json();
  },

  // --- Admin Panel API ---

  getAllUsers: async () => {
    const response = await fetch(`${getBaseUrl()}/api/users`);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to retrieve all users.');
    }
    return await response.json();
  },

  updateUserApproval: async (userId, approved, status) => {
    const response = await fetch(`${getBaseUrl()}/api/users/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, approved, status })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update user approval.');
    }

    // If it's the current user, update their cached session profile immediately
    const user = MysqlProvider.getCurrentUser();
    if (user && user.uid === userId) {
      user.approved = approved;
      user.status = status;
      localStorage.setItem('EcoCircle_session', JSON.stringify(user));
      notifyAuthListeners(user);
    }
  },

  // --- File Storage API ---

  uploadImage: async (file, progressCallback) => {
    if (progressCallback) progressCallback(30);

    const formData = new FormData();
    formData.append('image', file);

    const xhr = new XMLHttpRequest();
    return new Promise((resolve, reject) => {
      xhr.open('POST', `${getBaseUrl()}/api/upload`, true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && progressCallback) {
          const progress = Math.round((event.loaded / event.total) * 100);
          progressCallback(progress);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (progressCallback) progressCallback(100);
            resolve(data.imageUrl);
          } catch (e) {
            reject(new Error('Failed to parse upload response.'));
          }
        } else {
          reject(new Error(`Image upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Image upload connection error.'));
      };

      xhr.send(formData);
    });
  }
};
