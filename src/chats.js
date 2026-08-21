// Chat module controller for EcoCircle
import { dbService, authService } from './firebase-config.js';
import { getLoggedInUser } from './auth.js';

let activeChatId = null;
let activeChat = null;
let unsubscribeChats = null;
let unsubscribeMessages = null;
let showToastCallback = null;
let currentChats = [];
let previousChatsMap = null;

export function initChats(showToast) {
  showToastCallback = showToast;
  
  const chatSendForm = document.getElementById('chatSendForm');
  const chatInputMessage = document.getElementById('chatInputMessage');

  // Handle Send Message Submission
  if (chatSendForm) {
    chatSendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const messageText = chatInputMessage.value.trim();
      const user = getLoggedInUser();

      if (!messageText || !activeChatId || !user) return;

      try {
        await dbService.sendMessage(activeChatId, messageText);
        chatInputMessage.value = '';
        chatInputMessage.focus();
      } catch (err) {
        console.error(err);
        showToast('Failed to send message: ' + err.message, 'error');
      }
    });
  }

  // Handle Mobile Back Button in Chat View
  const mobileBackBtn = document.getElementById('mobileBackToChatsBtn');
  if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', () => {
      resetChatWorkspace();
    });
  }

  // Listen for Authentication state changes to subscribe to chats
  document.addEventListener('auth-changed', (e) => {
    const user = e.detail;
    
    // Cleanup active streams
    if (unsubscribeChats) {
      unsubscribeChats();
      unsubscribeChats = null;
    }
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
    
    activeChatId = null;
    activeChat = null;
    currentChats = [];
    previousChatsMap = null;
    
    resetChatWorkspace();

    if (user && user.approved !== false && user.status !== 'rejected') {
      subscribeToUserChats(user);
    }
  });

  // Listen for hashchange to auto-select Community Lobby if no conversation is active
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#messages') {
      const user = getLoggedInUser();
      if (user && !activeChatId && currentChats.length > 0) {
        const lobbyChat = currentChats.find(c => c.chatId === 'general_lobby');
        if (lobbyChat) {
          selectChat(lobbyChat, 'Community Lobby', user);
        }
      }
    }
  });
}

function subscribeToUserChats(user) {
  unsubscribeChats = dbService.onChatsChanged(user.uid, (chats) => {
    currentChats = chats;
    renderChatList(chats, user);

    // In-app dynamic toast notifications for incoming messages in other chats
    if (previousChatsMap) {
      chats.forEach(chat => {
        const prevChat = previousChatsMap[chat.chatId];
        if (prevChat && chat.lastMessageAt !== prevChat.lastMessageAt) {
          if (chat.chatId !== activeChatId && chat.lastMessageSenderId !== user.uid) {
            const senderName = chat.lastMessageSenderName || 'Someone';
            if (showToastCallback) {
              if (chat.chatId === 'general_lobby') {
                showToastCallback(`Lobby: ${senderName} sent a message: "${chat.lastMessage}"`, 'info');
              } else {
                showToastCallback(`${senderName}: "${chat.lastMessage}"`, 'info');
              }
            }
          }
        }
      });
    }

    // Update the baseline chats map state
    previousChatsMap = {};
    chats.forEach(c => {
      previousChatsMap[c.chatId] = {
        lastMessageAt: c.lastMessageAt,
        lastMessageSenderId: c.lastMessageSenderId || null,
        lastMessageSenderName: c.lastMessageSenderName || null
      };
    });
    
    // Auto-select lobby if on messages hash and no activeChatId
    if (window.location.hash === '#messages' && !activeChatId) {
      const lobbyChat = chats.find(c => c.chatId === 'general_lobby');
      if (lobbyChat) {
        selectChat(lobbyChat, 'Community Lobby', user);
      }
    }
    
    // If active chat exists in fresh updates, refresh context
    if (activeChatId) {
      const freshChat = chats.find(c => c.chatId === activeChatId);
      if (freshChat) {
        activeChat = freshChat;
        if (freshChat.chatId === 'general_lobby') {
          document.getElementById('chatResourceContext').textContent = 'Global Chat';
          document.getElementById('chatPartnerName').textContent = 'Community Lobby';
        } else {
          const otherUid = freshChat.participants.find(id => id !== user.uid);
          const partnerName = freshChat.participantNames[otherUid] || 'Resident';
          document.getElementById('chatResourceContext').textContent = `Re: ${freshChat.resourceTitle}`;
          document.getElementById('chatPartnerName').textContent = partnerName;
        }
      }
    }
  });
}

