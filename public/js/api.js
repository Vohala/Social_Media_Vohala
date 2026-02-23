// ============================================================
// API.JS — Fetch wrapper + all API calls
// ============================================================

const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(API_BASE + path, {
      ...options,
      headers,
      body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined)
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      showAuthPage('login');
      return null;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    console.error('API Error:', path, err.message);
    throw err;
  }
}

// Auth
const AuthAPI = {
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) => apiFetch('/auth/register', { method: 'POST', body: { name, email, password } }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
  me: () => apiFetch('/auth/me'),
  changePassword: (currentPassword, newPassword) => apiFetch('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  deleteAccount: (password) => apiFetch('/auth/account', { method: 'DELETE', body: { password } }),
};

// Posts
const PostsAPI = {
  feed: (page = 1) => apiFetch(`/posts/feed?page=${page}`),
  get: (id) => apiFetch(`/posts/${id}`),
  create: (formData) => apiFetch('/posts', { method: 'POST', body: formData, headers: {} }),
  update: (id, data) => apiFetch(`/posts/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiFetch(`/posts/${id}`, { method: 'DELETE' }),
  react: (id, reaction_type) => apiFetch(`/posts/${id}/react`, { method: 'POST', body: { reaction_type } }),
  reactions: (id) => apiFetch(`/posts/${id}/reactions`),
  comments: (id) => apiFetch(`/posts/${id}/comments`),
  addComment: (id, content, parent_id) => apiFetch(`/posts/${id}/comments`, { method: 'POST', body: { content, parent_id } }),
  editComment: (id, content) => apiFetch(`/posts/comments/${id}`, { method: 'PUT', body: { content } }),
  deleteComment: (id) => apiFetch(`/posts/comments/${id}`, { method: 'DELETE' }),
  commentReact: (id, reaction_type) => apiFetch(`/posts/comments/${id}/react`, { method: 'POST', body: { reaction_type } }),
  replies: (commentId) => apiFetch(`/posts/comments/${commentId}/replies`),
  share: (id, content, privacy) => apiFetch(`/posts/${id}/share`, { method: 'POST', body: { content, privacy } }),
  save: (id) => apiFetch(`/posts/${id}/save`, { method: 'POST' }),
  saved: () => apiFetch('/posts/saved/list'),
};

// Users
const UsersAPI = {
  get: (id) => apiFetch(`/users/${id}`),
  update: (id, data) => apiFetch(`/users/${id}`, { method: 'PUT', body: data }),
  uploadAvatar: (id, formData) => apiFetch(`/users/${id}/avatar`, { method: 'POST', body: formData, headers: {} }),
  uploadCover: (id, formData) => apiFetch(`/users/${id}/cover`, { method: 'POST', body: formData, headers: {} }),
  posts: (id, page = 1) => apiFetch(`/users/${id}/posts?page=${page}`),
  photos: (id) => apiFetch(`/users/${id}/photos`),
  friends: (id) => apiFetch(`/users/${id}/friends`),
  follow: (id) => apiFetch(`/users/${id}/follow`, { method: 'POST' }),
  block: (id) => apiFetch(`/users/${id}/block`, { method: 'POST' }),
  blockedList: () => apiFetch('/users/blocked/list'),
};

// Friends
const FriendsAPI = {
  requests: () => apiFetch('/friends/requests'),
  sent: () => apiFetch('/friends/sent'),
  list: () => apiFetch('/friends/list'),
  suggestions: () => apiFetch('/friends/suggestions'),
  sendRequest: (uid) => apiFetch(`/friends/request/${uid}`, { method: 'POST' }),
  accept: (uid) => apiFetch(`/friends/accept/${uid}`, { method: 'PUT' }),
  reject: (uid) => apiFetch(`/friends/reject/${uid}`, { method: 'DELETE' }),
  cancel: (uid) => apiFetch(`/friends/cancel/${uid}`, { method: 'DELETE' }),
  unfriend: (uid) => apiFetch(`/friends/${uid}`, { method: 'DELETE' }),
};

// Messages
const MessagesAPI = {
  conversations: () => apiFetch('/messages'),
  messages: (uid, before) => apiFetch(`/messages/${uid}${before ? '?before=' + before : ''}`),
  send: (uid, formData) => apiFetch(`/messages/${uid}`, { method: 'POST', body: formData, headers: {} }),
  delete: (id, deleteFor) => apiFetch(`/messages/${id}?deleteFor=${deleteFor}`, { method: 'DELETE' }),
};

// Notifications
const NotifAPI = {
  list: (page = 1) => apiFetch(`/notifications?page=${page}`),
  markAllRead: () => apiFetch('/notifications/read-all', { method: 'PUT' }),
  markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: 'PUT' }),
  delete: (id) => apiFetch(`/notifications/${id}`, { method: 'DELETE' }),
};

// Stories
const StoriesAPI = {
  list: () => apiFetch('/stories'),
  create: (formData) => apiFetch('/stories', { method: 'POST', body: formData, headers: {} }),
  view: (id) => apiFetch(`/stories/${id}/view`, { method: 'POST' }),
  viewers: (id) => apiFetch(`/stories/${id}/viewers`),
  react: (id, reaction_type) => apiFetch(`/stories/${id}/react`, { method: 'POST', body: { reaction_type } }),
  delete: (id) => apiFetch(`/stories/${id}`, { method: 'DELETE' }),
};

// Groups
const GroupsAPI = {
  list: () => apiFetch('/groups'),
  get: (id) => apiFetch(`/groups/${id}`),
  create: (formData) => apiFetch('/groups', { method: 'POST', body: formData, headers: {} }),
  join: (id) => apiFetch(`/groups/${id}/join`, { method: 'POST' }),
  leave: (id) => apiFetch(`/groups/${id}/leave`, { method: 'DELETE' }),
  posts: (id) => apiFetch(`/groups/${id}/posts`),
  createPost: (id, formData) => apiFetch(`/groups/${id}/posts`, { method: 'POST', body: formData, headers: {} }),
};

// Events
const EventsAPI = {
  list: () => apiFetch('/events'),
  get: (id) => apiFetch(`/events/${id}`),
  create: (formData) => apiFetch('/events', { method: 'POST', body: formData, headers: {} }),
  rsvp: (id, response) => apiFetch(`/events/${id}/rsvp`, { method: 'POST', body: { response } }),
};

// Marketplace
const MarketAPI = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/marketplace${q ? '?' + q : ''}`);
  },
  get: (id) => apiFetch(`/marketplace/${id}`),
  create: (formData) => apiFetch('/marketplace', { method: 'POST', body: formData, headers: {} }),
  markSold: (id) => apiFetch(`/marketplace/${id}/mark-sold`, { method: 'PUT' }),
  delete: (id) => apiFetch(`/marketplace/${id}`, { method: 'DELETE' }),
};

// Search
const SearchAPI = {
  search: (q, type = 'all') => apiFetch(`/search?q=${encodeURIComponent(q)}&type=${type}`),
};
