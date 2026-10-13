/**
 * ==============================================================================
 * MBA HEC MONTRÉAL — WIKI EXPLORER JAVASCRIPT APPLICATION
 * Interactive Single Page App with Knowledge Graph, Markdown & LaTeX Renderer
 * ==============================================================================
 */

(function () {
  'use strict';

  // Application State
  const state = {
    data: null,
    notesList: [],
    activeNoteId: null,
    currentCategory: 'all',
    searchQuery: '',
    selectedTag: null,
    theme: localStorage.getItem('mba_wiki_theme') || 'dark',
    graph: {
      nodes: [],
      links: [],
      transform: { x: 0, y: 0, scale: 1 },
      isDragging: false,
      draggedNode: null,
      hoveredNode: null,
      dragStart: { x: 0, y: 0 }
    }
  };

  // Category Color Map
  const CATEGORY_COLORS = {
    courses: '#3b82f6',     // Blue
    concepts: '#10b981',    // Emerald
    entities: '#f59e0b',    // Amber
    professeurs: '#f59e0b', // Amber
    etudiants: '#a855f7',   // Purple
    professors: '#f59e0b',  // Amber
    students: '#a855f7',    // Purple
    syntheses: '#ec4899',   // Pink
    general: '#64748b'      // Slate
  };

  // DOM Elements
  const DOM = {
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    graphViewBtn: document.getElementById('graph-view-btn'),
    searchInput: document.getElementById('search-input'),
    sidebarTabs: document.getElementById('sidebar-tabs'),
    noteListContainer: document.getElementById('note-list-container'),
    readerContent: document.getElementById('reader-content'),
    tocList: document.getElementById('toc-list'),
    graphModal: document.getElementById('graph-modal'),
    graphCanvas: document.getElementById('graph-canvas'),
    closeGraphBtn: document.getElementById('close-graph-btn'),
    searchModal: document.getElementById('search-modal'),
    searchModalInput: document.getElementById('search-modal-input'),
    searchModalResults: document.getElementById('search-modal-results')
  };

  // Initialize App
  function init() {
    applyTheme(state.theme);
    setupEventListeners();
    loadWikiData();
  }

  // Apply Theme
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mba_wiki_theme', theme);
    const icon = DOM.themeToggleBtn ? DOM.themeToggleBtn.querySelector('i') : null;
    if (icon) {
      icon.className = theme === 'dark' ? 'fa-light fa-sun' : 'fa-light fa-moon';
    }
  }

  // Load Wiki Data (from window.WIKI_DATA or fetch fallback)
  function loadWikiData() {
    if (window.WIKI_DATA && window.WIKI_DATA.notes) {
      processData(window.WIKI_DATA);
    } else {
      fetch('wiki_data.json')
        .then(res => res.json())
        .then(data => processData(data))
        .catch(err => {
          console.error("Erreur chargement wiki_data.json:", err);
          DOM.noteListContainer.innerHTML = `<div style="padding: 1rem; color: #ef4444;">Erreur lors du chargement des données. Vérifiez que <code>generate_wiki_data.py</code> a été exécuté.</div>`;
        });
    }
  }

  // Process and Index Data
  function processData(dataset) {
    state.data = dataset;
    state.notesList = Object.values(dataset.notes);

    renderSidebarTabs();
    renderNoteList();

    // Default note to open (index, welcome, or first note)
    const initialId = window.location.hash ? window.location.hash.substring(1) : 'index';
    if (dataset.notes[initialId]) {
      openNote(initialId);
    } else if (dataset.notes['index']) {
      openNote('index');
    } else if (state.notesList.length > 0) {
      openNote(state.notesList[0].id);
    }

    initGraphData();
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Theme toggle
    if (DOM.themeToggleBtn) {
      DOM.themeToggleBtn.addEventListener('click', () => {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      });
    }

    // Graph view modal trigger
    if (DOM.graphViewBtn) {
      DOM.graphViewBtn.addEventListener('click', () => openGraphModal());
    }

    if (DOM.closeGraphBtn) {
      DOM.closeGraphBtn.addEventListener('click', () => closeGraphModal());
    }

    // Search bar trigger modal
    if (DOM.searchInput) {
      DOM.searchInput.addEventListener('click', () => openSearchModal());
      DOM.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') openSearchModal();
      });
    }

    // Keyboard Shortcuts (Ctrl+K or '/' for search, Esc for close)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === 'Escape') {
        closeSearchModal();
        closeGraphModal();
      }
    });

    // Hash navigation
    window.addEventListener('hashchange', () => {
      const targetId = window.location.hash.substring(1);
      if (state.data && state.data.notes[targetId] && state.activeNoteId !== targetId) {
        openNote(targetId, false);
      }
    });

    // Modal background click
    if (DOM.graphModal) {
      DOM.graphModal.addEventListener('click', (e) => {
        if (e.target === DOM.graphModal) closeGraphModal();
      });
    }
    if (DOM.searchModal) {
      DOM.searchModal.addEventListener('click', (e) => {
        if (e.target === DOM.searchModal) closeSearchModal();
      });
    }

    // Search modal input input listener
    if (DOM.searchModalInput) {
      DOM.searchModalInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
      });
    }
  }

  // Render Sidebar Tabs with category counts
  function renderSidebarTabs() {
    if (!DOM.sidebarTabs || !state.data) return;

    const counts = {
      all: state.notesList.length,
      courses: state.notesList.filter(n => n.category === 'courses').length,
      concepts: state.notesList.filter(n => n.category === 'concepts').length,
      professeurs: state.notesList.filter(n => n.category === 'professeurs').length,
      etudiants: state.notesList.filter(n => n.category === 'etudiants').length,
      syntheses: state.notesList.filter(n => n.category === 'syntheses').length
    };

    const tabsConfig = [
      { id: 'all', label: 'Toutes', icon: 'fa-layer-group', count: counts.all },
      { id: 'courses', label: 'Cours & Ateliers', icon: 'fa-book-bookmark', count: counts.courses },
      { id: 'concepts', label: 'Concepts & Formules', icon: 'fa-calculator', count: counts.concepts },
      { id: 'professeurs', label: 'Professeurs', icon: 'fa-chalkboard-user', count: counts.professeurs },
      { id: 'etudiants', label: 'Cohorte S26AB', icon: 'fa-users', count: counts.etudiants },
      { id: 'syntheses', label: 'Synthèses', icon: 'fa-file-lines', count: counts.syntheses }
    ];

    DOM.sidebarTabs.innerHTML = tabsConfig.map(t => `
      <button class="tab-btn ${state.currentCategory === t.id ? 'active' : ''}" data-cat="${t.id}">
        <i class="fa-light ${t.icon}"></i>
        <span>${t.label}</span>
        <span class="tab-badge">${t.count}</span>
      </button>
    `).join('');

    DOM.sidebarTabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.sidebarTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentCategory = btn.getAttribute('data-cat');
        renderNoteList();
      });
    });
  }

  // Render Note List in Sidebar
  function renderNoteList() {
    if (!DOM.noteListContainer || !state.data) return;

    let filtered = state.notesList;

    if (state.currentCategory !== 'all') {
      filtered = filtered.filter(n => n.category === state.currentCategory);
    }

    if (state.selectedTag) {
      filtered = filtered.filter(n => n.tags && n.tags.includes(state.selectedTag));
    }

    // Sort by Title
    filtered.sort((a, b) => a.title.localeCompare(b.title, 'fr'));

    if (filtered.length === 0) {
      DOM.noteListContainer.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Aucune fiche trouvée dans cette catégorie.</div>`;
      return;
    }

    DOM.noteListContainer.innerHTML = filtered.map(note => {
      const isActive = note.id === state.activeNoteId ? 'active' : '';
      const catClass = `cat-${note.category}`;
      const catLabel = note.category === 'professeurs' ? 'Professeur' : (note.category === 'etudiants' ? 'Cohorte' : note.category);

      return `
        <div class="note-item ${isActive}" data-id="${note.id}">
          <div class="note-item-header">
            <div class="note-title">${escapeHTML(note.title)}</div>
            <span class="category-tag ${catClass}">${catLabel}</span>
          </div>
          ${note.description ? `<div class="note-desc">${escapeHTML(note.description)}</div>` : ''}
          <div class="note-meta">
            <span><i class="fa-light fa-clock"></i> ${note.readingTime} min</span>
            <span>•</span>
            <span><i class="fa-light fa-link"></i> ${note.links.length} liens</span>
          </div>
        </div>
      `;
    }).join('');

    DOM.noteListContainer.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        openNote(id);
      });
    });
  }

  // Open Note in Reader
  function openNote(noteId, updateHash = true) {
    if (!state.data || !state.data.notes[noteId]) return;

    state.activeNoteId = noteId;
    const note = state.data.notes[noteId];

    if (updateHash) {
      window.location.hash = noteId;
    }

    // Highlight in sidebar
    if (DOM.noteListContainer) {
      DOM.noteListContainer.querySelectorAll('.note-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-id') === noteId);
      });
    }

    renderNoteContent(note);
    renderTableOfContents(note);
  }

  // Render Note Markdown & Enhancements
  function renderNoteContent(note) {
    if (!DOM.readerContent) return;

    // Transform Markdown with Marked
    let parsedBody = note.body;

    // 1. Transform Obsidian Alert Callouts (> [!NOTE], > [!TIP], etc.)
    parsedBody = transformCallouts(parsedBody);

    // 2. Transform Wikilinks [[target|label]]
    parsedBody = transformWikilinks(parsedBody);

    // 3. Render Markdown HTML
    let htmlContent = "";
    try {
      htmlContent = marked.parse(parsedBody);
    } catch (e) {
      htmlContent = parsedBody.replace(/\n/g, '<br>');
    }

    const catClass = `cat-${note.category}`;
    const catLabel = note.subCategory === 'professors' ? 'Corps Professoral' : (note.subCategory === 'students' ? 'Cohorte S26AB' : note.category);

    const tagsHTML = note.tags && note.tags.length > 0
      ? note.tags.map(t => `<span class="tag-pill" data-tag="${t}">#${t}</span>`).join('')
      : '';

    const backlinksHTML = note.backlinks && note.backlinks.length > 0
      ? note.backlinks.map(bl => `
          <div class="connection-card" data-id="${bl.id}">
            <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 2px;">${escapeHTML(bl.title)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">${bl.category}</div>
          </div>
        `).join('')
      : '<div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">Aucun rétrolien entrant pour cette fiche.</div>';

    const outgoingLinksHTML = note.links && note.links.length > 0
      ? note.links.map(lk => `
          <div class="connection-card" data-target="${lk.target}">
            <div style="font-weight: 600; font-size: 0.85rem; color: var(--text-accent); margin-bottom: 2px;">${escapeHTML(lk.label || lk.target)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHTML(lk.target)}</div>
          </div>
        `).join('')
      : '<div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">Aucun lien sortant direct.</div>';

    DOM.readerContent.innerHTML = `
      <div class="reader-wrapper">
        <nav class="breadcrumb-nav">
          <a href="#index" class="nav-root"><i class="fa-light fa-house"></i> Wiki</a>
          <span class="breadcrumb-separator">/</span>
          <span style="text-transform: capitalize;">${catLabel}</span>
          <span class="breadcrumb-separator">/</span>
          <span style="color: var(--text-primary); font-weight: 500;">${escapeHTML(note.title)}</span>
        </nav>

        <header class="doc-header">
          <div class="doc-badge-row">
            <span class="category-tag ${catClass}">${catLabel}</span>
            <span style="font-size: 0.72rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 2px 7px; border-radius: 4px; color: var(--text-muted);">
              Type: ${note.type}
            </span>
          </div>

          <h1 class="doc-title">${escapeHTML(note.title)}</h1>
          ${note.description ? `<p class="doc-description">${escapeHTML(note.description)}</p>` : ''}

          <div class="doc-info-bar">
            <div class="doc-info-item"><i class="fa-light fa-clock"></i> ${note.readingTime} min de lecture (${note.wordCount} mots)</div>
            <div class="doc-info-item"><i class="fa-light fa-calendar"></i> Modifié le ${note.timestamp}</div>
            <div class="doc-info-item"><i class="fa-light fa-folder"></i> <code>${note.path}</code></div>
          </div>

          ${tagsHTML ? `<div class="tag-cloud">${tagsHTML}</div>` : ''}
        </header>

        <article class="markdown-body" id="article-body">
          ${htmlContent}
        </article>

        <section class="context-connections-section">
          <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-light fa-arrows-split-up-and-left" style="color: var(--text-accent);"></i> Rétroliens & Cités par (${note.backlinks.length})
          </h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Notes de la base qui font référence à cette fiche :</p>
          <div class="connection-grid">
            ${backlinksHTML}
          </div>

          <h2 style="font-family: var(--font-title); font-size: 1.25rem; font-weight: 700; margin-top: 2.5rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-light fa-arrow-up-right-from-square" style="color: var(--color-concept);"></i> Liens & Concepts Cités (${note.links.length})
          </h2>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Notions académiques, professeurs et références cités dans cette note :</p>
          <div class="connection-grid">
            ${outgoingLinksHTML}
          </div>
        </section>
      </div>
    `;

    // Post-processing : KaTeX, Mermaid, Code Copy, Wikilinks Click
    postProcessRenderedArticle();
  }

  // Post-Process Rendered Article (MathJax/KaTeX, Mermaid, Copy Buttons)
  function postProcessRenderedArticle() {
    const article = document.getElementById('article-body');
    if (!article) return;

    // 1. Render KaTeX Math
    if (window.renderMathInElement) {
      try {
        renderMathInElement(article, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) {
        console.warn("KaTeX render error:", e);
      }
    }

    // 2. Render Mermaid Diagrams
    if (window.mermaid) {
      try {
        const mermaidNodes = article.querySelectorAll('.language-mermaid, pre code.language-mermaid');
        mermaidNodes.forEach((node, idx) => {
          const rawCode = node.textContent;
          const container = document.createElement('div');
          container.className = 'mermaid';
          container.textContent = rawCode;
          const pre = node.closest('pre') || node;
          pre.parentNode.replaceChild(container, pre);
        });
        mermaid.run({ nodes: article.querySelectorAll('.mermaid') });
      } catch (e) {
        console.warn("Mermaid render error:", e);
      }
    }

    // 3. Add Copy buttons to code blocks
    article.querySelectorAll('pre').forEach(pre => {
      if (pre.classList.contains('mermaid')) return;
      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.innerHTML = '<i class="fa-light fa-copy"></i> Copier';
      btn.addEventListener('click', () => {
        const codeText = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
        navigator.clipboard.writeText(codeText);
        btn.innerHTML = '<i class="fa-light fa-check"></i> Copié !';
        setTimeout(() => btn.innerHTML = '<i class="fa-light fa-copy"></i> Copier', 2000);
      });
      pre.appendChild(btn);
    });

    // 4. Attach Wikilink Click Listeners
    document.querySelectorAll('.wikilink-btn, .connection-card').forEach(linkEl => {
      linkEl.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = linkEl.getAttribute('data-id') || linkEl.getAttribute('data-target');
        if (targetId) {
          resolveAndOpenLink(targetId);
        }
      });
    });

    // 5. Attach Tag Pill Filters
    document.querySelectorAll('.tag-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const tag = pill.getAttribute('data-tag');
        if (tag) {
          openSearchModal(`#${tag}`);
        }
      });
    });
  }

  // Resolve and Open any link target
  function resolveAndOpenLink(target) {
    let cleanTarget = target.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\.md$/, '');
    
    // Direct match
    if (state.data.notes[cleanTarget]) {
      openNote(cleanTarget);
      return;
    }

    // Match with prefix wiki/
    if (state.data.notes[`wiki/${cleanTarget}`]) {
      openNote(`wiki/${cleanTarget}`);
      return;
    }

    // Match by basename / stem
    const targetBase = cleanTarget.split('/').pop().toLowerCase();
    const found = state.notesList.find(n => n.stem.toLowerCase() === targetBase || n.id.toLowerCase().endsWith('/' + targetBase));
    if (found) {
      openNote(found.id);
      return;
    }

    console.warn("Lien introuvable:", target);
  }

  // Transform Obsidian Callouts (> [!NOTE], etc.)
  function transformCallouts(markdown) {
    const calloutTypes = {
      'NOTE': { class: 'callout-note', icon: 'fa-circle-info', title: 'Note' },
      'TIP': { class: 'callout-tip', icon: 'fa-lightbulb', title: 'Astuce & Conseil' },
      'IMPORTANT': { class: 'callout-important', icon: 'fa-circle-exclamation', title: 'Important' },
      'WARNING': { class: 'callout-warning', icon: 'fa-triangle-exclamation', title: 'Attention' },
      'CAUTION': { class: 'callout-caution', icon: 'fa-shield-exclamation', title: 'Prudence' },
      'INFO': { class: 'callout-info', icon: 'fa-info', title: 'Information' }
    };

    return markdown.replace(/^>\s*\[!([A-Z]+)\]\s*(.*)?$/gim, (match, type, customTitle) => {
      const config = calloutTypes[type.toUpperCase()] || calloutTypes['NOTE'];
      const title = customTitle.trim() || config.title;
      return `<div class="callout ${config.class}"><div class="callout-title"><i class="fa-light ${config.icon}"></i> ${title}</div>`;
    });
  }

  // Transform Wikilinks [[target|label]] into HTML anchors
  function transformWikilinks(markdown) {
    return markdown.replace(/\[\[(.*?)\]\]/g, (match, inner) => {
      let target = inner;
      let label = inner;
      if (inner.includes('|')) {
        const parts = inner.split('|');
        target = parts[0].trim();
        label = parts[1].trim();
      }
      return `<a class="wikilink-btn" data-target="${escapeHTML(target)}" href="#${escapeHTML(target)}"><i class="fa-light fa-file-lines" style="font-size: 0.8em;"></i> ${escapeHTML(label)}</a>`;
    });
  }

  // Render Table of Contents in Right Sidebar
  function renderTableOfContents(note) {
    if (!DOM.tocList) return;

    const headings = [];
    const lines = note.body.split('\n');
    lines.forEach(line => {
      const m2 = line.match(/^##\s+(.+)$/);
      if (m2) headings.push({ level: 2, text: m2[1].replace(/\[\[.*?\|(.*?)\]\]/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1') });
      const m3 = line.match(/^###\s+(.+)$/);
      if (m3) headings.push({ level: 3, text: m3[1].replace(/\[\[.*?\|(.*?)\]\]/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1') });
    });

    if (headings.length === 0) {
      DOM.tocList.innerHTML = `<li style="color: var(--text-muted); font-size: 0.78rem; font-style: italic;">Aucun sous-titre dans cette fiche.</li>`;
      return;
    }

    DOM.tocList.innerHTML = headings.map((h, i) => `
      <li class="toc-item level-${h.level}">
        <a href="#heading-${i}" class="toc-link" data-index="${i}">${escapeHTML(h.text)}</a>
      </li>
    `).join('');

    // Assign IDs to rendered article headings
    const articleHeadings = document.querySelectorAll('#article-body h2, #article-body h3');
    articleHeadings.forEach((hEl, idx) => {
      hEl.id = `heading-${idx}`;
    });

    DOM.tocList.querySelectorAll('.toc-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = link.getAttribute('data-index');
        const targetHeading = document.getElementById(`heading-${idx}`);
        if (targetHeading) {
          targetHeading.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  // Search Logic & Command Palette
  function openSearchModal(prefill = '') {
    if (!DOM.searchModal) return;
    DOM.searchModal.classList.add('active');
    if (DOM.searchModalInput) {
      DOM.searchModalInput.value = prefill;
      DOM.searchModalInput.focus();
      performSearch(prefill);
    }
  }

  function closeSearchModal() {
    if (DOM.searchModal) DOM.searchModal.classList.remove('active');
  }

  function performSearch(query) {
    if (!DOM.searchModalResults || !state.data) return;
    query = query.trim().toLowerCase();

    if (!query) {
      // Show recent / recommended notes
      const featured = state.notesList.slice(0, 8);
      renderSearchResults(featured, "Notes Recommandées & Rentes");
      return;
    }

    let results = [];

    // Tag Search (if starts with #)
    if (query.startsWith('#')) {
      const tagQuery = query.substring(1);
      results = state.notesList.filter(n => n.tags && n.tags.some(t => t.toLowerCase().includes(tagQuery)));
    } else {
      // Fuzzy search across Title, Description, Tags, and Body
      results = state.notesList.map(n => {
        let score = 0;
        const titleLower = n.title.toLowerCase();
        const descLower = (n.description || '').toLowerCase();
        const bodyLower = n.body.toLowerCase();

        if (titleLower.includes(query)) score += 100;
        if (titleLower.startsWith(query)) score += 50;
        if (descLower.includes(query)) score += 30;
        if (n.tags && n.tags.some(t => t.toLowerCase().includes(query))) score += 40;
        if (bodyLower.includes(query)) score += 10;

        return { note: n, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.note);
    }

    renderSearchResults(results.slice(0, 15), `${results.length} résultat(s) trouvé(s)`);
  }

  function renderSearchResults(notes, title) {
    if (notes.length === 0) {
      DOM.searchModalResults.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
          <i class="fa-light fa-magnifying-glass" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <div>Aucun résultat correspondant.</div>
        </div>
      `;
      return;
    }

    DOM.searchModalResults.innerHTML = `
      <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; padding-left: 0.5rem;">
        ${title}
      </div>
      ${notes.map(note => `
        <div class="search-result-item" data-id="${note.id}">
          <div class="search-result-title">
            <span>${escapeHTML(note.title)}</span>
            <span class="category-tag cat-${note.category}" style="font-size: 0.62rem;">${note.category}</span>
          </div>
          ${note.description ? `<div class="search-result-snippet">${escapeHTML(note.description)}</div>` : ''}
        </div>
      `).join('')}
    `;

    DOM.searchModalResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        closeSearchModal();
        openNote(id);
      });
    });
  }

  // ============================================================================
  // INTERACTIVE KNOWLEDGE GRAPH SIMULATION (Canvas Force Simulation)
  // ============================================================================

  function initGraphData() {
    if (!state.data || !state.data.graph) return;

    const rawNodes = state.data.graph.nodes;
    const rawLinks = state.data.graph.links;

    const nodeMap = {};
    state.graph.nodes = rawNodes.map((n, i) => {
      const node = {
        id: n.id,
        title: n.title,
        category: n.category,
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        radius: n.category === 'courses' ? 8 : (n.category === 'concepts' ? 7 : 5),
        color: CATEGORY_COLORS[n.category] || CATEGORY_COLORS.general
      };
      nodeMap[n.id] = node;
      return node;
    });

    state.graph.links = rawLinks.map(l => ({
      source: nodeMap[l.source],
      target: nodeMap[l.target]
    })).filter(l => l.source && l.target);
  }

  function openGraphModal() {
    if (!DOM.graphModal) return;
    DOM.graphModal.classList.add('active');
    setupCanvas();
    startGraphSimulation();
  }

  function closeGraphModal() {
    if (DOM.graphModal) DOM.graphModal.classList.remove('active');
  }

  let animationFrameId = null;

  function setupCanvas() {
    const canvas = DOM.graphCanvas;
    if (!canvas) return;

    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    state.graph.transform.x = canvas.width / 2;
    state.graph.transform.y = canvas.height / 2;
    state.graph.transform.scale = 0.9;

    // Canvas Mouse Events (Zoom, Pan, Drag Node)
    canvas.onwheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      state.graph.transform.scale = Math.max(0.2, Math.min(3.5, state.graph.transform.scale * zoomFactor));
    };

    canvas.onmousedown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - state.graph.transform.x) / state.graph.transform.scale;
      const mouseY = (e.clientY - rect.top - state.graph.transform.y) / state.graph.transform.scale;

      // Find clicked node
      const clicked = state.graph.nodes.find(n => Math.hypot(n.x - mouseX, n.y - mouseY) < n.radius * 2);
      if (clicked) {
        state.graph.draggedNode = clicked;
      } else {
        state.graph.isDragging = true;
        state.graph.dragStart = { x: e.clientX - state.graph.transform.x, y: e.clientY - state.graph.transform.y };
      }
    };

    window.onmousemove = (e) => {
      if (!DOM.graphModal.classList.contains('active')) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - state.graph.transform.x) / state.graph.transform.scale;
      const mouseY = (e.clientY - rect.top - state.graph.transform.y) / state.graph.transform.scale;

      if (state.graph.draggedNode) {
        state.graph.draggedNode.x = mouseX;
        state.graph.draggedNode.y = mouseY;
        state.graph.draggedNode.vx = 0;
        state.graph.draggedNode.vy = 0;
      } else if (state.graph.isDragging) {
        state.graph.transform.x = e.clientX - state.graph.dragStart.x;
        state.graph.transform.y = e.clientY - state.graph.dragStart.y;
      } else {
        // Hover test
        const hovered = state.graph.nodes.find(n => Math.hypot(n.x - mouseX, n.y - mouseY) < n.radius * 2);
        state.graph.hoveredNode = hovered || null;
      }
    };

    window.onmouseup = (e) => {
      if (state.graph.draggedNode) {
        state.graph.draggedNode = null;
      }
      state.graph.isDragging = false;
    };

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - state.graph.transform.x) / state.graph.transform.scale;
      const mouseY = (e.clientY - rect.top - state.graph.transform.y) / state.graph.transform.scale;

      const clicked = state.graph.nodes.find(n => Math.hypot(n.x - mouseX, n.y - mouseY) < n.radius * 2);
      if (clicked) {
        closeGraphModal();
        openNote(clicked.id);
      }
    };
  }

  function startGraphSimulation() {
    const canvas = DOM.graphCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function step() {
      if (!DOM.graphModal.classList.contains('active')) return;

      // 1. Force Physics Simulation
      const nodes = state.graph.nodes;
      const links = state.graph.links;

      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 250) {
            const force = 120 / (dist * dist);
            nodes[i].vx -= (dx / dist) * force;
            nodes[i].vy -= (dy / dist) * force;
            nodes[j].vx += (dx / dist) * force;
            nodes[j].vy += (dy / dist) * force;
          }
        }
      }

      // Link spring attraction
      links.forEach(link => {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetDist = 70;
        const force = (dist - targetDist) * 0.015;
        link.source.vx += (dx / dist) * force;
        link.source.vy += (dy / dist) * force;
        link.target.vx -= (dx / dist) * force;
        link.target.vy -= (dy / dist) * force;
      });

      // Center gravity & update positions
      nodes.forEach(n => {
        n.vx -= n.x * 0.003;
        n.vy -= n.y * 0.003;
        n.vx *= 0.88; // Damping
        n.vy *= 0.88;
        if (n !== state.graph.draggedNode) {
          n.x += n.vx;
          n.y += n.vy;
        }
      });

      // 2. Render Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(state.graph.transform.x, state.graph.transform.y);
      ctx.scale(state.graph.transform.scale, state.graph.transform.scale);

      // Draw Links
      ctx.lineWidth = 0.75;
      links.forEach(l => {
        const isHighlighted = state.graph.hoveredNode && (l.source === state.graph.hoveredNode || l.target === state.graph.hoveredNode);
        ctx.strokeStyle = isHighlighted ? 'rgba(56, 189, 248, 0.8)' : (state.theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)');
        ctx.lineWidth = isHighlighted ? 1.8 : 0.75;
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
      });

      // Draw Nodes
      nodes.forEach(n => {
        const isHovered = n === state.graph.hoveredNode;
        const isCurrent = n.id === state.activeNoteId;

        ctx.beginPath();
        ctx.arc(n.x, n.y, isHovered ? n.radius * 1.5 : (isCurrent ? n.radius * 1.3 : n.radius), 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.fill();

        if (isCurrent || isHovered) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Label on hover or for key nodes
        if (isHovered || isCurrent || state.graph.transform.scale > 1.3 || n.category === 'courses') {
          ctx.font = `${isHovered ? 'bold 11px' : '10px'} 'Plus Jakarta Sans', sans-serif`;
          ctx.fillStyle = state.theme === 'dark' ? '#f8fafc' : '#0f172a';
          ctx.textAlign = 'center';
          ctx.fillText(n.title.length > 25 ? n.title.substring(0, 23) + '…' : n.title, n.x, n.y + n.radius + 12);
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(step);
    }

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(step);
  }

  // Utilities
  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
