// Firebase configuration manager and service provider
// Dynamically switches between the Mock LocalStorage DB and the Live Firebase backend

import mockDb from './mock-db.js';

let activeProvider = mockDb;
let activeProviderType = 'mock'; // 'mock' | 'firebase' | 'supabase'
let firebaseInstance = null;
let currentProviderName = 'Mock Database';
let providerChangeListeners = [];

function checkIsAdmin(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim().replace(/\+[^@]*@/, '@');
  return normalized === 'admin@gmail.com' || normalized === 'admin@ecocircle.com' || normalized === 'ashrithap2200.sse@saveetha.com';
}

// Multiplexer tracking for dynamic activeProvider auth listeners
let authCallbacks = [];
let activeAuthUnsubscribe = null;

function syncAuthProviderSubscription() {
  if (activeAuthUnsubscribe) {
    activeAuthUnsubscribe();
    activeAuthUnsubscribe = null;
  }
  
  activeAuthUnsubscribe = activeProvider.onAuthStateChanged((user) => {
    authCallbacks.forEach(callback => {
      try { callback(user); } catch (e) { console.error(e); }
    });
  });
}

// API Wrappers that transparently route calls to the active database provider
export const authService = {
  getCurrentUser: () => activeProvider.getCurrentUser(),
  onAuthStateChanged: (callback) => {
    authCallbacks.push(callback);
    // Execute immediately with current state of active provider
    callback(activeProvider.getCurrentUser());
    
    // Return unsubscribe function
    return () => {
      authCallbacks = authCallbacks.filter(c => c !== callback);
    };
  },
  login: (email, password) => activeProvider.login(email, password),
  register: (email, password, displayName, location) => activeProvider.register(email, password, displayName, location),
  logout: () => activeProvider.logout(),
  sendOtp: (email, metadata = {}) => {
    if (activeProvider.sendOtp) {
      return activeProvider.sendOtp(email, metadata);
    }
    throw new Error('OTP logins are not supported by the active database provider.');
  },
  verifyOtp: (email, token) => {
    if (activeProvider.verifyOtp) {
      return activeProvider.verifyOtp(email, token);
    }
    throw new Error('OTP logins are not supported by the active database provider.');
  },
  verifySignupOtp: (email, token, displayName, location) => {
    if (activeProvider.verifySignupOtp) {
      return activeProvider.verifySignupOtp(email, token, displayName, location);
    }
    throw new Error('Email OTP verification is not supported by the active database provider.');
  }
};

export const dbService = {
  onResourcesChanged: (callback) => activeProvider.onResourcesChanged(callback),
  addResource: (resourceData) => activeProvider.addResource(resourceData),
  updateResource: (resourceId, resourceData) => activeProvider.updateResource(resourceId, resourceData),
  deleteResource: (resourceId) => activeProvider.deleteResource(resourceId),
  saveResource: (userId, resourceId) => activeProvider.saveResource(userId, resourceId),
  unsaveResource: (userId, resourceId) => activeProvider.unsaveResource(userId, resourceId),
  getSavedResources: (userId) => activeProvider.getSavedResources(userId),
  getOrCreateChat: (participantId, resourceId, resourceTitle, participantName) => activeProvider.getOrCreateChat(participantId, resourceId, resourceTitle, participantName),
  onChatsChanged: (userId, callback) => activeProvider.onChatsChanged(userId, callback),
  onMessagesChanged: (chatId, callback) => activeProvider.onMessagesChanged(chatId, callback),
  sendMessage: (chatId, messageText) => activeProvider.sendMessage(chatId, messageText),
  getAllUsers: () => activeProvider.getAllUsers(),
  updateUserApproval: (userId, approved, status) => activeProvider.updateUserApproval(userId, approved, status)
};

export const storageService = {
  uploadImage: (file, progressCallback) => activeProvider.uploadImage(file, progressCallback)
};

// Config state helpers
export function getActiveProviderName() {
  return currentProviderName;
}

export function getActiveProviderType() {
  return activeProviderType;
}

