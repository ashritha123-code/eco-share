const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON body parser
app.use(cors());
app.use(express.json());

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploads static directory
app.use('/uploads', express.static(uploadDir));

// Multer Disk Storage Configuration for local image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Database Connection Pool
const dbPool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'ecocircle',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Helper: check connection on startup
async function checkDbConnection() {
  try {
    const conn = await dbPool.getConnection();
    console.log('[Server] Connected to MySQL ecocircle database successfully.');
    conn.release();
  } catch (err) {
    console.error('[Server] ❌ Database connection failed. Start XAMPP MySQL and run setup script.', err.message);
  }
}
checkDbConnection();

// ==========================================
// AUTH & USER ENDPOINTS
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName, location } = req.body;
  if (!email || !password || !displayName || !location) {
    return res.status(400).json({ error: 'All registration fields are required.' });
  }

  try {
    // Check if email already exists
    const [existing] = await dbPool.query('SELECT uid FROM users WHERE LOWER(email) = ?', [email.toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const checkIsAdmin = (emailStr) => {
      const normalized = emailStr.toLowerCase().trim().replace(/\+[^@]*@/, '@');
      return normalized === 'admin@gmail.com' || normalized === 'admin@ecocircle.com' || normalized === 'admin@ecoshare.com' || normalized === 'ashrithap2200.sse@saveetha.com';
    };

    const uid = 'mysql_uid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const isAdmin = checkIsAdmin(email);
    const role = isAdmin ? 'admin' : 'resident';
    const approved = isAdmin ? 1 : 0;
    const status = isAdmin ? 'approved' : 'pending';
    const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    const createdAt = new Date().toISOString();

    await dbPool.query(
      'INSERT INTO users (uid, email, displayName, location, role, approved, status, savedResources, activeSessionId, password, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uid, email, displayName, location, role, approved, status, '[]', activeSessionId, password, createdAt]
    );

    res.json({
      uid, email, displayName, location, role, approved: !!approved, status, savedResources: [], activeSessionId, createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database registration error: ' + err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const [rows] = await dbPool.query('SELECT * FROM users WHERE LOWER(email) = ?', [email.toLowerCase()]);
    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    const activeSessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    
    // Update database session ID
    await dbPool.query('UPDATE users SET activeSessionId = ? WHERE uid = ?', [activeSessionId, user.uid]);

    let savedList = [];
    try {
      savedList = JSON.parse(user.savedResources || '[]');
    } catch (_) {}

    res.json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      location: user.location,
      role: user.role,
      approved: !!user.approved,
      status: user.status,
      savedResources: savedList,
      activeSessionId,
      createdAt: user.createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database login error: ' + err.message });
  }
});

// Get User Profile
app.get('/api/auth/me', async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: 'User UID parameter is required.' });

  try {
    const [rows] = await dbPool.query('SELECT * FROM users WHERE uid = ?', [uid]);
    if (rows.length === 0) return res.status(404).json({ error: 'User profile not found.' });

    const user = rows[0];
    let savedList = [];
    try {
      savedList = JSON.parse(user.savedResources || '[]');
    } catch (_) {}

    res.json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      location: user.location,
      role: user.role,
      approved: !!user.approved,
      status: user.status,
      savedResources: savedList,
      activeSessionId: user.activeSessionId,
      createdAt: user.createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database fetch user profile error: ' + err.message });
  }
});

// Get All Users (Admin)
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT uid, email, displayName, location, role, approved, status, savedResources, createdAt FROM users');
    const sanitized = rows.map(user => {
      let savedList = [];
      try { savedList = JSON.parse(user.savedResources || '[]'); } catch (_) {}
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        location: user.location,
        role: user.role,
        approved: !!user.approved,
        status: user.status,
        savedResources: savedList,
        createdAt: user.createdAt
      };
    });
    res.json(sanitized);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query error: ' + err.message });
  }
});

// Update User Approval Status (Admin)
app.post('/api/users/approve', async (req, res) => {
  const { userId, approved, status } = req.body;
  if (!userId || approved === undefined || !status) {
    return res.status(400).json({ error: 'userId, approved, and status are required.' });
  }

  try {
    const approvedVal = approved ? 1 : 0;
    await dbPool.query('UPDATE users SET approved = ?, status = ? WHERE uid = ?', [approvedVal, status, userId]);
    res.json({ success: true, userId, approved, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update error: ' + err.message });
  }
});


// ==========================================
// RESOURCES ENDPOINTS
// ==========================================

// Get All Resources
app.get('/api/resources', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM resources ORDER BY createdAt DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query error: ' + err.message });
  }
});

