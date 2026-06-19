import { AIService } from './ai-service.js';

export function initAIAssistant(showToast) {
  // Select DOM Elements
  const aiChatForm = document.getElementById('aiChatForm');
  const aiChatInput = document.getElementById('aiChatInput');
  const aiChatMessages = document.getElementById('aiChatMessages');
  const aiClearChatBtn = document.getElementById('aiClearChatBtn');
  const aiApiKeyAlert = document.getElementById('aiApiKeyAlert');
  const aiConfigOpenBtn = document.getElementById('aiConfigOpenBtn');
  const configModal = document.getElementById('configModal');
  const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
  const configForm = document.getElementById('configForm');

  // Suggestion chips
  const suggestionCards = document.querySelectorAll('.ai-suggestion-card');

  // Auto-Fill Elements in Add Resource Modal
  const aiAutoFillBtn = document.getElementById('aiAutoFillBtn');
  const resourceTitleInput = document.getElementById('resourceTitle');
  const resourceCategorySelect = document.getElementById('resourceCategory');
  const resourceQuantityInput = document.getElementById('resourceQuantity');
  const resourceDescriptionInput = document.getElementById('resourceDescription');

  // Initialize UI Values
  if (geminiApiKeyInput) {
    geminiApiKeyInput.value = AIService.getApiKey();
  }
  updateAIStatusUI();

  // --- Chat History Persistence ---
  const CHAT_HISTORY_KEY = 'EcoCircle_chat_history';

  function saveChatHistory() {
    const messages = [];
    aiChatMessages.querySelectorAll('.chat-msg').forEach(msg => {
      const isUser = msg.classList.contains('chat-msg-user');
      const body = msg.querySelector('.chat-msg-body');
      if (body) {
        messages.push({ sender: isUser ? 'user' : 'partner', html: body.innerHTML });
      }
    });
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  }

  function loadChatHistory() {
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_KEY);
      if (!saved) return false;
      const messages = JSON.parse(saved);
      if (!messages || messages.length === 0) return false;
      aiChatMessages.innerHTML = '';
      messages.forEach(({ sender, html }) => {
        const isUser = sender === 'user';
        const messageRow = document.createElement('div');
        messageRow.className = `chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-partner'}`;
        messageRow.style.display = 'flex';
        messageRow.style.gap = '0.75rem';
        messageRow.style.alignItems = 'flex-start';
        messageRow.style.maxWidth = '85%';
        if (isUser) {
          messageRow.style.alignSelf = 'flex-end';
          messageRow.style.marginLeft = 'auto';
        } else {
          messageRow.style.alignSelf = 'flex-start';
          messageRow.style.marginRight = 'auto';
        }
        const avatarHtml = isUser ? '' : `<div class="chat-msg-avatar" style="width: 32px; height: 32px; border-radius: 50%; background-color: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">AI</div>`;
        const bubbleStyle = isUser
          ? 'background: linear-gradient(135deg, var(--primary) 0%, var(--primary-medium) 100%); color: white; border-radius: 16px 0px 16px 16px;'
          : 'background-color: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 0px 16px 16px 16px;';
        messageRow.innerHTML = `${avatarHtml}<div class="chat-msg-body" style="${bubbleStyle} padding: 0.9rem 1.25rem; font-size: 0.9rem; line-height: 1.5; box-shadow: var(--shadow-sm);">${html}</div>`;
        aiChatMessages.appendChild(messageRow);
      });
      aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
      return true;
    } catch(e) {
      console.warn('Could not load chat history:', e);
      return false;
    }
  }

  // Load saved chat history on start
  loadChatHistory();


  // Save key on DB config save
  if (configForm) {
    configForm.addEventListener('submit', () => {
      if (geminiApiKeyInput) {
        AIService.saveApiKey(geminiApiKeyInput.value);
        updateAIStatusUI();
      }
    });
  }

  // Hook up Database Settings clear
  const disconnectCloudBtn = document.getElementById('disconnectCloudBtn');
  if (disconnectCloudBtn) {
    disconnectCloudBtn.addEventListener('click', () => {
      AIService.saveApiKey('');
      if (geminiApiKeyInput) geminiApiKeyInput.value = '';
      updateAIStatusUI();
    });
  }

  // Update AI live banner indicator
  function updateAIStatusUI() {
    if (AIService.isLive()) {
      if (aiApiKeyAlert) {
        aiApiKeyAlert.style.display = 'none';
      }
      const titleLabel = document.getElementById('aiHeadingTitle');
      if (titleLabel) {
        titleLabel.innerHTML = 'EcoCircle AI Assistant <span style="background-color: var(--accent); color: white; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.65rem; margin-left: 0.5rem; font-weight: 700; text-transform: uppercase;">Live</span>';
      }
    } else {
      if (aiApiKeyAlert) {
        aiApiKeyAlert.style.display = 'block';
      }
      const titleLabel = document.getElementById('aiHeadingTitle');
      if (titleLabel) {
        titleLabel.innerHTML = 'EcoCircle AI Assistant <span style="background-color: var(--status-pending); color: white; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.65rem; margin-left: 0.5rem; font-weight: 700; text-transform: uppercase;">Offline Sim</span>';
      }
    }
  }

  // AI config button promo
  if (aiConfigOpenBtn && configModal) {
    aiConfigOpenBtn.addEventListener('click', () => {
      configModal.classList.add('active');
    });
  }

  // Clear Chat Button
  if (aiClearChatBtn) {
    aiClearChatBtn.addEventListener('click', () => {
      if (confirm('Clear the AI Assistant conversation?')) {
        localStorage.removeItem(CHAT_HISTORY_KEY);
        aiChatMessages.innerHTML = `
          <div class="chat-msg chat-msg-partner" style="display: flex; gap: 0.75rem; align-items: flex-start; max-width: 85%;">
            <div class="chat-msg-avatar" style="width: 32px; height: 32px; border-radius: 50%; background-color: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">AI</div>
            <div class="chat-msg-body" style="background-color: var(--primary-light); color: var(--text-main); padding: 0.9rem 1.25rem; border-radius: 0 16px 16px 16px; font-size: 0.9rem; line-height: 1.5; box-shadow: var(--shadow-sm);">
              Hi there! I am your EcoCircle AI Assistant. 🌟 <br><br>
              Ask me anything about:
              <ul style="margin-left: 1.25rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                <li>Recycling rules and preparation</li>
                <li>Composting techniques for beginners</li>
                <li>Upcycling household objects</li>
                <li>Estimating Carbon Footprint (CO2) savings</li>
              </ul>
            </div>
          </div>
        `;
        saveChatHistory();
      }
    });
  }

  // Handle suggestion chips clicks
  suggestionCards.forEach(card => {
    card.addEventListener('click', () => {
      const prompt = card.getAttribute('data-prompt');
      if (prompt) {
        sendUserQuery(prompt);
      }
    });
  });

  // Submit form chat handler
  if (aiChatForm) {
    aiChatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = aiChatInput.value.trim();
      if (!text) return;
      aiChatInput.value = '';
      sendUserQuery(text);
    });
  }

  // Function to send user query to AI and render response
  async function sendUserQuery(text) {
    // 1. Render user message
    renderMessage(text, 'user');
    
    // 2. Render typing indicator
    const typingIndicatorId = showTypingIndicator();

    try {
      // 3. Request Gemini API
      const response = await AIService.askGemini(text);
      
      // 4. Remove typing indicator
      removeTypingIndicator(typingIndicatorId);

      // 5. Render AI response with formatting support
      renderMessage(response, 'partner');
    } catch (e) {
      removeTypingIndicator(typingIndicatorId);
      renderMessage(`Sorry, I encountered an error: ${e.message}`, 'partner');
      showToast('AI Query Failed', 'error');
    }
  }

  function renderMessage(text, sender) {
    const isUser = sender === 'user';
    const messageRow = document.createElement('div');
    messageRow.className = `chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-partner'}`;
    
    // Inline styling to align user messages right, partner left
    messageRow.style.display = 'flex';
    messageRow.style.gap = '0.75rem';
    messageRow.style.alignItems = 'flex-start';
    messageRow.style.maxWidth = '85%';
    
    if (isUser) {
      messageRow.style.alignSelf = 'flex-end';
      messageRow.style.marginLeft = 'auto';
    } else {
      messageRow.style.alignSelf = 'flex-start';
      messageRow.style.marginRight = 'auto';
    }

    const avatarHtml = isUser 
      ? '' 
      : `<div class="chat-msg-avatar" style="width: 32px; height: 32px; border-radius: 50%; background-color: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">AI</div>`;

    // Process markdown-like formatting for AI responses
    let formattedText = text;
    if (!isUser) {
      formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background-color: rgba(0,0,0,0.06); padding: 0.1rem 0.3rem; border-radius: 4px; font-family: monospace;">$1</code>');
    } else {
      // Escape HTML for user input
      const temp = document.createElement('div');
      temp.textContent = text;
      formattedText = temp.innerHTML.replace(/\n/g, '<br>');
    }

    const bubbleStyle = isUser
      ? 'background: linear-gradient(135deg, var(--primary) 0%, var(--primary-medium) 100%); color: white; border-radius: 16px 0px 16px 16px;'
      : 'background-color: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 0px 16px 16px 16px;';

    messageRow.innerHTML = `
      ${avatarHtml}
      <div class="chat-msg-body" style="${bubbleStyle} padding: 0.9rem 1.25rem; font-size: 0.9rem; line-height: 1.5; box-shadow: var(--shadow-sm);">
        ${formattedText}
      </div>
    `;

    aiChatMessages.appendChild(messageRow);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    saveChatHistory();
  }

  function showTypingIndicator() {
    const indicatorId = 'typing-' + Date.now();
    const messageRow = document.createElement('div');
    messageRow.id = indicatorId;
    messageRow.className = 'chat-msg chat-msg-partner';
    messageRow.style.display = 'flex';
    messageRow.style.gap = '0.75rem';
    messageRow.style.alignItems = 'flex-start';
    messageRow.style.maxWidth = '85%';
    messageRow.style.alignSelf = 'flex-start';

    messageRow.innerHTML = `
      <div class="chat-msg-avatar" style="width: 32px; height: 32px; border-radius: 50%; background-color: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0;">AI</div>
      <div class="chat-msg-body" style="background-color: var(--bg-card); color: var(--text-muted); border: 1px solid var(--border-color); padding: 0.9rem 1.25rem; border-radius: 0px 16px 16px 16px; font-size: 0.9rem; display: flex; align-items: center; gap: 0.35rem; box-shadow: var(--shadow-sm);">
        <span class="ai-typing-dot"></span>
        <span class="ai-typing-dot" style="animation-delay: 0.2s;"></span>
        <span class="ai-typing-dot" style="animation-delay: 0.4s;"></span>
      </div>
    `;

    aiChatMessages.appendChild(messageRow);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    return indicatorId;
  }

  function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
      indicator.remove();
    }
  }

  // --- AI Auto-Fill Functionality ---
  if (aiAutoFillBtn) {
    aiAutoFillBtn.addEventListener('click', async () => {
      const title = resourceTitleInput.value.trim();
      if (!title) {
        showToast('Please enter an item title first!', 'warning');
        return;
      }

      const originalBtnText = aiAutoFillBtn.innerHTML;
      aiAutoFillBtn.disabled = true;
      aiAutoFillBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="animation: spin 1.5s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="6.34" y1="17.66" x2="9.17" y2="14.83"></line><line x1="14.83" y1="9.17" x2="17.66" y2="6.34"></line></svg>
        <span>AI Generating...</span>
      `;

      showToast('AI is describing and categorizing your item...', 'info');

      try {
        const details = await AIService.autoFillResource(title);
        
        // Populate fields with animated highlights
        if (resourceCategorySelect && details.category) {
          resourceCategorySelect.value = details.category;
          triggerHighlight(resourceCategorySelect);
        }
        if (resourceQuantityInput && details.quantity) {
          resourceQuantityInput.value = details.quantity;
          triggerHighlight(resourceQuantityInput);
        }
        if (resourceDescriptionInput && details.description) {
          // Append carbon estimate explicitly into description or display it
          let fullDesc = details.description;
          if (details.co2Offset > 0) {
            fullDesc += `\n\n[Estimated Carbon Offset: ${details.co2Offset.toFixed(1)} kg CO2 saved by sharing this item instead of purchasing new!]`;
          }
          resourceDescriptionInput.value = fullDesc;
          triggerHighlight(resourceDescriptionInput);
        }

        showToast('Item details auto-populated by AI!', 'success');
      } catch (err) {
        console.error(err);
        showToast('AI Auto-Fill failed: ' + err.message, 'error');
      } finally {
        aiAutoFillBtn.disabled = false;
        aiAutoFillBtn.innerHTML = originalBtnText;
      }
    });
  }

  function triggerHighlight(element) {
    element.classList.add('ai-highlight-fill');
    setTimeout(() => {
      element.classList.remove('ai-highlight-fill');
    }, 1500);
  }
}