export function onProviderChanged(callback) {
  providerChangeListeners.push(callback);
  return () => {
    providerChangeListeners = providerChangeListeners.filter(l => l !== callback);
  };
}

function notifyProviderChanged() {
  providerChangeListeners.forEach(callback => {
    try { callback(currentProviderName, activeProviderType); } catch (e) { console.error(e); }
  });
}

// Firebase SDK Dynamic Initializer
export async function tryInitializeFirebase(config) {
  if (!config || !config.apiKey || !config.projectId) {
    switchToMockMode();
    return false;
  }

  try {
    // Dynamic import of Firebase modules from GStatic CDN
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { 
      getAuth, 
      signInWithEmailAndPassword, 
      createUserWithEmailAndPassword, 
      signOut, 
      onAuthStateChanged,
      updateProfile
    } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    
    const { 
      getFirestore, 
      collection, 
      doc, 
      addDoc, 
      setDoc,
      getDoc,
      getDocs,
      updateDoc, 
      deleteDoc, 
      onSnapshot, 
      query, 
      where,
      orderBy,
      arrayUnion,
      arrayRemove
    } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
    
    const { 
      getStorage, 
      ref, 
      uploadBytesResumable, 
      getDownloadURL 
    } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js');

    // Initialize Firebase
    firebaseInstance = initializeApp(config);
    const auth = getAuth(firebaseInstance);
    const db = getFirestore(firebaseInstance);
    const storage = getStorage(firebaseInstance);

    // Create Firebase Service Provider
    const firebaseProvider = {
      // Auth implementation
      getCurrentUser: () => {
        const user = auth.currentUser;
        if (!user) return null;
        // In real Firebase we check cached user profile details from localStorage/state
        const cachedDetails = localStorage.getItem(`EcoCircle_profile_${user.uid}`);
        const details = cachedDetails ? JSON.parse(cachedDetails) : { location: 'Community Center', savedResources: [] };
        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'EcoCircle Member',
          location: details.location,
          role: details.role || 'resident',
          approved: details.approved !== undefined ? details.approved : (details.role === 'admin'),
          status: details.status || 'pending',
          savedResources: details.savedResources || [],
          activeSessionId: details.activeSessionId || null
        };
      },

      onAuthStateChanged: (callback) => {
        let userDocUnsubscribe = null;
        const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
          if (userDocUnsubscribe) {
            userDocUnsubscribe();
            userDocUnsubscribe = null;
          }

          if (!user) {
            callback(null);
            return;
          }

          const docRef = doc(db, 'users', user.uid);
          
          userDocUnsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              const profile = docSnap.data();
              // Cache profile details locally for synchronous retrieval if needed
              localStorage.setItem(`EcoCircle_profile_${user.uid}`, JSON.stringify(profile));

              callback({
                uid: user.uid,
                email: user.email,
                displayName: profile.displayName || user.displayName || 'EcoCircle Member',
                location: profile.location,
                role: profile.role || 'resident',
                approved: profile.approved !== undefined ? profile.approved : (profile.role === 'admin'),
                status: profile.status || 'pending',
                savedResources: profile.savedResources || [],
                activeSessionId: profile.activeSessionId || null
              });
            } else {
              // Create user doc if it doesn't exist
              const isAdmin = checkIsAdmin(user.email);
              const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
              const profile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'EcoCircle Member',
                location: 'Community Center',
                role: isAdmin ? 'admin' : 'resident',
                approved: isAdmin ? true : false,
                status: isAdmin ? 'approved' : 'pending',
                savedResources: [],
                activeSessionId,
                createdAt: new Date().toISOString()
              };
              setDoc(docRef, profile).catch(e => console.error('Error creating user doc:', e));
            }
          }, (error) => {
            console.error('User doc snapshot listener error:', error);
          });
        });

        return () => {
          if (userDocUnsubscribe) {
            userDocUnsubscribe();
          }
          authUnsubscribe();
        };
      },

      login: async (email, password) => {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        
        // Fetch profile
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        let profile;
        if (docSnap.exists()) {
          profile = docSnap.data();
          profile.activeSessionId = activeSessionId; // update session
          if (profile.role === undefined) {
            const isAdmin = checkIsAdmin(user.email);
            profile.role = isAdmin ? 'admin' : 'resident';
            profile.approved = isAdmin ? true : false;
            profile.status = isAdmin ? 'approved' : 'pending';
          }
          await setDoc(docRef, profile, { merge: true });
        } else {
          const isAdmin = checkIsAdmin(user.email);
          profile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'EcoCircle Member',
            location: 'Community Center',
            role: isAdmin ? 'admin' : 'resident',
            approved: isAdmin ? true : false,
            status: isAdmin ? 'approved' : 'pending',
            savedResources: [],
            activeSessionId,
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, profile);
        }
        
        localStorage.setItem(`EcoCircle_profile_${user.uid}`, JSON.stringify(profile));
        
        return {
          uid: user.uid,
          email: user.email,
          displayName: profile.displayName || user.displayName || 'EcoCircle Member',
          location: profile.location,
          role: profile.role,
          approved: profile.approved,
          status: profile.status,
          savedResources: profile.savedResources || [],
          activeSessionId: profile.activeSessionId
        };
      },

      register: async (email, password, displayName, location) => {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        
        try {
          await updateProfile(user, { displayName });
        } catch (e) {
          console.warn('Failed to update auth profile display name:', e);
        }

        const isAdmin = checkIsAdmin(email);
        const profile = {
          uid: user.uid,
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
        
        // Save detailed profile to Firestore
        await setDoc(doc(db, 'users', user.uid), profile);
        localStorage.setItem(`EcoCircle_profile_${user.uid}`, JSON.stringify(profile));
        
        return profile;
      },

      logout: () => signOut(auth),

      // Firestore implementation
      onResourcesChanged: (callback) => {
        const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
          const resources = [];
          snapshot.forEach((doc) => {
            resources.push({
              resourceId: doc.id,
              ...doc.data()
            });
          });
          callback(resources);
        }, (error) => {
          console.error("Firestore onSnapshot error:", error);
        });
      },

      addResource: async (resourceData) => {
        const user = auth.currentUser;
        const profileString = user ? localStorage.getItem(`EcoCircle_profile_${user.uid}`) : null;
        const profile = profileString ? JSON.parse(profileString) : null;
        
        const lat = resourceData.latitude !== undefined && resourceData.latitude !== null ? Number(resourceData.latitude) : 45.5152 + (Math.random() - 0.5) * 0.03;
        const lng = resourceData.longitude !== undefined && resourceData.longitude !== null ? Number(resourceData.longitude) : -122.6784 + (Math.random() - 0.5) * 0.03;

        const docData = {
          ownerId: user ? user.uid : 'anonymous',
          ownerName: profile ? profile.displayName : 'Anonymous Resident',
          title: resourceData.title,
          description: resourceData.description,
          category: resourceData.category,
          quantity: resourceData.quantity || '1',
          imageUrl: resourceData.imageUrl || '',
          location: resourceData.location || (profile ? profile.location : 'Community Center'),
          latitude: lat,
          longitude: lng,
          createdAt: new Date().toISOString(),
          status: 'Available'
        };

        const docRef = await addDoc(collection(db, 'resources'), docData);
        return {
          resourceId: docRef.id,
          ...docData
        };
      },

      updateResource: async (resourceId, resourceData) => {
        const docRef = doc(db, 'resources', resourceId);
        
        const updatedData = { ...resourceData };
        if (updatedData.latitude !== undefined && updatedData.latitude !== null) {
          updatedData.latitude = Number(updatedData.latitude);
        }
        if (updatedData.longitude !== undefined && updatedData.longitude !== null) {
          updatedData.longitude = Number(updatedData.longitude);
        }

        await updateDoc(docRef, updatedData);
        return {
          resourceId,
          ...updatedData
        };
      },

      deleteResource: async (resourceId) => {
        const docRef = doc(db, 'resources', resourceId);
        await deleteDoc(docRef);
      },

      // Bookmarks
      saveResource: async (userId, resourceId) => {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          savedResources: arrayUnion(resourceId)
        });
        
        // Sync cache
        const cached = localStorage.getItem(`EcoCircle_profile_${userId}`);
        if (cached) {
          const profile = JSON.parse(cached);
          if (!profile.savedResources.includes(resourceId)) {
            profile.savedResources.push(resourceId);
            localStorage.setItem(`EcoCircle_profile_${userId}`, JSON.stringify(profile));
          }
        }
      },

      unsaveResource: async (userId, resourceId) => {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          savedResources: arrayRemove(resourceId)
        });
        
        // Sync cache
        const cached = localStorage.getItem(`EcoCircle_profile_${userId}`);
        if (cached) {
          const profile = JSON.parse(cached);
          profile.savedResources = profile.savedResources.filter(id => id !== resourceId);
          localStorage.setItem(`EcoCircle_profile_${userId}`, JSON.stringify(profile));
        }
      },

      getSavedResources: async (userId) => {
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (docSnap.exists()) {
          return docSnap.data().savedResources || [];
        }
        return [];
      },

      getOrCreateChat: async (participantId, resourceId, resourceTitle, participantName) => {
        const user = auth.currentUser;
        if (!user) return null;

        const q = query(
          collection(db, 'chats'), 
          where('resourceId', '==', resourceId), 
          where('participants', 'array-contains', user.uid)
        );
        
        const snapshot = await getDocs(q);
        let chatDoc = null;
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.participants.includes(participantId)) {
            chatDoc = { chatId: docSnap.id, ...data };
          }
        });

        if (chatDoc) return chatDoc;

        // Otherwise create
        const profileString = localStorage.getItem(`EcoCircle_profile_${user.uid}`);
        const profile = profileString ? JSON.parse(profileString) : { displayName: 'EcoCircle Member' };

        const newChat = {
          participants: [user.uid, participantId],
          participantNames: {
            [user.uid]: profile.displayName || 'EcoCircle Member',
            [participantId]: participantName || 'Resource Owner'
          },
          resourceId,
          resourceTitle,
          lastMessage: 'Conversation started',
          lastMessageAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'chats'), newChat);
        return { chatId: docRef.id, ...newChat };
      },

      onChatsChanged: (userId, callback) => {
        let lobbyData = {
          chatId: 'general_lobby',
          resourceId: 'general',
          resourceTitle: 'Community Lobby',
          lastMessage: 'Welcome to the Community Lobby!',
          lastMessageAt: new Date(0).toISOString(),
          isLobby: true
        };

        const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', userId));
        
        let unsubPrivate = null;
        let unsubLobby = null;
        let privateChats = [];
        
        const triggerCallback = () => {
          const combined = [lobbyData, ...privateChats];
          callback(combined);
        };

        // Create doc if it does not exist
        const docRef = doc(db, 'chats', 'general_lobby');
        getDoc(docRef).then(docSnap => {
          if (!docSnap.exists()) {
            setDoc(docRef, {
              resourceId: 'general',
              resourceTitle: 'Community Lobby',
              lastMessage: 'Welcome to the Community Lobby!',
              lastMessageAt: new Date(0).toISOString()
            }).catch(err => console.error("Error creating general_lobby doc:", err));
          }
        }).catch(err => console.error("Error checking general_lobby doc:", err));

        unsubLobby = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            lobbyData = {
              chatId: 'general_lobby',
              ...docSnap.data(),
              isLobby: true
            };
            triggerCallback();
          }
        });

        unsubPrivate = onSnapshot(chatsQuery, (snapshot) => {
          privateChats = [];
          snapshot.forEach(docSnap => {
            if (docSnap.id !== 'general_lobby') {
              privateChats.push({ chatId: docSnap.id, ...docSnap.data() });
            }
          });
          privateChats.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
          triggerCallback();
        });

        return () => {
          if (unsubPrivate) unsubPrivate();
          if (unsubLobby) unsubLobby();
        };
      },

      onMessagesChanged: (chatId, callback) => {
        const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
        return onSnapshot(q, (snapshot) => {
          const messages = [];
          snapshot.forEach(docSnap => {
            messages.push({ messageId: docSnap.id, ...docSnap.data() });
          });
          callback(messages);
        });
      },

      sendMessage: async (chatId, messageText) => {
        const user = auth.currentUser;
        if (!user) return;

        const profileString = localStorage.getItem(`EcoCircle_profile_${user.uid}`);
        const profile = profileString ? JSON.parse(profileString) : { displayName: 'EcoCircle Member' };

        const message = {
          senderId: user.uid,
          senderName: profile.displayName || 'EcoCircle Member',
          content: messageText,
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'chats', chatId, 'messages'), message);
        await setDoc(doc(db, 'chats', chatId), {
          lastMessage: messageText,
          lastMessageAt: message.createdAt,
          lastMessageSenderId: user.uid,
          lastMessageSenderName: profile.displayName || 'EcoCircle Member'
        }, { merge: true });
      },

      getAllUsers: async () => {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const users = [];
        querySnapshot.forEach((doc) => {
          users.push({
            uid: doc.id,
            ...doc.data()
          });
        });
        return users;
      },

      updateUserApproval: async (userId, approved, status) => {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { approved, status });
        
        // Also update local cache if it is the current user
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.uid === userId) {
          const cached = localStorage.getItem(`EcoCircle_profile_${userId}`);
          if (cached) {
            const profile = JSON.parse(cached);
            profile.approved = approved;
            profile.status = status;
            localStorage.setItem(`EcoCircle_profile_${userId}`, JSON.stringify(profile));
          }
        }
      },

      // Storage implementation
      uploadImage: (file, progressCallback) => {
        return new Promise((resolve, reject) => {
          let completed = false;
          const storageRef = ref(storage, 'resources/' + Date.now() + '_' + file.name);
          const uploadTask = uploadBytesResumable(storageRef, file);

          const fallbackToBase64 = () => {
            if (completed) return;
            completed = true;
            try {
              uploadTask.cancel();
            } catch (e) {
              console.warn('Failed to cancel upload task:', e);
            }
            console.log('Firebase Storage upload timed out or failed. Falling back to Base64 local URL.');
            if (progressCallback) progressCallback(100);
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result);
            };
            reader.onerror = (readErr) => {
              reject(new Error('Failed to read file for base64 fallback: ' + readErr.message));
            };
            reader.readAsDataURL(file);
          };

          // Set a timeout of 3 seconds for Firebase Storage upload to respond/succeed.
          // If it takes longer (due to CORS preflight blocks or rules), fallback immediately.
          const timeoutId = setTimeout(() => {
            console.warn('Firebase Storage upload timed out after 3 seconds. Triggering Base64 fallback.');
            fallbackToBase64();
          }, 3000);

          uploadTask.on('state_changed', 
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              if (progressCallback) progressCallback(progress);
            }, 
            async (error) => {
              clearTimeout(timeoutId);
              if (completed) return;
              console.warn('Firebase Storage upload failed. Falling back to Base64 local URL:', error);
              fallbackToBase64();
            }, 
            async () => {
              clearTimeout(timeoutId);
              if (completed) return;
              completed = true;
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
              } catch (urlErr) {
                console.warn('Failed to get Firebase download URL. Falling back to Base64 local URL:', urlErr);
                const reader = new FileReader();
                reader.onloadend = () => {
                  resolve(reader.result);
                };
                reader.readAsDataURL(file);
              }
            }
          );
        });
      }
    };

    activeProvider = firebaseProvider;
    activeProviderType = 'firebase';
    currentProviderName = 'Live Firebase';
    
    // Cache configuration successfully
    localStorage.setItem('EcoCircle_firebase_config', JSON.stringify(config));
    localStorage.setItem('EcoCircle_active_provider_type', 'firebase');
    
    syncAuthProviderSubscription();
    notifyProviderChanged();
    console.log("Firebase initialized successfully.");
    return true;
  } catch (err) {
    console.error("Firebase Initialization Failed. Falling back to Mock DB.", err);
    switchToMockMode();
    throw err;
  }
}

