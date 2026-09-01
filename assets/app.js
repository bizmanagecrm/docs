(() => {
  const docs = window.BIZMANAGE_DOCS;
  const article = document.querySelector('#article');
  const nav = document.querySelector('#nav');
  const toc = document.querySelector('#toc');
  const sidebar = document.querySelector('#sidebar');
  const searchDialog = document.querySelector('#searchDialog');
  const searchInput = document.querySelector('#searchInput');
  const searchResults = document.querySelector('#searchResults');
  const aiDialog = document.querySelector('#aiDialog');
  const aiQuestion = document.querySelector('#aiQuestion');
  let catalogData = { actions: [], api: [] };
  let currentPage = 'start';

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  const plain = (html = '') => { const el = document.createElement('div'); el.innerHTML = html; return el.textContent || ''; };
  const prettyScreen = (value) => value.split('/').map((part) => part.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())).join(' › ');

  function buildNav() {
    nav.innerHTML = docs.groups.map((group) => `<div class="nav-group"><p>${escapeHtml(group.label)}</p>${group.pages.map((id) => `<a class="nav-link" data-page="${id}" href="#/${id}">${escapeHtml(docs.pages[id].title)}</a>`).join('')}</div>`).join('');
  }

  function route() {
    const requested = location.hash.replace(/^#\//, '').split(/[?#]/)[0] || 'start';
    currentPage = docs.pages[requested] ? requested : 'start';
    renderPage(currentPage);
  }

  function renderPage(id) {
    const page = docs.pages[id];
    document.title = `${page.title} · BizManage Documentation`;
    article.innerHTML = `<header class="hero"><p class="eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.title)}</h1><p class="summary">${escapeHtml(page.summary)}</p></header>${page.html}`;
    document.querySelectorAll('.nav-link').forEach((link) => link.classList.toggle('active', link.dataset.page === id));
    sidebar.classList.remove('open');
    buildToc();
    hydrateCatalogs();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function buildToc() {
    const headings = [...article.querySelectorAll('h2[id], h3[id]')];
    toc.innerHTML = headings.map((heading) => `<a href="#${escapeHtml(heading.id)}" style="padding-left:${heading.tagName === 'H3' ? '10px' : '0'}">${escapeHtml(heading.textContent)}</a>`).join('') || '<span>No sections</span>';
    toc.querySelectorAll('a').forEach((link) => link.addEventListener('click', (event) => {
      event.preventDefault();
      document.getElementById(link.getAttribute('href').slice(1))?.scrollIntoView();
    }));
  }

  function hydrateCatalogs() {
    article.querySelectorAll('[data-catalog]').forEach((host) => {
      const type = host.dataset.catalog;
      if (type === 'actions') renderActionCatalog(host);
      if (type === 'api') renderApiCatalog(host);
    });
  }

  function renderActionCatalog(host) {
    const all = catalogData.actions;
    const screens = [...new Set(all.map((item) => item.screen))];
    host.innerHTML = `<div class="filter-bar"><input type="search" placeholder="Search button, screen, or action" aria-label="Filter UI actions"><select aria-label="Filter by screen"><option value="">All screens</option>${screens.map((screen) => `<option value="${escapeHtml(screen)}">${escapeHtml(prettyScreen(screen))}</option>`).join('')}</select></div><p class="catalog-count"></p><div class="table-wrap"><table><thead><tr><th>Screen</th><th>Button / link</th><th>Bound action</th></tr></thead><tbody></tbody></table></div>`;
    const input = host.querySelector('input'); const select = host.querySelector('select'); const body = host.querySelector('tbody'); const count = host.querySelector('.catalog-count');
    const update = () => {
      const term = input.value.trim().toLowerCase();
      const filtered = all.filter((item) => (!select.value || item.screen === select.value) && (!term || `${item.screen} ${item.label} ${item.action}`.toLowerCase().includes(term)));
      body.innerHTML = filtered.slice(0, 250).map((item) => `<tr><td>${escapeHtml(prettyScreen(item.screen))}</td><td><strong>${escapeHtml(item.label)}</strong></td><td><code>${escapeHtml(item.action)}</code></td></tr>`).join('');
      count.textContent = `${filtered.length.toLocaleString()} actions${filtered.length > 250 ? ' · showing first 250; narrow your search' : ''}`;
    };
    input.addEventListener('input', update); select.addEventListener('change', update); update();
  }

  function renderApiCatalog(host) {
    const all = catalogData.api;
    const permissions = [...new Set(all.map((item) => item.permission))];
    const impacts = [...new Set(all.map((item) => item.impact))];
    host.innerHTML = `<div class="filter-bar"><input type="search" placeholder="Filter endpoint or purpose" aria-label="Filter API endpoints"><select aria-label="Filter by permission"><option value="">All permission levels</option>${permissions.map((permission) => `<option value="${escapeHtml(permission)}">${escapeHtml(permission)}</option>`).join('')}</select><select aria-label="Filter by impact"><option value="">All impacts</option>${impacts.map((impact) => `<option value="${escapeHtml(impact)}">${escapeHtml(impact)}</option>`).join('')}</select></div><p class="catalog-count"></p><div class="table-wrap"><table><thead><tr><th>Method</th><th>Endpoint</th><th>Permission</th><th>Impact</th><th>Purpose</th></tr></thead><tbody></tbody></table></div>`;
    const input = host.querySelector('input'); const [permissionSelect, impactSelect] = host.querySelectorAll('select'); const body = host.querySelector('tbody'); const count = host.querySelector('.catalog-count');
    const update = () => {
      const term = input.value.trim().toLowerCase();
      const filtered = all.filter((item) => (!permissionSelect.value || item.permission === permissionSelect.value) && (!impactSelect.value || item.impact === impactSelect.value) && (!term || `${item.method} ${item.endpoint} ${item.permission} ${item.impact} ${item.purpose}`.toLowerCase().includes(term)));
      body.innerHTML = filtered.map((item) => `<tr><td><span class="tag ${item.method.toLowerCase()}">${escapeHtml(item.method)}</span></td><td><code>${escapeHtml(item.endpoint)}</code></td><td><span class="tag permission-${item.permission.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(item.permission)}</span></td><td>${escapeHtml(item.impact)}</td><td>${escapeHtml(item.purpose)}</td></tr>`).join('');
      count.textContent = `${filtered.length.toLocaleString()} of ${all.length.toLocaleString()} source-derived routes`;
    };
    input.addEventListener('input', update); permissionSelect.addEventListener('change', update); impactSelect.addEventListener('change', update); update();
  }

  function searchableItems() {
    const pages = Object.entries(docs.pages).map(([id, page]) => ({ href: `#/${id}`, title: page.title, meta: `${page.eyebrow} · ${page.summary}`, search: `${page.title} ${page.eyebrow} ${page.summary} ${plain(page.html)}`.toLowerCase() }));
    const actions = catalogData.actions.map((item) => ({ href: '#/actions', title: item.label, meta: `${prettyScreen(item.screen)} · ${item.action}`, search: `${item.label} ${item.screen} ${item.action}`.toLowerCase() }));
    const api = catalogData.api.map((item) => ({ href: '#/api', title: `${item.method} ${item.endpoint}`, meta: `${item.permission} · ${item.impact} · ${item.purpose}`, search: `${item.method} ${item.endpoint} ${item.permission} ${item.impact} ${item.purpose}`.toLowerCase() }));
    return [...pages, ...actions, ...api];
  }

  function runSearch() {
    const term = searchInput.value.trim().toLowerCase();
    if (!term) { searchResults.innerHTML = '<div class="empty-state">Search all guides, supported API routes, and source-extracted UI actions.</div>'; return; }
    const results = searchableItems().filter((item) => item.search.includes(term)).slice(0, 60);
    searchResults.innerHTML = results.length ? results.map((item) => `<a class="search-result" href="${item.href}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meta)}</span></a>`).join('') : '<div class="empty-state">No exact match. Try a shorter action, screen, or API term.</div>';
    searchResults.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => searchDialog.close()));
  }

  function openSearch() { searchDialog.showModal(); searchInput.value = ''; runSearch(); setTimeout(() => searchInput.focus(), 20); }
  function openAi() {
    const page = docs.pages[currentPage];
    const documentedText = plain(page.html).replace(/\s+/g, ' ').trim();
    aiQuestion.value = `Explain this BizManage documentation page in plain language and answer my question from the supplied documentation. Do not search for another copy of the page.\n\nTOPIC: ${page.title}\nSUMMARY: ${page.summary}\nDOCUMENTED PAGE TEXT:\n${documentedText}\n\nMY QUESTION:\n\nRULES: Use only the text above. Clearly label permissions. Call out tenant-customized fields, labels, buttons, workflows, prompts, statuses, and available actions instead of guessing. Warn before anything that can send a message, charge or refund money, delete or overwrite data, publish content, or change production configuration. Distinguish an AI draft or suggestion from an executed action. If a behavior is not stated above, say “not documented here.”`;
    document.querySelector('#copyStatus').textContent = '';
    aiDialog.showModal();
  }

  async function loadCatalogs() {
    try {
      const [actions, api] = await Promise.all([fetch('/data/actions.json').then((r) => r.json()), fetch('/data/api.json').then((r) => r.json())]);
      catalogData.actions = actions.actions || []; catalogData.api = api.endpoints || [];
      hydrateCatalogs();
    } catch (error) { console.warn('Catalogs unavailable', error); }
  }

  buildNav(); route(); loadCatalogs();
  window.addEventListener('hashchange', route);
  document.querySelector('#searchTrigger').addEventListener('click', openSearch);
  searchInput.addEventListener('input', runSearch);
  document.querySelector('#menuToggle').addEventListener('click', () => sidebar.classList.toggle('open'));
  document.querySelector('#reportGap').addEventListener('click', openAi);
  document.querySelector('#copyPrompt').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(aiQuestion.value); document.querySelector('#copyStatus').textContent = 'Copied. Paste it into your approved AI assistant.'; }
    catch { aiQuestion.select(); document.execCommand('copy'); document.querySelector('#copyStatus').textContent = 'Copied.'; }
  });
  document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); } });
  const savedTheme = localStorage.getItem('bm-docs-theme'); if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  document.querySelector('#themeToggle').addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; localStorage.setItem('bm-docs-theme', theme); });
})();