// Add Resource
app.post('/api/resources', async (req, res) => {
  const { resourceId, ownerId, ownerName, title, description, category, quantity, imageUrl, location, latitude, longitude, createdAt, status } = req.body;
  
  if (!title || !description || !category || !ownerId) {
    return res.status(400).json({ error: 'Missing required resource fields.' });
  }

  try {
    const resId = resourceId || 'res_' + Math.floor(Date.now() % 2000000000);
    const finalCreatedAt = createdAt || new Date().toISOString();
    const finalStatus = status || 'Available';

    await dbPool.query(
      'INSERT INTO resources (resourceId, ownerId, ownerName, title, description, category, quantity, imageUrl, location, latitude, longitude, createdAt, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [resId, ownerId, ownerName, title, description, category, quantity || '1', imageUrl || '', location, latitude, longitude, finalCreatedAt, finalStatus]
    );

    const [created] = await dbPool.query('SELECT * FROM resources WHERE resourceId = ?', [resId]);
    res.json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insert resource error: ' + err.message });
  }
});

// Update Resource
app.put('/api/resources/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Read current resource
    const [existing] = await dbPool.query('SELECT * FROM resources WHERE resourceId = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Resource not found.' });

    const merged = { ...existing[0], ...updates };

    await dbPool.query(
      'UPDATE resources SET title = ?, description = ?, category = ?, quantity = ?, imageUrl = ?, location = ?, latitude = ?, longitude = ?, status = ? WHERE resourceId = ?',
      [merged.title, merged.description, merged.category, merged.quantity, merged.imageUrl, merged.location, merged.latitude, merged.longitude, merged.status, id]
    );

    const [updated] = await dbPool.query('SELECT * FROM resources WHERE resourceId = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update resource error: ' + err.message });
  }
});

// Delete Resource
app.delete('/api/resources/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await dbPool.query('SELECT * FROM resources WHERE resourceId = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Resource not found.' });

    await dbPool.query('DELETE FROM resources WHERE resourceId = ?', [id]);
    res.json({ success: true, message: 'Resource deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database delete resource error: ' + err.message });
  }
});