// Supabase SDK Dynamic Initializer
export async function tryInitializeSupabase(url, anonKey) {
  if (!url || !anonKey) {
    switchToMockMode();
    return false;
  }

  try {
    const { initializeSupabaseInstance, SupabaseProvider } = await import('./supabase-service.js');
    initializeSupabaseInstance(url, anonKey);

    activeProvider = SupabaseProvider;
    activeProviderType = 'supabase';
    currentProviderName = 'Live Supabase';

    // Cache configurations
    localStorage.setItem('EcoCircle_supabase_config', JSON.stringify({ supabaseUrl: url, supabaseAnonKey: anonKey }));
    localStorage.setItem('EcoCircle_active_provider_type', 'supabase');

    syncAuthProviderSubscription();
    notifyProviderChanged();
    console.log("Supabase initialized successfully.");
    return true;
  } catch (err) {
    console.error("Supabase Initialization Failed. Falling back to Mock DB.", err);
    switchToMockMode();
    throw err;
  }
}

function switchToMockMode() {
  activeProvider = mockDb;
  activeProviderType = 'mock';
  currentProviderName = 'Mock Database';
  localStorage.setItem('EcoCircle_active_provider_type', 'mock');
  syncAuthProviderSubscription();
  notifyProviderChanged();
}

export function removeCloudConfig() {
  localStorage.removeItem('EcoCircle_firebase_config');
  localStorage.removeItem('EcoCircle_supabase_config');
  switchToMockMode();
}

