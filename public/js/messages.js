// ============================================================
// MESSAGES.JS — Chat UI, typing indicators, real-time
// ============================================================

let typingTimeout = null;
let chatFile = null;

async function renderMessagesPage(container, params) {
  container.innerHTML = `
    <div class="messages-page-wrap">
      <div class="messages-layout" id="messages-layout">
        <div class="conv-list" id="conv-list-panel">
          <div class="conv-list-header">
            <h3>Messages</h3>
          </div>
          <div class="conv-search">
            <input type="text" id="conv-search-input" placeholder="Search Messenger..." oninput="filterConversations(this.value)">
          </div>
          <div class="conv-items" id="conv-items">
            <div class="loading-center"><div class="spinner"></div></div>
          </div>
        </div>
        <div class="chat-panel" id="chat-panel-area">
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text3)">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="opacity:0.3;margin-bottom:16px"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            <h3 style="color:var(--text2)">Select a conversation</h3>
          </div>
        </div>
      </div>
    </div>
  `;

  loadConversations();
  window._msgBadgeCount = 0;
  updateMessageBadge(0);

  // Register socket handlers
  window._conversationListUpdate = (message) => {
    const items = document.getElementById('conv-items');
    if (!items) return;
    // Move or add conversation to top
    const existing = items.querySelector(`[data-conv-uid="${message.sender_id}"]`);
    const otherUser = message.sender_id !== window.currentUser?.id ? message.sender_id : message.receiver_id;
    if (existing) {
      const lastMsg = existing.querySelector('.conv-last-msg');
      if (lastMsg) lastMsg.textContent = message.content || '📎 Media';
      const unread = existing.querySelector('.conv-unread');
      if (!window._activeChatUserId || window._activeChatUserId !== otherUser) {
        existing.classList.add('conv-unread');
      }
      items.prepend(existing);
    } else {
      loadConversations();
    }
  };

  if (params.userId) {
    openChat(params.userId);
  }
}

let allConversations = [];

async function loadConversations() {
  const items = document.getElementById('conv-items');
  if (!items) return;
  try {
    const conversations = await MessagesAPI.conversations();
    allConversations = conversations || [];
    renderConversationList(allConversations);
  } catch (e) {
    items.innerHTML = '<div class="empty-state"><h3>Failed to load</h3></div>';
  }
}