async function renderChatList(chats, user) {
  const container = document.getElementById('chatsContainer');
  if (!container) return;

  container.innerHTML = '';

  // Ensure General Lobby is always included in the list
  let displayChats = [...(chats || [])];
  const hasLobby = displayChats.some(c => c.chatId === 'general_lobby');
  if (!hasLobby) {
    displayChats.unshift({
      chatId: 'general_lobby',
      resourceId: 'general',
      resourceTitle: 'Community Lobby',
      lastMessage: 'Welcome to the Community Lobby!',
      lastMessageAt: new Date().toISOString(),
      isLobby: true,
      participants: [],
      participantNames: {}
    });
  }

  // Render active chat rooms (Lobby + Private chats)
  displayChats.forEach(chat => {
    const isLobby = chat.chatId === 'general_lobby';
    const otherUid = isLobby ? null : (chat.participants || []).find(id => id !== user.uid);
    const partnerName = isLobby ? 'Community Lobby' : ((chat.participantNames && chat.participantNames[otherUid]) || 'Resident');
    
    const item = document.createElement('div');
    item.className = `chat-user-item ${chat.chatId === activeChatId ? 'active' : ''} ${isLobby ? 'chat-lobby-item' : ''}`;
    item.setAttribute('data-chat-id', chat.chatId);
    
    const dateString = formatTime(chat.lastMessageAt);
    
    // Avatars for list items
    const avatarHtml = isLobby 
      ? `<div class="chat-lobby-avatar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12.375 1.5a.75.75 0 0 0-1.125 0L1.5 10.875a.75.75 0 1 0 1.05 1.07L4.5 10.07V19.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V10.07l1.95 1.875a.75.75 0 1 0 1.05-1.07L12.375 1.5Zm4.875 18H6.75V9.007L12 3.966l5.25 5.04V19.5Z"/><path d="M12 11.25a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg></div>`
      : `<div class="chat-user-avatar">${partnerName.charAt(0).toUpperCase()}</div>`;

    item.innerHTML = `
      <div class="chat-avatar-container">
        ${avatarHtml}
      </div>
      <div class="chat-user-info-col">
        <div class="chat-user-title-row">
          <span class="chat-user-name">
            ${partnerName}
            ${isLobby ? '<span class="lobby-badge">Lobby</span>' : ''}
          </span>
          <span class="chat-user-time">${dateString}</span>
        </div>
        <div class="chat-user-last-msg">${chat.lastMessage || 'Click to open conversation'}</div>
      </div>
    `;

    item.addEventListener('click', () => {
      selectChat(chat, partnerName, user);
    });

    container.appendChild(item);
  });

  // Append Community Residents Direct Messaging section
  try {
    const allUsers = await dbService.getAllUsers();
    const otherMembers = (allUsers || []).filter(u => u && u.uid !== user.uid && u.approved === true);
    
    if (otherMembers.length > 0) {
      const divider = document.createElement('div');
      divider.style.cssText = 'padding: 1.25rem 1rem 0.5rem; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-top: 1px solid var(--border-color); margin-top: 1rem;';
      divider.textContent = 'Community Residents';
      container.appendChild(divider);

      otherMembers.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = 'chat-user-item';
        memberItem.style.cssText = 'display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: var(--radius-md); cursor: pointer; transition: background 0.2s;';
        
        const roleLabel = member.role === 'admin' ? 'Admin 👑' : 'Resident';
        
        memberItem.innerHTML = `
          <div class="chat-avatar-container">
            <div class="chat-user-avatar" style="background: var(--primary-glow); color: var(--primary); font-weight: 700;">
              ${(member.displayName || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
          <div class="chat-user-info-col">
            <div class="chat-user-title-row">
              <span class="chat-user-name">${member.displayName}</span>
              <span style="font-size: 0.7rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.2rem 0.5rem; border-radius: 12px; white-space: nowrap;">${roleLabel}</span>
            </div>
            <div class="chat-user-last-msg">${member.location || 'Community'}</div>
          </div>
        `;

        memberItem.addEventListener('click', async () => {
          await startChatWithUser(member.uid, 'direct_' + member.uid, `Direct Message to ${member.displayName}`, member.displayName);
        });

        container.appendChild(memberItem);
      });
    }
  } catch (err) {
    console.warn('[renderChatList] Directory fetch warning:', err);
  }
}

