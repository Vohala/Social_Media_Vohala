// ============================================================
// MARKETPLACE.JS — Marketplace page
// ============================================================

async function renderMarketplacePage(container, params) {
  if (params.id) { renderMarketItemDetail(container, params.id); return; }

  container.innerHTML = `
    <div class="two-col-layout">
      <main>
        <div class="section-header">
          <h2>Marketplace</h2>
          <button class="btn-primary btn-sm" onclick="openCreateListingModal()">+ Sell Something</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <input type="text" class="form-input" id="market-search" placeholder="Search marketplace..." style="flex:1;min-width:180px" oninput="filterMarketplace(this.value)">
          <select class="form-input" id="market-category" style="width:auto" onchange="filterMarketplace()">
            <option value="">All Categories</option>
            <option value="electronics">📱 Electronics</option>
            <option value="furniture">🪑 Furniture</option>
            <option value="clothing">👕 Clothing</option>
            <option value="books">📚 Books</option>
            <option value="vehicles">🚗 Vehicles</option>
            <option value="other">📦 Other</option>
          </select>
        </div>
        <div id="marketplace-grid-container">
          <div class="loading-center"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;
  loadMarketplace();
}

let marketTimeout = null;

async function loadMarketplace(params = {}) {
  const container = document.getElementById('marketplace-grid-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
  try {
    const items = await MarketAPI.list(params);
    renderMarketGrid(items || []);
  } catch (e) {
    container.innerHTML = '<div class="empty-state"><h3>Failed to load</h3></div>';
  }
}

function filterMarketplace(search) {
  clearTimeout(marketTimeout);
  marketTimeout = setTimeout(() => {
    const q = search || document.getElementById('market-search')?.value || '';
    const category = document.getElementById('market-category')?.value || '';
    const params = {};
    if (q) params.search = q;
    if (category) params.category = category;
    loadMarketplace(params);
  }, 400);
}

function renderMarketGrid(items) {
  const container = document.getElementById('marketplace-grid-container');
  if (!container) return;
  if (!items.length) {
    container.innerHTML = '<div class="empty-state"><h3>No items found</h3><p>Be the first to list something!</p></div>';
    return;
  }
  container.innerHTML = `<div class="marketplace-grid">
    ${items.map(item => `
      <div class="market-card" onclick="navigate('marketplace',{id:${item.id}})">
        <div class="market-card-img">
          ${item.primary_photo ? `<img src="${escapeHtml(item.primary_photo)}" alt="${escapeHtml(item.title)}" loading="lazy">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:40px">📦</div>'}
        </div>
        <div class="market-card-info">
          <div class="market-price">${formatCurrency(item.price, item.currency)}</div>
          <div class="market-title">${escapeHtml(item.title)}</div>
          <div class="market-loc">📍 ${escapeHtml(item.location || 'India')}</div>
        </div>
      </div>
    `).join('')}
  </div>`;
}

async function renderMarketItemDetail(container, itemId) {
  container.innerHTML = '<div class="loading-center" style="padding:60px"><div class="spinner"></div></div>';
  try {
    const item = await MarketAPI.get(itemId);
    const isOwn = item.seller_id === window.currentUser?.id;
    container.innerHTML = `
      <div style="max-width:720px;margin:0 auto;padding:16px">
        <button class="btn-secondary btn-sm" onclick="navigate('marketplace')" style="margin-bottom:12px">‹ Back to Marketplace</button>
        <div class="card" style="overflow:hidden">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:2px">
            ${item.photos?.length ? item.photos.map((p, i) => `
              <div style="aspect-ratio:1;overflow:hidden;cursor:pointer" onclick="openLightbox(${JSON.stringify(item.photos.map(x=>({url:x.url,type:'image'})))},${i})">
                <img src="${escapeHtml(p.url)}" style="width:100%;height:100%;object-fit:cover">
              </div>
            `).join('') : `<div style="height:240px;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:64px">📦</div>`}
          </div>
          <div style="padding:16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div>
                <div style="font-size:28px;font-weight:900">${formatCurrency(item.price, item.currency)}</div>
                <h2 style="font-size:18px;font-weight:700;margin:4px 0">${escapeHtml(item.title)}</h2>
                <div style="font-size:13px;color:var(--text3)">
                  ${item.condition ? `Condition: ${capitalize(item.condition.replace('_', ' '))}` : ''} ·
                  ${item.category ? capitalize(item.category) : ''} ·
                  📍 ${escapeHtml(item.location || 'India')}
                </div>
              </div>
              ${isOwn ? `<button class="btn-secondary btn-sm" onclick="MarketAPI.markSold(${item.id}).then(()=>{showToast('Marked as sold','success');navigate('marketplace')})">Mark as Sold</button>` : ''}
            </div>
            ${item.description ? `<div style="margin-top:12px;color:var(--text2);line-height:1.6">${escapeHtml(item.description)}</div>` : ''}
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border2);display:flex;align-items:center;gap:10px">
              ${item.seller_avatar ? `<img src="${escapeHtml(item.seller_avatar)}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;cursor:pointer" onclick="navigate('profile',{id:${item.seller_id}})">` : `<div class="avatar md" style="cursor:pointer" onclick="navigate('profile',{id:${item.seller_id}})"><div class="avatar-inner md">${(item.seller_name||'?')[0]}</div></div>`}
              <div>
                <div style="font-weight:700;cursor:pointer" onclick="navigate('profile',{id:${item.seller_id}})">${escapeHtml(item.seller_name)}</div>
                <div style="font-size:13px;color:var(--text3)">Seller · @${escapeHtml(item.seller_username)}</div>
              </div>
              ${!isOwn ? `<button class="btn-primary btn-sm" style="margin-left:auto" onclick="navigate('messages',{userId:${item.seller_id}})">💬 Chat with Seller</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (e) { container.innerHTML = '<div class="empty-state"><h3>Item not found</h3></div>'; }
}

function openCreateListingModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>List an Item for Sale</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
      <div class="modal-body">
        <form id="create-listing-form">
          <div class="form-group"><label>Title *</label><input class="form-input" id="ml-title" placeholder="e.g. iPhone 14 Pro, Sofa, etc." required></div>
          <div class="form-group"><label>Price (₹) *</label><input type="number" class="form-input" id="ml-price" placeholder="0" min="0" required></div>
          <div class="form-group"><label>Description</label><textarea class="form-input" id="ml-desc" rows="3" placeholder="Describe your item..."></textarea></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label>Condition</label>
              <select class="form-input" id="ml-condition">
                <option value="new">New</option>
                <option value="like_new">Like New</option>
                <option value="good" selected>Good</option>
                <option value="fair">Fair</option>
              </select>
            </div>
            <div class="form-group"><label>Category</label>
              <select class="form-input" id="ml-category">
                <option value="electronics">Electronics</option>
                <option value="furniture">Furniture</option>
                <option value="clothing">Clothing</option>
                <option value="books">Books</option>
                <option value="vehicles">Vehicles</option>
                <option value="other" selected>Other</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label>Location</label><input class="form-input" id="ml-location" placeholder="City, State"></div>
          <div class="form-group"><label>Photos (up to 5)</label><input type="file" class="form-input" id="ml-photos" accept="image/*" multiple></div>
          <button type="submit" class="btn-primary">List Item</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('create-listing-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', document.getElementById('ml-title').value);
    formData.append('price', document.getElementById('ml-price').value);
    formData.append('description', document.getElementById('ml-desc').value);
    formData.append('condition', document.getElementById('ml-condition').value);
    formData.append('category', document.getElementById('ml-category').value);
    formData.append('location', document.getElementById('ml-location').value);
    const photos = document.getElementById('ml-photos').files;
    Array.from(photos).slice(0, 5).forEach(f => formData.append('photos', f));
    try {
      const item = await MarketAPI.create(formData);
      modal.remove();
      navigate('marketplace', { id: item.id });
      showToast('Item listed!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });
}