function renderConversationList(conversations) {
  const items = document.getElementById('conv-items');
  if (!items) return;
  if (!conversations.length) {
    items.innerHTML = '<div class="empty-state" style="padding:32px"><h3>No conversations yet</h3><p>Start a conversation with a friend!</p></div>';
    return;
  }
  items.innerHTML = conversations.map(c => {
    const init = (c.name || '?')[0].toUpperCase();
    const av = c.avatar ? `<img src="${escapeHtml(c.avatar)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover">` : `<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px">${init}</div>`;
    const isUnread = c.unread_count > 0;
    const lastMsg = c.last_message || (c.last_media_type ? '📎 Media' : '');
    const time = c.last_message_time ? (isToday(c.last_message_time) ? formatTime(c.last_message_time) : timeAgo(c.last_message_time)) : '';
    return `
      <div class="conv-item ${isUnread ? 'conv-unread' : ''}" data-conv-uid="${c.id}" onclick="openChat(${c.id})">
        <div style="position:relative">
          ${av}
          ${c.is_online ? '<span class="online-dot"></span>' : ''}
        </div>
        <div class="conv-info">
          <div class="conv-name">${escapeHtml(c.name)}</div>
          <div class="conv-last-msg">${escapeHtml(lastMsg)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div class="conv-time">${time}</div>
          ${isUnread ? `<div style="width:10px;height:10px;background:var(--primary);border-radius:50%"></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterConversations(q) {
  const filtered = q ? allConversations.filter(c => (c.name || '').toLowerCase().includes(q.toLowerCase())) : allConversations;
  renderConversationList(filtered);
}

async function openChat(userId) {
  userId = Number(userId);  // normalize to number
  window._activeChatUserId = userId;
  const layout = document.getElementById('messages-layout');
  if (layout) layout.classList.add('chat-open');

  // Mark conv as active
  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-conv-uid="${userId}"]`)?.classList.add('active');
  document.querySelector(`[data-conv-uid="${userId}"]`)?.classList.remove('conv-unread');

  const chatPanel = document.getElementById('chat-panel-area');
  if (!chatPanel) return;
  chatPanel.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

  try {
    const user = await UsersAPI.get(userId);
    const messages = await MessagesAPI.messages(userId);

    const init = (user.name || '?')[0].toUpperCase();
    const av = user.avatar ? `<img src="${escapeHtml(user.avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover">` : `<div class="avatar md"><div class="avatar-inner md">${init}</div></div>`;

    chatPanel.innerHTML = `
      <div class="chat-header">
        <button class="nav-icon-btn back-btn" onclick="closeChat()">‹</button>
        <div onclick="navigate('profile',{id:${user.id}})" style="cursor:pointer">${av}</div>
        <div>
          <div class="chat-user-name">${escapeHtml(user.name)}</div>
          <div class="chat-user-status ${user.is_online ? 'online' : ''}" data-user-id="${user.id}">${user.is_online ? 'Active now' : (user.last_seen ? 'Last seen ' + timeAgo(user.last_seen) : 'Offline')}</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:4px">
          <button class="nav-icon-btn" onclick="navigate('messages',{userId:${user.id}})" title="Video call (coming soon)">📹</button>
          <button class="nav-icon-btn" onclick="navigate('profile',{id:${user.id}})" title="View profile">👤</button>
        </div>
      </div>

      <div class="chat-messages" id="chat-messages-${userId}">
        ${renderMessages(messages, userId)}
        <div id="typing-indicator-${userId}" style="display:none">${renderTypingIndicator()}</div>
      </div>

      <div class="chat-input-area">
        <label class="nav-icon-btn" title="Attach media" style="cursor:pointer">
          📎
          <input type="file" id="chat-file-input" accept="image/*,video/*" style="display:none" onchange="handleChatFile(this)">
        </label>
        <div class="chat-input-wrap">
          <textarea id="chat-textarea" placeholder="Aa" rows="1" style="overflow:hidden;line-height:1.4"
            oninput="autoResizeTextarea(this);handleTyping(${userId})"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChatMessage(${userId})}"></textarea>
        </div>
        <button class="chat-send-btn" onclick="sendChatMessage(${userId})">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div id="chat-file-preview" style="padding:0 14px 4px;display:none">
        <div style="position:relative;display:inline-block">
          <img id="chat-file-img" style="max-height:80px;border-radius:8px;max-width:120px">
          <button onclick="clearChatFile()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;background:#e53935;color:white;border-radius:50%;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>
        </div>
      </div>
    `;

    // Scroll to bottom
    const msgs = document.getElementById(`chat-messages-${userId}`);
    if (msgs) msgs.scrollTop = msgs.scrollHeight;

    // Register socket handlers
    window._appendChatMessage = (msg, isMine) => {
      const msgs = document.getElementById(`chat-messages-${userId}`);
      if (!msgs) return;
      const typingEl = document.getElementById(`typing-indicator-${userId}`);
      if (typingEl) typingEl.style.display = 'none';
      msgs.insertAdjacentHTML('beforeend', renderSingleMessage(msg, isMine));
      msgs.scrollTop = msgs.scrollHeight;
    };

    window._showTypingIndicator = () => {
      const el = document.getElementById(`typing-indicator-${userId}`);
      if (el) {
        el.style.display = 'block';
        const msgs = document.getElementById(`chat-messages-${userId}`);
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      }
    };

    window._hideTypingIndicator = () => {
      const el = document.getElementById(`typing-indicator-${userId}`);
      if (el) el.style.display = 'none';
    };

    window._markMessagesRead = () => {
      document.querySelectorAll('.msg-status').forEach(el => { el.textContent = '✓✓'; });
    };

  } catch (e) {
    chatPanel.innerHTML = '<div class="empty-state"><h3>Failed to load chat</h3></div>';
  }
}

function renderMessages(messages, otherUserId) {
  if (!messages || !messages.length) return '<div style="text-align:center;color:var(--text3);padding:24px;font-size:14px">No messages yet. Say hello! 👋</div>';
  let html = '';
  let prevSenderId = null;
  for (const msg of messages) {
    const isMine = msg.sender_id === window.currentUser?.id;
    html += renderSingleMessage(msg, isMine, msg.sender_id !== prevSenderId);
    prevSenderId = msg.sender_id;
  }
  return html;
}

function renderSingleMessage(msg, isMine, showAvatar = true) {
  const groupClass = isMine ? 'me' : 'them';
  const timeStr = formatTime(msg.created_at);
  let content = '';
  if (msg.deleted_for_everyone) {
    content = `<div class="chat-msg" style="font-style:italic;opacity:0.6">🚫 Message deleted</div>`;
  } else if (msg.media_url) {
    const isVideo = msg.media_type === 'video';
    content = `<div class="chat-msg-media" onclick="openLightbox([{url:'${escapeHtml(msg.media_url)}',type:'${isVideo ? 'video' : 'image'}'}],0)">
      ${isVideo ? `<video src="${escapeHtml(msg.media_url)}" style="max-width:240px;border-radius:12px"></video>` : `<img src="${escapeHtml(msg.media_url)}" alt="Media">`}
    </div>`;
    if (msg.content) content += `<div class="chat-msg">${escapeHtml(msg.content)}</div>`;
  } else {
    content = `<div class="chat-msg">${escapeHtml(msg.content)}</div>`;
  }
  return `<div class="chat-msg-group ${groupClass}" data-msg-id="${msg.id}">
    ${content}
    <div class="chat-msg-time">${timeStr}${isMine ? ` <span class="msg-status">${msg.is_read ? '✓✓' : '✓'}</span>` : ''}</div>
  </div>`;
}

function renderTypingIndicator() {
  return `<div class="chat-msg-group them"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
}

function handleChatFile(input) {
  const file = input.files[0];
  if (!file) return;
  chatFile = file;
  const preview = document.getElementById('chat-file-preview');
  const img = document.getElementById('chat-file-img');
  if (preview && img) {
    img.src = URL.createObjectURL(file);
    preview.style.display = 'block';
  }
}

function clearChatFile() {
  chatFile = null;
  const preview = document.getElementById('chat-file-preview');
  if (preview) preview.style.display = 'none';
  const input = document.getElementById('chat-file-input');
  if (input) input.value = '';
}

async function sendChatMessage(receiverId) {
  const textarea = document.getElementById('chat-textarea');
  const content = textarea?.value.trim();
  if (!content && !chatFile) return;

  const formData = new FormData();
  if (content) formData.append('content', content);
  if (chatFile) formData.append('media', chatFile);

  if (textarea) { textarea.value = ''; textarea.style.height = ''; }
  clearChatFile();
  emitTypingStop(receiverId);

  try {
    const msg = await MessagesAPI.send(receiverId, formData);
    window._appendChatMessage && window._appendChatMessage(msg, true);
    // Also update socket
    if (socket) socket.emit('send_message', { ...msg, receiverId });
  } catch (e) { showToast('Failed to send', 'error'); }
}

function handleTyping(receiverId) {
  emitTypingStart(receiverId);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => emitTypingStop(receiverId), 2000);
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

function closeChat() {
  window._activeChatUserId = null;
  const layout = document.getElementById('messages-layout');
  if (layout) layout.classList.remove('chat-open');
}