function selectChat(chat, partnerName, user) {
  activeChatId = chat.chatId;
  activeChat = chat;

  // Toggle mobile thread layout state
  const chatLayout = document.querySelector('.chat-layout');
  if (chatLayout) chatLayout.classList.add('thread-open');

  // Highlight selected chat item in sidebar list
  document.querySelectorAll('.chat-user-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`.chat-user-item[data-chat-id="${chat.chatId}"]`);
  if (activeEl) {
    activeEl.classList.add('active');
  }

  // Reveal workspace
  const placeholder = document.getElementById('chatThreadPlaceholder');
  const workspace = document.getElementById('chatThreadWorkspace');
  if (placeholder) placeholder.style.display = 'none';
  if (workspace) workspace.style.display = 'flex';
  
  document.getElementById('chatPartnerName').textContent = partnerName;
  document.getElementById('chatResourceContext').textContent = chat.chatId === 'general_lobby' ? 'Global Chat' : `Re: ${chat.resourceTitle}`;

  // Unsubscribe from previous message listeners
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  // Subscribe to message snapshots for this specific thread
  unsubscribeMessages = dbService.onMessagesChanged(chat.chatId, (messages) => {
    renderMessages(messages, user);
  });
}

function renderMessages(messages, user) {
  const container = document.getElementById('chatMessagesThread');
  if (!container) return;

  container.innerHTML = '';

  if (messages.length === 0) {
    container.innerHTML = `
      <p style="color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem; text-align: center;">No messages yet. Send a note to start coordinating!</p>
    `;
    return;
  }

  messages.forEach(msg => {
    const isMe = msg.senderId === user.uid;
    const timeString = formatClockTime(msg.createdAt);
    
    const bubble = document.createElement('div');
    bubble.className = `chat-message-bubble ${isMe ? 'outgoing' : 'incoming'}`;
    bubble.innerHTML = `
      ${!isMe && activeChatId === 'general_lobby' ? `<span class="chat-message-sender-name">${msg.senderName}</span>` : ''}
      <div>${msg.content}</div>
      <span class="chat-message-time">${timeString}</span>
    `;
    
    container.appendChild(bubble);
  });

  // Auto-scroll to the bottom of the message thread
  container.scrollTop = container.scrollHeight;
}

function resetChatWorkspace() {
  const chatLayout = document.querySelector('.chat-layout');
  if (chatLayout) chatLayout.classList.remove('thread-open');
  activeChatId = null;

  const placeholder = document.getElementById('chatThreadPlaceholder');
  const workspace = document.getElementById('chatThreadWorkspace');
  if (placeholder) placeholder.style.display = 'flex';
  if (workspace) workspace.style.display = 'none';
}

// Global action trigger to begin chatting from resource detail screen
export async function startChatWithUser(ownerId, resourceId, resourceTitle, ownerName, initialMessageText = null) {
  const currentUser = getLoggedInUser();
  if (!currentUser) {
    if (showToastCallback) showToastCallback('Please register or log in to message residents.', 'warning');
    return;
  }

  if (currentUser.uid === ownerId) {
    if (showToastCallback) showToastCallback('You cannot message yourself.', 'warning');
    return;
  }

  try {
    const chat = await dbService.getOrCreateChat(ownerId, resourceId, resourceTitle, ownerName);
    if (chat) {
      activeChatId = chat.chatId;
      activeChat = chat;
      
      // If an initial request message was passed, send it directly to the resource owner
      if (initialMessageText) {
        try {
          await dbService.sendMessage(chat.chatId, initialMessageText);
        } catch (msgErr) {
          console.warn('[startChatWithUser] Initial message send warning:', msgErr);
        }
      }

      // Navigate to messages tab
      window.location.hash = '#messages';
      
      // Force select the newly loaded chat
      setTimeout(() => {
        selectChat(chat, ownerName, currentUser);
      }, 100);
    }
  } catch (err) {
    console.error(err);
    if (showToastCallback) showToastCallback('Failed to initiate conversation: ' + err.message, 'error');
  }
}

// Make start chat trigger globally available
window.startDirectChat = startChatWithUser;

// Date Formatter helpers
function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatClockTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}