// Kept for backwards compatibility
export function removeFirebaseConfig() {
  removeCloudConfig();
}

export async function autoInitializeConfig() {
  let activeType = localStorage.getItem('EcoCircle_active_provider_type');
  if (!activeType || activeType === 'mock') {
    activeType = 'supabase';
    localStorage.setItem('EcoCircle_active_provider_type', 'supabase');
  }

  if (activeType === 'firebase') {
    try {
      const response = await fetch('/firebase-config.json');
      if (response.ok) {
        const config = await response.json();
        if (config && config.apiKey && config.projectId) {
          console.log("Found firebase-config.json, attempting connection...");
          const success = await tryInitializeFirebase(config);
          if (success) return true;
        }
      }
    } catch (err) {
      console.log("No firebase-config.json found or failed to fetch. Checking LocalStorage...");
    }

    const savedConfig = localStorage.getItem('EcoCircle_firebase_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        const success = await tryInitializeFirebase(parsed);
        return success;
      } catch (e) {
        console.error("Error loading cached LocalStorage config:", e);
      }
    }
  } else if (activeType === 'supabase') {
    const savedConfig = localStorage.getItem('EcoCircle_supabase_config');
    // Read from window.__ENV__ (generated from .env at build time)
    const envUrl = (window.__ENV__ && window.__ENV__.SUPABASE_URL) || '';
    const envKey = (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) || '';
    let supabaseUrl = envUrl;
    let supabaseAnonKey = envKey;
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        supabaseUrl = parsed.supabaseUrl || supabaseUrl;
        supabaseAnonKey = parsed.supabaseAnonKey || supabaseAnonKey;
      } catch (e) {
        console.error("Error loading cached Supabase config:", e);
      }
    } else {
      localStorage.setItem('EcoCircle_supabase_config', JSON.stringify({ supabaseUrl, supabaseAnonKey }));
    }
    const success = await tryInitializeSupabase(supabaseUrl, supabaseAnonKey);
    return success;
  }
  
  switchToMockMode();
  return false;
}

// Initial sync
syncAuthProviderSubscription();

// Auto-initialize on import
autoInitializeConfig().catch(err => {
  console.warn("Auto-initialization completed with fallback mock mode.", err);
});