// Bookmark Save
app.post('/api/resources/save', async (req, res) => {
  const { userId, resourceId } = req.body;
  if (!userId || !resourceId) return res.status(400).json({ error: 'userId and resourceId are required.' });

  try {
    const [rows] = await dbPool.query('SELECT savedResources FROM users WHERE uid = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    let savedList = [];
    try {
      savedList = JSON.parse(rows[0].savedResources || '[]');
    } catch (_) {}

    if (!savedList.includes(resourceId)) {
      savedList.push(resourceId);
      await dbPool.query('UPDATE users SET savedResources = ? WHERE uid = ?', [JSON.stringify(savedList), userId]);
    }

    res.json(savedList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database save resource error: ' + err.message });
  }
});

// Bookmark Unsave
app.post('/api/resources/unsave', async (req, res) => {
  const { userId, resourceId } = req.body;
  if (!userId || !resourceId) return res.status(400).json({ error: 'userId and resourceId are required.' });

  try {
    const [rows] = await dbPool.query('SELECT savedResources FROM users WHERE uid = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    let savedList = [];
    try {
      savedList = JSON.parse(rows[0].savedResources || '[]');
    } catch (_) {}

    savedList = savedList.filter(id => id !== resourceId);
    await dbPool.query('UPDATE users SET savedResources = ? WHERE uid = ?', [JSON.stringify(savedList), userId]);

    res.json(savedList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database unsave resource error: ' + err.message });
  }
});


// ==========================================
// CHAT & MESSAGES ENDPOINTS
// ==========================================

// Get Chats
app.get('/api/chats', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query parameter is required.' });

  try {
    const [rows] = await dbPool.query('SELECT * FROM chats');
    const filtered = rows.filter(chat => {
      if (chat.chatId === 'general_lobby' || chat.isLobby) return true;
      try {
        const parts = JSON.parse(chat.participants || '[]');
        return parts.includes(userId);
      } catch (_) {
        return false;
      }
    });

    const formatted = filtered.map(c => {
      let participants = [];
      let participantNames = {};
      try { participants = JSON.parse(c.participants || '[]'); } catch (_) {}
      try { participantNames = JSON.parse(c.participantNames || '{}'); } catch (_) {}
      return {
        chatId: c.chatId,
        participants,
        participantNames,
        resourceId: c.resourceId,
        resourceTitle: c.resourceTitle,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        lastMessageSenderId: c.lastMessageSenderId,
        lastMessageSenderName: c.lastMessageSenderName,
        isLobby: !!c.isLobby
      };
    });
    
    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query error: ' + err.message });
  }
});

// Get or Create Chat
app.post('/api/chats/create', async (req, res) => {
  const { userId, participantId, resourceId, resourceTitle, participantName, displayName } = req.body;
  if (!userId || !participantId || !resourceId) {
    return res.status(400).json({ error: 'userId, participantId, and resourceId are required.' });
  }

  try {
    // Query chats to see if one already exists
    const [rows] = await dbPool.query('SELECT * FROM chats WHERE resourceId = ? AND isLobby = 0', [resourceId]);
    
    let existingChat = null;
    for (const chat of rows) {
      let parts = [];
      try { parts = JSON.parse(chat.participants || '[]'); } catch (_) {}
      if (parts.includes(userId) && parts.includes(participantId)) {
        existingChat = chat;
        break;
      }
    }

    if (existingChat) {
      let participants = [];
      let participantNames = {};
      try { participants = JSON.parse(existingChat.participants || '[]'); } catch (_) {}
      try { participantNames = JSON.parse(existingChat.participantNames || '{}'); } catch (_) {}
      return res.json({
        chatId: existingChat.chatId,
        participants,
        participantNames,
        resourceId: existingChat.resourceId,
        resourceTitle: existingChat.resourceTitle,
        lastMessage: existingChat.lastMessage,
        lastMessageAt: existingChat.lastMessageAt,
        lastMessageSenderId: existingChat.lastMessageSenderId,
        lastMessageSenderName: existingChat.lastMessageSenderName,
        isLobby: false
      });
    }

    // Otherwise, create new chat
    const chatId = 'chat_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const participantsArr = [userId, participantId];
    const participantNamesObj = {
      [userId]: displayName || 'EcoCircle Member',
      [participantId]: participantName || 'Resource Owner'
    };
    const lastMessage = 'Conversation started';
    const lastMessageAt = new Date().toISOString();

    await dbPool.query(
      'INSERT INTO chats (chatId, participants, participantNames, resourceId, resourceTitle, lastMessage, lastMessageAt, isLobby) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [chatId, JSON.stringify(participantsArr), JSON.stringify(participantNamesObj), resourceId, resourceTitle, lastMessage, lastMessageAt, 0]
    );

    res.json({
      chatId,
      participants: participantsArr,
      participantNames: participantNamesObj,
      resourceId,
      resourceTitle,
      lastMessage,
      lastMessageAt,
      isLobby: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insert chat error: ' + err.message });
  }
});

// Get Messages
app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;

  try {
    const [rows] = await dbPool.query('SELECT * FROM messages WHERE chatId = ? ORDER BY createdAt ASC', [chatId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query messages error: ' + err.message });
  }
});

// Send Message
app.post('/api/messages/send', async (req, res) => {
  const { chatId, senderId, senderName, content } = req.body;
  if (!chatId || !senderId || !content) {
    return res.status(400).json({ error: 'chatId, senderId, and content are required.' });
  }

  try {
    const messageId = 'msg_' + Math.floor(Date.now() % 2000000000);
    const createdAt = new Date().toISOString();

    await dbPool.query(
      'INSERT INTO messages (messageId, chatId, senderId, senderName, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [messageId, chatId, senderId, senderName || 'EcoCircle Member', content, createdAt]
    );

    // Update parent chat metadata
    await dbPool.query(
      'UPDATE chats SET lastMessage = ?, lastMessageAt = ?, lastMessageSenderId = ?, lastMessageSenderName = ? WHERE chatId = ?',
      [content, createdAt, senderId, senderName || 'EcoCircle Member', chatId]
    );

    res.json({ messageId, chatId, senderId, senderName, content, createdAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insert message error: ' + err.message });
  }
});


// ==========================================
// UPLOAD IMAGE ENDPOINT
// ==========================================
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  // Generate public url
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ imageUrl: fileUrl });
});


// ==========================================
// STATIC FRONT-END SERVICE
// ==========================================
// Serve all other frontend static files directly from workspace folder
app.use(express.static(__dirname));

// Direct any unhandled static requests back to index.html for client-side routing fallback
app.get(/.*/, (req, res, next) => {
  // If requesting api routes that were not handled, send 404
  if (req.originalUrl.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] EcoCircle Express server is running on http://localhost:${PORT}`);
});
