// Mock Database emulation layer for Firebase Services using LocalStorage
// Implements the same wrapper API as the official Firebase integration

function checkIsAdmin(email) {
  if (!email) return false;
  const normalized = email.toLowerCase().trim().replace(/\+[^@]*@/, '@');
  return normalized === 'admin@gmail.com' || normalized === 'admin@ecocircle.com' || normalized === 'admin@ecoshare.com' || normalized === 'ashrithap2200.sse@saveetha.com';
}

class MockDatabase {
  constructor() {
    this.authListeners = [];
    this.resourceListeners = [];
    this.chatListeners = [];
    this.messageListeners = [];
    
    // Initialize LocalStorage collections if they don't exist
    if (!localStorage.getItem('EcoCircle_users')) {
      localStorage.setItem('EcoCircle_users', JSON.stringify([]));
    }
    
    // Clear out any old seed data/fake users
    let resources = [];
    try {
      const stored = localStorage.getItem('EcoCircle_resources');
      if (stored) {
        resources = JSON.parse(stored).filter(r => r.resourceId && !r.resourceId.startsWith('seed_'));
      }
    } catch (e) {
      console.error(e);
    }
    localStorage.setItem('EcoCircle_resources', JSON.stringify(resources));

    if (!localStorage.getItem('EcoCircle_chats')) {
      localStorage.setItem('EcoCircle_chats', JSON.stringify([]));
    }

    if (!localStorage.getItem('EcoCircle_messages')) {
      localStorage.setItem('EcoCircle_messages', JSON.stringify([]));
    }
    
    // Listen for storage events (allows real-time synchronization between tabs!)
    window.addEventListener('storage', (e) => {
      if (e.key === 'EcoCircle_resources') {
        this.notifyResourceListeners();
      }
      if (e.key === 'EcoCircle_session' || e.key === 'EcoCircle_users') {
        this.notifyAuthListeners();
      }
      if (e.key === 'EcoCircle_chats') {
        this.notifyChatListeners();
      }
      if (e.key === 'EcoCircle_messages') {
        this.notifyMessageListeners();
      }
    });
  }

  // --- Auth Service Implementation ---
  
  getCurrentUser() {
    const session = localStorage.getItem('EcoCircle_session');
    if (!session) return null;
    const sessionUser = JSON.parse(session);
    // Find the latest user details from EcoCircle_users to get real-time role/approval updates
    const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
    const latestUser = users.find(u => u.uid === sessionUser.uid);
    if (latestUser) {
      return {
        uid: latestUser.uid,
        email: latestUser.email,
        displayName: latestUser.displayName,
        location: latestUser.location,
        role: latestUser.role || 'resident',
        approved: latestUser.approved !== undefined ? latestUser.approved : (latestUser.role === 'admin'),
        status: latestUser.status || 'pending',
        savedResources: latestUser.savedResources || [],
        activeSessionId: latestUser.activeSessionId || null,
        createdAt: latestUser.createdAt
      };
    }
    return {
      ...sessionUser,
      activeSessionId: sessionUser.activeSessionId || null
    };
  }
  
  onAuthStateChanged(callback) {
    this.authListeners.push(callback);
    // Execute immediately with current state
    callback(this.getCurrentUser());
    
    // Return unsubscribe function
    return () => {
      this.authListeners = this.authListeners.filter(l => l !== callback);
    };
  }
  
  notifyAuthListeners() {
    const currentUser = this.getCurrentUser();
    this.authListeners.forEach(callback => {
      try { callback(currentUser); } catch (e) { console.error(e); }
    });
  }
  
