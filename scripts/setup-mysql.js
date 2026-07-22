const mysql = require('mysql2/promise');

async function setupDatabase() {
  console.log('[MySQL Setup] Connecting to MySQL server at localhost:3306...');
  
  // Connect without a database first to create the db if missing
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });
  } catch (err) {
    console.error('[MySQL Setup] ❌ Failed to connect to MySQL at localhost. Ensure XAMPP MySQL is started in your Control Panel.', err.message);
    process.exit(1);
  }

  try {
    // 1. Create Database
    await connection.query('CREATE DATABASE IF NOT EXISTS `ecocircle`');
    console.log('[MySQL Setup] ✅ Database "ecocircle" checked/created.');
    await connection.query('USE `ecocircle`');

    // 2. Create Users Table
    // savedResources will store a JSON array of bookmarked resource IDs
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`uid\` VARCHAR(255) PRIMARY KEY,
        \`email\` VARCHAR(255) UNIQUE NOT NULL,
        \`displayName\` VARCHAR(255) NOT NULL,
        \`location\` VARCHAR(255) NOT NULL,
        \`role\` VARCHAR(50) DEFAULT 'resident',
        \`approved\` TINYINT(1) DEFAULT 0,
        \`status\` VARCHAR(50) DEFAULT 'pending',
        \`savedResources\` TEXT,
        \`activeSessionId\` VARCHAR(255),
        \`password\` VARCHAR(255) DEFAULT 'password123',
        \`createdAt\` VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[MySQL Setup] ✅ Table "users" checked/created.');

    // 3. Create Resources Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`resources\` (
        \`resourceId\` VARCHAR(255) PRIMARY KEY,
        \`ownerId\` VARCHAR(255) NOT NULL,
        \`ownerName\` VARCHAR(255) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`category\` VARCHAR(100) NOT NULL,
        \`quantity\` VARCHAR(100) NOT NULL,
        \`imageUrl\` TEXT,
        \`location\` VARCHAR(255) NOT NULL,
        \`latitude\` DOUBLE DEFAULT NULL,
        \`longitude\` DOUBLE DEFAULT NULL,
        \`createdAt\` VARCHAR(255) NOT NULL,
        \`status\` VARCHAR(50) DEFAULT 'Available'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[MySQL Setup] ✅ Table "resources" checked/created.');

    // 4. Create Chats Table
    // participants will store JSON array of strings
    // participantNames will store JSON object (uid -> displayName)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`chats\` (
        \`chatId\` VARCHAR(255) PRIMARY KEY,
        \`participants\` TEXT NOT NULL,
        \`participantNames\` TEXT NOT NULL,
        \`resourceId\` VARCHAR(255),
        \`resourceTitle\` VARCHAR(255),
        \`lastMessage\` TEXT,
        \`lastMessageAt\` VARCHAR(255),
        \`lastMessageSenderId\` VARCHAR(255),
        \`lastMessageSenderName\` VARCHAR(255),
        \`isLobby\` TINYINT(1) DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[MySQL Setup] ✅ Table "chats" checked/created.');

    // 5. Create Messages Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`messages\` (
        \`messageId\` VARCHAR(255) PRIMARY KEY,
        \`chatId\` VARCHAR(255) NOT NULL,
        \`senderId\` VARCHAR(255) NOT NULL,
        \`senderName\` VARCHAR(255) NOT NULL,
        \`content\` TEXT NOT NULL,
        \`createdAt\` VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[MySQL Setup] ✅ Table "messages" checked/created.');

    // Clear any existing non-real data to start fresh
    console.log('[MySQL Setup] Cleaning up existing table data...');
    await connection.query('TRUNCATE TABLE `messages`');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE `chats`');
    await connection.query('TRUNCATE TABLE `resources`');
    await connection.query('TRUNCATE TABLE `users`');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[MySQL Setup] ✅ Database tables truncated/cleared.');

    // 6. Seed Default Users
    console.log('[MySQL Setup] Seeding default admin users...');
    const adminUsers = [
      ['admin_uid_1', 'admin@gmail.com', 'System Admin', 'Central Hub', 'admin', 1, 'approved', '[]', 'EcoPass123', new Date().toISOString()],
      ['admin_uid_2', 'admin@ecocircle.com', 'Eco Admin', 'Central Hub', 'admin', 1, 'approved', '[]', 'EcoPass123', new Date().toISOString()],
      ['admin_uid_3', 'admin@ecoshare.com', 'EcoShare Admin', 'Central Hub', 'admin', 1, 'approved', '[]', 'EcoPass123', new Date().toISOString()],
      ['admin_uid_4', 'ashrithap2200.sse@saveetha.com', 'Admin Developer', 'Central Hub', 'admin', 1, 'approved', '[]', 'EcoPass123', new Date().toISOString()]
    ];

    for (const u of adminUsers) {
      await connection.query(
        'INSERT INTO `users` (uid, email, displayName, location, role, approved, status, savedResources, password, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        u
      );
    }
    console.log('[MySQL Setup] ✅ Seeded admin users.');

    // 7. Seed General Lobby
    await connection.query(
      'INSERT INTO `chats` (chatId, participants, participantNames, resourceId, resourceTitle, lastMessage, lastMessageAt, isLobby) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['general_lobby', '[]', '{}', 'general', 'Community Lobby', 'Welcome to the Community Lobby!', new Date(0).toISOString(), 1]
    );
    console.log('[MySQL Setup] ✅ Seeded Community Lobby.');

    console.log('[MySQL Setup] 🎉 Setup completed successfully.');

  } catch (err) {
    console.error('[MySQL Setup] ❌ Error configuring tables:', err);
  } finally {
    await connection.end();
  }
}

setupDatabase();
