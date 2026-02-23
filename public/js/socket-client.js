// ============================================================
// SOCKET-CLIENT.JS — Socket.io client
// ============================================================

let socket = null;

function initSocket(userId) {
  if (socket) socket.disconnect();
  socket = io({
    transports: ['websocket', 'polling'],  // websocket first — faster
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000
  });

  socket.on('connect', () => {
    socket.emit('user_online', userId);
    console.log('✅ Socket connected');
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connect error:', err.message);
  });

  socket.on('reconnect', (attempt) => {
    socket.emit('user_online', userId);
    console.log('🔄 Socket reconnected after', attempt, 'attempt(s)');
  });

  socket.on('user_status', ({ userId: uid, online }) => {
    // Update online indicators
    document.querySelectorAll(`[data-user-id="${uid}"] .online-dot`).forEach(dot => {
      dot.style.display = online ? 'block' : 'none';
    });
    document.querySelectorAll(`[data-user-id="${uid}"] .chat-user-status`).forEach(el => {
      el.textContent = online ? 'Active now' : 'Offline';
      el.className = 'chat-user-status' + (online ? ' online' : '');
    });
  });

  socket.on('new_message', (message) => {
    // Update conversation list
    window._conversationListUpdate && window._conversationListUpdate(message);
    // If we're in the active chat with this sender, append and mark as read
    if (window._activeChatUserId && String(window._activeChatUserId) === String(message.sender_id)) {
      window._appendChatMessage && window._appendChatMessage(message, false);
      socket.emit('message_read', { senderId: message.sender_id, receiverId: window.currentUser.id });
    } else {
      // Increment message badge
      window._msgBadgeCount = (window._msgBadgeCount || 0) + 1;
      updateMessageBadge(window._msgBadgeCount);
      // Show toast popup for the new message
      const senderName = message.sender_name || 'New message';
      const preview = (message.content || '📎 Media').slice(0, 60);
      showToast(`💬 ${senderName}: ${preview}`, 'info', 5000);
    }
  });

  socket.on('typing_start', ({ senderId }) => {
    if (window._activeChatUserId === senderId) {
      window._showTypingIndicator && window._showTypingIndicator();
    }
  });

  socket.on('typing_stop', ({ senderId }) => {
    if (window._activeChatUserId === senderId) {
      window._hideTypingIndicator && window._hideTypingIndicator();
    }
  });

  socket.on('messages_read', ({ readBy }) => {
    if (window._activeChatUserId === readBy) {
      window._markMessagesRead && window._markMessagesRead();
    }
  });

  socket.on('new_notification', (notif) => {
    window._notifCount = (window._notifCount || 0) + 1;
    updateNotifBadge(window._notifCount);
    showToast(notif.message, 'info', 4000);
  });

  socket.on('post_reaction_update', ({ postId, reactions, userReaction }) => {
    // Update post reactions in the feed without re-render
    const postEl = document.querySelector(`[data-post-id="${postId}"]`);
    if (postEl) {
      const reactionBar = postEl.querySelector('.reaction-pills');
      if (reactionBar) {
        const total = reactions.reduce((s, r) => s + r.count, 0);
        reactionBar.innerHTML = renderReactionPills(reactions, total);
      }
    }
  });

  socket.on('friend_accepted', ({ userId: uid }) => {
    showToast('A friend request was accepted!', 'success');
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function emitTypingStart(receiverId) {
  if (socket && window.currentUser) {
    socket.emit('typing_start', { senderId: window.currentUser.id, receiverId });
  }
}

function emitTypingStop(receiverId) {
  if (socket && window.currentUser) {
    socket.emit('typing_stop', { senderId: window.currentUser.id, receiverId });
  }
}

function updateNotifBadge(count) {
  const badges = ['notif-badge', 'bnav-notif-badge'];
  badges.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (count > 0) {
        el.textContent = count > 99 ? '99+' : count;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });
}

function updateMessageBadge(count) {
  const badges = ['msg-badge', 'bnav-msg-badge'];
  badges.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (count > 0) {
        el.textContent = count > 99 ? '99+' : count;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });
}

function updateFriendBadge(count) {
  const badges = ['friend-req-badge', 'bnav-friend-badge'];
  badges.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (count > 0) {
        el.textContent = count;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });
}

function renderReactionPills(reactions, total) {
  if (!total) return '';
  const topReactions = reactions.sort((a, b) => b.count - a.count).slice(0, 3);
  const emojis = { like: '👍', love: '❤️', haha: '😆', wow: '😮', sad: '😢', angry: '😡' };
  const pills = topReactions.map(r => `<span class="reaction-pill">${emojis[r.reaction_type] || '👍'}</span>`).join('');
  return pills + `<span class="reaction-count">${total}</span>`;
}
