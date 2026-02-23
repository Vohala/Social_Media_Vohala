// ============================================================
// AUTH.JS — Login / Register pages
// ============================================================

function showAuthPage(mode = 'login') {
  document.getElementById('top-nav').style.display = 'none';
  document.getElementById('bottom-nav').style.display = 'none';
  document.getElementById('app-wrapper').style.display = 'none';
  const authPage = document.getElementById('auth-page');
  authPage.style.display = 'flex';

  if (mode === 'login') renderLoginPage();
  else renderRegisterPage();
}

function renderLoginPage() {
  document.getElementById('auth-content').innerHTML = `
    <div class="auth-content">
      <div class="auth-logo">
        <div class="logo-v">V</div>
        <h1>Vohala</h1>
        <p>Connect with friends and the world around you.</p>
      </div>
      <div class="auth-card">
        <h2>Sign In</h2>
        <p>Welcome back! Sign in to your account.</p>
        <form id="login-form">
          <div class="form-group">
            <label>Email address</label>
            <input type="email" id="login-email" class="form-input" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="login-password" class="form-input" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <div id="login-error" class="form-error" style="margin-bottom:10px"></div>
          <button type="submit" class="btn-primary" id="login-btn">Sign In</button>
        </form>
        <div class="auth-switch">
          <span>Don't have an account? </span>
          <a href="#" onclick="renderRegisterPage(); return false">Create Account</a>
        </div>
        <div style="margin-top:14px;padding:12px;background:var(--input-bg);border-radius:8px;font-size:13px;color:var(--text2)">
          <strong>Demo accounts:</strong><br/>
          rahul@demo.com / demo123<br/>
          priya@demo.com / demo123
        </div>
      </div>
      <div class="auth-footer">Made with ❤️ in India 🇮🇳 · <a href="#">Privacy</a> · <a href="#">Terms</a></div>
    </div>
  `;

  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errEl.textContent = '';
    try {
      const data = await AuthAPI.login(
        document.getElementById('login-email').value.trim(),
        document.getElementById('login-password').value
      );
      if (data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.currentUser = data.user;
        showAppUI();
        navigate('feed');
        initSocket(data.user.id);
      }
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

function renderRegisterPage() {
  document.getElementById('auth-content').innerHTML = `
    <div class="auth-content">
      <div class="auth-logo">
        <div class="logo-v">V</div>
        <h1>Vohala</h1>
        <p>Join millions of people sharing their world.</p>
      </div>
      <div class="auth-card">
        <h2>Create Account</h2>
        <p>Fill in your details to get started.</p>
        <form id="register-form">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="reg-name" class="form-input" placeholder="Your full name" required autocomplete="name" />
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" id="reg-email" class="form-input" placeholder="you@example.com" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="reg-password" class="form-input" placeholder="Min. 6 characters" required autocomplete="new-password" />
          </div>
          <div id="register-error" class="form-error" style="margin-bottom:10px"></div>
          <button type="submit" class="btn-primary" id="register-btn">Create Account</button>
        </form>
        <div class="auth-switch">
          <span>Already have an account? </span>
          <a href="#" onclick="renderLoginPage(); return false">Sign In</a>
        </div>
      </div>
      <div class="auth-footer">Made with ❤️ in India 🇮🇳 · <a href="#">Privacy</a> · <a href="#">Terms</a></div>
    </div>
  `;

  const form = document.getElementById('register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    errEl.textContent = '';
    try {
      const data = await AuthAPI.register(
        document.getElementById('reg-name').value.trim(),
        document.getElementById('reg-email').value.trim(),
        document.getElementById('reg-password').value
      );
      if (data) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.currentUser = data.user;
        showAppUI();
        navigate('feed');
        initSocket(data.user.id);
        showToast('Welcome to Vohala! 🎉', 'success');
      }
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

function showAppUI() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('top-nav').style.display = 'flex';
  document.getElementById('app-wrapper').style.display = 'block';
  if (window.innerWidth <= 768) {
    document.getElementById('bottom-nav').style.display = 'flex';
  }
  updateNavAvatar();
}

function updateNavAvatar() {
  const user = window.currentUser;
  if (!user) return;
  const initial = (user.name || user.username || '?')[0].toUpperCase();

  ['nav-avatar-img', 'bnav-avatar-img'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (user.avatar) {
      el.innerHTML = `<img src="${escapeHtml(user.avatar)}" alt="Me" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
    } else {
      el.textContent = initial;
    }
  });

  const pmUser = document.getElementById('profile-menu-user');
  if (pmUser) {
    pmUser.innerHTML = `<div class="name">${escapeHtml(user.name)}</div><div class="email">${escapeHtml(user.email)}</div>`;
  }
}

async function logout() {
  try { await AuthAPI.logout(); } catch (e) {}
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.currentUser = null;
  disconnectSocket();
  document.getElementById('profile-menu').classList.add('hidden');
  showAuthPage('login');
}

function toggleProfileMenu() {
  const menu = document.getElementById('profile-menu');
  const notifDrop = document.getElementById('notification-dropdown');
  notifDrop.classList.add('hidden');
  menu.classList.toggle('hidden');

  const user = window.currentUser;
  if (user && !menu.classList.contains('hidden')) {
    const pmUser = document.getElementById('profile-menu-user');
    const initial = (user.name || '?')[0].toUpperCase();
    pmUser.innerHTML = `
      <div class="d-flex align-center gap-8">
        <div class="avatar md"><div class="avatar-inner md">${user.avatar ? `<img src="${escapeHtml(user.avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : initial}</div></div>
        <div>
          <div class="name">${escapeHtml(user.name)}</div>
          <div class="email" style="font-size:13px;color:var(--text3)">${escapeHtml(user.email)}</div>
        </div>
      </div>
    `;
  }

  const darkLabel = document.getElementById('dark-mode-label');
  if (darkLabel) darkLabel.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
  document.getElementById('profile-menu').classList.add('hidden');
}