  register(email, password, displayName, location) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
        
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
          return reject(new Error('An account with this email already exists.'));
        }
        
        const activeSessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        const isAdmin = checkIsAdmin(email);

        const sessionUser = {
          uid: 'mock_uid_' + Math.random().toString(36).substr(2, 9),
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

        users.push({ ...sessionUser, password });
        localStorage.setItem('EcoCircle_users', JSON.stringify(users));
        localStorage.setItem('EcoCircle_session', JSON.stringify(sessionUser));
        this.notifyAuthListeners();
        resolve(sessionUser);
      }, 500);
    });
  }

  
  login(email, password) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
        const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (userIndex === -1 || users[userIndex].password !== password) {
          return reject(new Error('Invalid email or password.'));
        }
        
        const activeSessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        users[userIndex].activeSessionId = activeSessionId;
        localStorage.setItem('EcoCircle_users', JSON.stringify(users));
        
        const sessionUser = {
          uid: users[userIndex].uid,
          email: users[userIndex].email,
          displayName: users[userIndex].displayName,
          location: users[userIndex].location,
          role: users[userIndex].role || 'resident',
          approved: users[userIndex].approved !== undefined ? users[userIndex].approved : (users[userIndex].role === 'admin'),
          status: users[userIndex].status || 'pending',
          savedResources: users[userIndex].savedResources || [],
          activeSessionId,
          createdAt: users[userIndex].createdAt
        };
        
        localStorage.setItem('EcoCircle_session', JSON.stringify(sessionUser));
        this.notifyAuthListeners();
        
        resolve(sessionUser);
      }, 500);
    });
  }
  
  logout() {
    return new Promise((resolve) => {
      localStorage.removeItem('EcoCircle_session');
      this.notifyAuthListeners();
      resolve();
    });
  }

  // --- Firestore Service Implementation ---
  
  getResources() {
    return JSON.parse(localStorage.getItem('EcoCircle_resources') || '[]');
  }
  
  saveResources(resources) {
    localStorage.setItem('EcoCircle_resources', JSON.stringify(resources));
    this.notifyResourceListeners();
  }
  
  onResourcesChanged(callback) {
    this.resourceListeners.push(callback);
    // Execute immediately with current data
    callback(this.getResources());
    
    // Return unsubscribe function
    return () => {
      this.resourceListeners = this.resourceListeners.filter(l => l !== callback);
    };
  }
  
  notifyResourceListeners() {
    const resources = this.getResources();
    this.resourceListeners.forEach(callback => {
      try { callback(resources); } catch (e) { console.error(e); }
    });
  }
  
  addResource(resourceData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const resources = this.getResources();
        const currentUser = this.getCurrentUser();
        
        const lat = resourceData.latitude !== undefined && resourceData.latitude !== null ? Number(resourceData.latitude) : 45.5152 + (Math.random() - 0.5) * 0.03;
        const lng = resourceData.longitude !== undefined && resourceData.longitude !== null ? Number(resourceData.longitude) : -122.6784 + (Math.random() - 0.5) * 0.03;

        const newResource = {
          resourceId: 'res_' + Math.random().toString(36).substr(2, 9),
          ownerId: currentUser ? currentUser.uid : 'anonymous',
          ownerName: currentUser ? currentUser.displayName : 'Anonymous Resident',
          title: resourceData.title,
          description: resourceData.description,
          category: resourceData.category,
          quantity: resourceData.quantity || '1',
          imageUrl: resourceData.imageUrl || this.getDefaultCategoryBanner(resourceData.category),
          location: resourceData.location || (currentUser ? currentUser.location : 'Community Center'),
          latitude: lat,
          longitude: lng,
          createdAt: new Date().toISOString(),
          status: 'Available'
        };
        
        resources.unshift(newResource); // Add to beginning
        this.saveResources(resources);
        
        resolve(newResource);
      }, 300);
    });
  }
  
  updateResource(resourceId, resourceData) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const resources = this.getResources();
        const index = resources.findIndex(r => r.resourceId === resourceId);
        
        if (index === -1) {
          return reject(new Error('Resource not found.'));
        }
        
        // Prevent editing other user's resources unless it is a status change request to Pending
        const currentUser = this.getCurrentUser();
        const isRequesting = Object.keys(resourceData).length === 1 && 
                             resourceData.status === 'Pending' && 
                             resources[index].status === 'Available';
                             
        const isOwner = currentUser && (resources[index].ownerId === currentUser.uid || resources[index].ownerName === currentUser.displayName);
        if (currentUser && !isOwner && !isRequesting) {
          return reject(new Error('Unauthorized: You do not own this resource.'));
        }
        
        const updatedData = { ...resourceData };
        if (updatedData.latitude !== undefined && updatedData.latitude !== null) {
          updatedData.latitude = Number(updatedData.latitude);
        }
        if (updatedData.longitude !== undefined && updatedData.longitude !== null) {
          updatedData.longitude = Number(updatedData.longitude);
        }

        resources[index] = {
          ...resources[index],
          ...updatedData
        };
        
        this.saveResources(resources);
        resolve(resources[index]);
      }, 300);
    });
  }
  
  deleteResource(resourceId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const resources = this.getResources();
        const index = resources.findIndex(r => r.resourceId === resourceId);
        
        if (index === -1) {
          return reject(new Error('Resource not found.'));
        }
        
        const isOwner = currentUser && (resources[index].ownerId === currentUser.uid || resources[index].ownerName === currentUser.displayName);
        if (currentUser && !isOwner) {
          return reject(new Error('Unauthorized: You do not own this resource.'));
        }
        
        const updatedResources = resources.filter(r => r.resourceId !== resourceId);
        this.saveResources(updatedResources);
        resolve();
      }, 300);
    });
  }
  
  // Bookmarking System
  saveResource(userId, resourceId) {
    return new Promise((resolve, reject) => {
      const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
      const userIndex = users.findIndex(u => u.uid === userId);
      
      if (userIndex === -1) return reject(new Error('User not found'));
      
      if (!users[userIndex].savedResources) {
        users[userIndex].savedResources = [];
      }
      
      if (!users[userIndex].savedResources.includes(resourceId)) {
        users[userIndex].savedResources.push(resourceId);
        localStorage.setItem('EcoCircle_users', JSON.stringify(users));
        
        // Update current session if matching
        const session = this.getCurrentUser();
        if (session && session.uid === userId) {
          session.savedResources = users[userIndex].savedResources;
          localStorage.setItem('EcoCircle_session', JSON.stringify(session));
          this.notifyAuthListeners();
        }
      }
      resolve(users[userIndex].savedResources);
    });
  }
  
  unsaveResource(userId, resourceId) {
    return new Promise((resolve, reject) => {
      const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
      const userIndex = users.findIndex(u => u.uid === userId);
      
      if (userIndex === -1) return reject(new Error('User not found'));
      
      if (users[userIndex].savedResources) {
        users[userIndex].savedResources = users[userIndex].savedResources.filter(id => id !== resourceId);
        localStorage.setItem('EcoCircle_users', JSON.stringify(users));
        
        // Update session
        const session = this.getCurrentUser();
        if (session && session.uid === userId) {
          session.savedResources = users[userIndex].savedResources;
          localStorage.setItem('EcoCircle_session', JSON.stringify(session));
          this.notifyAuthListeners();
        }
      }
      resolve(users[userIndex].savedResources || []);
    });
  }
  
  getSavedResources(userId) {
    const session = this.getCurrentUser();
    if (session && session.uid === userId) {
      return Promise.resolve(session.savedResources || []);
    }
    const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
    const user = users.find(u => u.uid === userId);
    return Promise.resolve(user ? (user.savedResources || []) : []);
  }

  // --- Chat Service Implementation ---

  getChats() {
    let chats = JSON.parse(localStorage.getItem('EcoCircle_chats') || '[]');
    let lobby = chats.find(c => c.chatId === 'general_lobby');
    if (!lobby) {
      lobby = {
        chatId: 'general_lobby',
        participants: [],
        participantNames: {},
        resourceId: 'general',
        resourceTitle: 'Community Lobby',
        lastMessage: 'Welcome to the Community Lobby!',
        lastMessageAt: new Date(0).toISOString()
      };
      chats.unshift(lobby);
      localStorage.setItem('EcoCircle_chats', JSON.stringify(chats));
    }
    return chats;
  }

  getMessages() {
    return JSON.parse(localStorage.getItem('EcoCircle_messages') || '[]');
  }

  notifyChatListeners() {
    this.chatListeners.forEach(listener => {
      try {
        const user = this.getCurrentUser();
        if (user) {
          const chats = this.getChats();
          const userChats = chats.filter(c => c.chatId === 'general_lobby' || c.participants.includes(user.uid));
          userChats.sort((a, b) => {
            if (a.chatId === 'general_lobby') return -1;
            if (b.chatId === 'general_lobby') return 1;
            return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
          });
          listener(userChats);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  notifyMessageListeners() {
    this.messageListeners.forEach(listener => {
      try {
        if (listener.chatId) {
          const msgs = this.getMessages().filter(m => m.chatId === listener.chatId);
          listener.callback(msgs);
        }
      } catch (e) {
        console.error(e);
      }
    });
  }

  onChatsChanged(userId, callback) {
    this.chatListeners.push(callback);
    // Execute immediately
    const chats = this.getChats();
    const userChats = chats.filter(c => c.chatId === 'general_lobby' || c.participants.includes(userId));
    userChats.sort((a, b) => {
      if (a.chatId === 'general_lobby') return -1;
      if (b.chatId === 'general_lobby') return 1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });
    callback(userChats);

    return () => {
      this.chatListeners = this.chatListeners.filter(l => l !== callback);
    };
  }

  onMessagesChanged(chatId, callback) {
    const listener = { chatId, callback };
    this.messageListeners.push(listener);
    // Execute immediately
    const msgs = this.getMessages().filter(m => m.chatId === chatId);
    callback(msgs);

    return () => {
      this.messageListeners = this.messageListeners.filter(l => l !== listener);
    };
  }

  getOrCreateChat(participantId, resourceId, resourceTitle, participantName) {
    return new Promise((resolve) => {
      const currentUser = this.getCurrentUser();
      if (!currentUser) return resolve(null);

      const chats = this.getChats();
      
      // Look for an existing chat for the same resource with these participants
      let chat = chats.find(c => 
        c.resourceId === resourceId && 
        c.participants.includes(currentUser.uid) && 
        c.participants.includes(participantId)
      );

      if (!chat) {
        chat = {
          chatId: 'chat_' + Math.random().toString(36).substr(2, 9),
          participants: [currentUser.uid, participantId],
          participantNames: {
            [currentUser.uid]: currentUser.displayName,
            [participantId]: participantName || 'Resource Owner'
          },
          resourceId,
          resourceTitle,
          lastMessage: 'Conversation started',
          lastMessageAt: new Date().toISOString()
        };
        chats.unshift(chat);
        localStorage.setItem('EcoCircle_chats', JSON.stringify(chats));
        this.notifyChatListeners();
      }
      resolve(chat);
    });
  }

  sendMessage(chatId, messageText) {
    return new Promise((resolve) => {
      const currentUser = this.getCurrentUser();
      if (!currentUser) return resolve();

      const messages = this.getMessages();
      const message = {
        messageId: 'msg_' + Math.random().toString(36).substr(2, 9),
        chatId,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        content: messageText,
        createdAt: new Date().toISOString()
      };

      messages.push(message);
      localStorage.setItem('EcoCircle_messages', JSON.stringify(messages));

      // Update last message in the parent chat
      const chats = this.getChats();
      const chatIndex = chats.findIndex(c => c.chatId === chatId);
      if (chatIndex !== -1) {
        chats[chatIndex].lastMessage = messageText;
        chats[chatIndex].lastMessageAt = message.createdAt;
        chats[chatIndex].lastMessageSenderId = currentUser.uid;
        chats[chatIndex].lastMessageSenderName = currentUser.displayName;
        // Move to top
        const updatedChat = chats.splice(chatIndex, 1)[0];
        chats.unshift(updatedChat);
        localStorage.setItem('EcoCircle_chats', JSON.stringify(chats));
      }

      this.notifyMessageListeners();
      this.notifyChatListeners();
      resolve(message);
    });
  }

  // --- Storage Service Implementation ---
  
  uploadImage(file, progressCallback) {
    return new Promise((resolve, reject) => {
      // Check file size. Large files can overflow localstorage, suggest compression
      if (file.size > 800000) {
        // Warn about size, but allow base64 compression.
        // We'll scale down via canvas inside resources.js to be safe.
      }
      
      const reader = new FileReader();
      
      reader.onload = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 20;
          if (progressCallback) progressCallback(progress);
          
          if (progress >= 100) {
            clearInterval(interval);
            resolve(reader.result); // Resolve with Base64 string
          }
        }, 100);
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file.'));
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  // Helper for generating initial seed data
  seedDefaultResources() {
    const seeds = [
      {
        resourceId: 'seed_1',
        ownerId: 'seed_owner_1',
        ownerName: 'Sarah Jenkins',
        title: 'Excess organic garden tomatoes',
        description: 'Harvested way more beefsteak tomatoes than my family can eat! Super sweet and organic. Come grab a bag of 5-6 tomatoes. Best consumed this week.',
        category: 'Food',
        quantity: '4 bags left',
        imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=60',
        location: 'Oakridge Neighborhood',
        latitude: 45.5152,
        longitude: -122.6784,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        status: 'Available'
      },
      {
        resourceId: 'seed_2',
        ownerId: 'seed_owner_2',
        ownerName: 'Marcus Chen',
        title: 'High school biology textbooks',
        description: 'AP Biology textbooks in excellent condition. No highlighting, minor cover wear. Great study guide for high school students preparing for AP exams.',
        category: 'Educational Materials',
        quantity: '2 books',
        imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&auto=format&fit=crop&q=60',
        location: 'Pine Heights',
        latitude: 45.5202,
        longitude: -122.6854,
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString(), // 6 hours ago
        status: 'Available'
      },
      {
        resourceId: 'seed_3',
        ownerId: 'seed_owner_3',
        ownerName: 'Elena Rostova',
        title: 'Solid Oak Dining Chairs (Set of 2)',
        description: 'Replacing our dining set. These two chairs are sturdy oak, upholstered in green fabric. Minor scratches on legs but overall highly functional.',
        category: 'Furniture',
        quantity: '2 chairs',
        imageUrl: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=600&auto=format&fit=crop&q=60',
        location: 'Downtown Center',
        latitude: 45.5102,
        longitude: -122.6684,
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
        status: 'Available'
      },
      {
        resourceId: 'seed_4',
        ownerId: 'seed_owner_4',
        ownerName: 'Robert Vance',
        title: 'Hand blender - barely used',
        description: 'Vance Kitchen hand immersion blender. Used maybe 3 times. Works perfectly, comes with blending beaker and whisk attachments. Reducing household clutter.',
        category: 'Kitchen Items',
        quantity: '1 set',
        imageUrl: 'https://images.unsplash.com/photo-1578643463396-0997cb5328c1?w=600&auto=format&fit=crop&q=60',
        location: 'Westside Flats',
        latitude: 45.5252,
        longitude: -122.6984,
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
        status: 'Shared'
      }
    ];
    
    localStorage.setItem('EcoCircle_resources', JSON.stringify(seeds));
  }
  
  getDefaultCategoryBanner(category) {
    const banners = {
      'Food': 'https://images.unsplash.com/photo-1488459718432-36c85098938a?w=600&auto=format&fit=crop&q=60',
      'Clothes': 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600&auto=format&fit=crop&q=60',
      'Books': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=60',
      'Furniture': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&auto=format&fit=crop&q=60',
      'Electronics': 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&auto=format&fit=crop&q=60',
      'Kitchen Items': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=60',
      'Medical Supplies': 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=60',
      'Educational Materials': 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=600&auto=format&fit=crop&q=60',
      'Household Items': 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=60',
      'Other': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60'
    };
    return banners[category] || banners['Other'];
  }

  getAllUsers() {
    return new Promise((resolve) => {
      const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
      const sanitized = users.map(u => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        location: u.location,
        role: u.role || 'resident',
        approved: u.approved !== undefined ? u.approved : (u.role === 'admin'),
        status: u.status || 'pending',
        savedResources: u.savedResources || [],
        createdAt: u.createdAt
      }));
      resolve(sanitized);
    });
  }

  updateUserApproval(userId, approved, status) {
    return new Promise((resolve) => {
      const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
      const userIndex = users.findIndex(u => u.uid === userId);
      if (userIndex !== -1) {
        users[userIndex].approved = approved;
        users[userIndex].status = status;
        localStorage.setItem('EcoCircle_users', JSON.stringify(users));

        // Sync active session if it is this user
        const session = localStorage.getItem('EcoCircle_session');
        if (session) {
          const sessionUser = JSON.parse(session);
          if (sessionUser.uid === userId) {
            sessionUser.approved = approved;
            sessionUser.status = status;
            localStorage.setItem('EcoCircle_session', JSON.stringify(sessionUser));
          }
        }
        this.notifyAuthListeners();
      }
      resolve();
    });
  }

  sendOtp(email, metadata = {}) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockCode = '123456';
        localStorage.setItem(`EcoCircle_mock_otp_${email}`, JSON.stringify({
          code: mockCode,
          metadata,
          timestamp: Date.now()
        }));
        
        if (window.showToastNotification) {
          window.showToastNotification(`[MOCK OTP] A verification code has been sent: 123456`, 'success');
        } else {
          alert(`[MOCK OTP] One-time code for ${email} is: 123456`);
        }
        resolve({ email });
      }, 500);
    });
  }

  verifyOtp(email, token) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const cached = localStorage.getItem(`EcoCircle_mock_otp_${email}`);
        if (!cached) return reject(new Error('No OTP request found for this email or code has expired.'));
        
        const { code, metadata } = JSON.parse(cached);
        if (token !== code) {
          return reject(new Error('Invalid verification code. Please try again.'));
        }
        
        localStorage.removeItem(`EcoCircle_mock_otp_${email}`);
        
        const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
        let userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
        const activeSessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        
        let sessionUser;
        if (userIndex === -1) {
          const isAdmin = checkIsAdmin(email);
          sessionUser = {
            uid: 'mock_uid_' + Math.random().toString(36).substr(2, 9),
            email,
            displayName: metadata.displayName || 'EcoCircle Member',
            location: metadata.location || 'Community Center',
            role: isAdmin ? 'admin' : 'resident',
            approved: isAdmin ? true : false,
            status: isAdmin ? 'approved' : 'pending',
            savedResources: [],
            activeSessionId,
            createdAt: new Date().toISOString()
          };
          users.push(sessionUser);
          localStorage.setItem('EcoCircle_users', JSON.stringify(users));
        } else {
          sessionUser = {
            ...users[userIndex],
            activeSessionId
          };
          users[userIndex] = sessionUser;
          localStorage.setItem('EcoCircle_users', JSON.stringify(users));
        }
        
        localStorage.setItem('EcoCircle_session', JSON.stringify(sessionUser));
        this.notifyAuthListeners();
        resolve(sessionUser);
      }, 500);
    });
  }

  verifySignupOtp(email, token) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const cached = localStorage.getItem(`EcoCircle_mock_verify_${email}`);
        if (!cached) return reject(new Error('No registration verification pending for this email.'));

        const { code, displayName, location, password } = JSON.parse(cached);
        if (token !== code) {
          return reject(new Error('Invalid verification code. Please try again.'));
        }

        localStorage.removeItem(`EcoCircle_mock_verify_${email}`);

        const users = JSON.parse(localStorage.getItem('EcoCircle_users') || '[]');
        const activeSessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        const isAdmin = checkIsAdmin(email);

        const sessionUser = {
          uid: 'mock_uid_' + Math.random().toString(36).substr(2, 9),
          email,
          displayName,
          location,
          role: isAdmin ? 'admin' : 'resident',
          approved: isAdmin ? true : false,
          status: isAdmin ? 'approved' : 'pending',
          savedResources: [],
          activeSessionId,
          createdAt: new Date().toISOString()
        };

        users.push({ ...sessionUser, password });
        localStorage.setItem('EcoCircle_users', JSON.stringify(users));
        localStorage.setItem('EcoCircle_session', JSON.stringify(sessionUser));
        this.notifyAuthListeners();
        resolve(sessionUser);
      }, 500);
    });
  }
}

export const mockDb = new MockDatabase();
export default mockDb;
