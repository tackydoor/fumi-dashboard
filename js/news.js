'use strict';

// ニュース（RSS / RDF / Atom を直接取得）
(function (DASH) {
  const { $, esc, fetchText, relTime, hhmm, load, save } = DASH.util;
  const ACTIVE_KEY = 'mydashboard.newsTab';
  const cache = new Map(); // url -> { at, items }

  let activeIndex = 0;
  let rotateTimer = null;
  let refreshTimer = null;
  let hovering = false;
  let renderSeq = 0;

  function text(node, names) {
    for (const name of names) {
      const el = node.getElementsByTagNameNS('*', name)[0] || node.getElementsByTagName(name)[0];
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function parseFeed(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('フィードを解析できません');
    const nodes = [...doc.getElementsByTagName('item'), ...doc.getElementsByTagName('entry')];
    return nodes.map((n) => {
      let link = text(n, ['link']);
      if (!link) {
        const l = n.getElementsByTagName('link')[0];
        link = l ? l.getAttribute('href') || '' : '';
      }
      const dateStr = text(n, ['date', 'pubDate', 'published', 'updated']);
      const date = dateStr ? new Date(dateStr) : null;
      return {
        title: text(n, ['title']),
        link,
        date: date && !isNaN(date) ? date : null,
      };
    }).filter((it) => it.title && /^https?:\/\//.test(it.link));
  }

  async function fetchFeed(url) {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < DASH.REFRESH.newsMs - 5000) return hit.items;
    const items = parseFeed(await fetchText(url, 15000));
    cache.set(url, { at: Date.now(), items });
    return items;
  }

  function enabledTabs() {
    return DASH.settings.news.tabs.filter((t) => t.enabled);
  }

  function tabName(tab) {
    if (tab.type === 'genre') return (DASH.NEWS_GENRES.find((g) => g.id === tab.id) || {}).name || tab.id;
    if (tab.type === 'keyword') return '🔍 ' + tab.query;
    return tab.name || 'RSS';
  }

  function genreFeeds(g) {
    const sources = DASH.settings.news.sources;
    return g.feeds
      .filter(([key]) => sources[key] !== false)
      .map(([key, url]) => ({ url, source: DASH.NEWS_SOURCES[key] }));
  }

  // 全ジャンルのフィード（重複なし）
  function allGenreFeeds() {
    const seen = new Set();
    return DASH.NEWS_GENRES.flatMap(genreFeeds).filter((f) => !seen.has(f.url) && seen.add(f.url));
  }

  // タブに対応するフィード一覧: [{ url, source: {name, className} }]
  function feedsFor(tab) {
    if (tab.type === 'genre') {
      const g = DASH.NEWS_GENRES.find((x) => x.id === tab.id);
      return g ? genreFeeds(g) : [];
    }
    if (tab.type === 'keyword') return allGenreFeeds();
    return [{ url: tab.url, source: { name: tab.name || 'RSS', className: 'src-custom' } }];
  }

  async function loadTab(tab) {
    let filter = null;
    if (tab.type === 'keyword') {
      const terms = tab.query.toLowerCase().split(/[\s　]+/).filter(Boolean);
      filter = (title) => terms.some((t) => title.toLowerCase().includes(t));
    }
    return collect(feedsFor(tab), filter);
  }

  // フィードをまとめて取得し、見出しで絞り込んで新しい順に並べる
  // all: true のフィードは絞り込まずにすべての記事を使う。perSource を指定すると提供元ごとの件数を制限する
  async function collect(feeds, filter, perSource) {
    if (!feeds.length) return { items: [], failed: 0, total: 0 };
    const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f.url)));
    let items = [];
    let failed = 0;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        failed++;
        return;
      }
      const list = filter && !feeds[i].all ? r.value.filter((it) => filter(it.title)) : r.value;
      items.push(...list.map((it) => ({ ...it, source: feeds[i].source })));
    });

    // 同じ見出しを除外して新しい順に
    const seen = new Set();
    items = items.filter((it) => {
      const key = it.title.replace(/[\s　]/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    items.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
    if (perSource) {
      const counts = new Map();
      items = items.filter((it) => {
        const n = (counts.get(it.source.name) || 0) + 1;
        counts.set(it.source.name, n);
        return n <= perSource;
      });
    }
    return { items: items.slice(0, DASH.settings.news.perTab), failed, total: feeds.length };
  }

  function itemsHtml(items) {
    return items.map((it) =>
      '<li><a href="' + esc(it.link) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="src ' + esc(it.source.className) + '">' + esc(it.source.name) + '</span>' +
        '<span class="title">' + esc(it.title) + '</span>' +
        (it.date ? '<time datetime="' + it.date.toISOString() + '" title="' + it.date.toLocaleString('ja-JP') + '">' + relTime(it.date) + '</time>' : '') +
      '</a></li>',
    ).join('');
  }

  // 全角英数字・大文字小文字・空白の違いを無視して比べる
  function normalize(text) {
    return text.normalize('NFKC').toLowerCase().replace(/\s/g, '');
  }

  // 見出しにいずれかのキーワードを含むかを調べる関数（キーワードがなければ null）
  function keywordFilter(keywords) {
    const words = keywords.map(normalize).filter(Boolean);
    if (!words.length) return null;
    return (title) => {
      const t = normalize(title);
      return words.some((k) => t.includes(k));
    };
  }

  // 中継サーバー経由の URL（中継サーバーが未設定なら null）
  function relayed(url, relayUrl = DASH.settings.relayUrl) {
    if (!relayUrl) return null;
    try {
      const u = new URL(relayUrl);
      u.searchParams.set('url', url);
      return u.href;
    } catch (e) {
      return null;
    }
  }

  // 設定で選ばれた提供元のフィード。relay のフィードは中継サーバー経由にし、未設定なら除く
  function pickFeeds(list, sources) {
    return list
      .filter((f) => sources[f.key] !== false)
      .map((f) => ({ url: f.relay ? relayed(f.url) : f.url, source: f.source, all: true }))
      .filter((f) => f.url);
  }

  // 追加のニュースパネル（生成AIニュース・ITテックニュース・ITセキュリティニュース）の共通処理
  // feeds: 取得するフィード、filter: 見出しの絞り込み関数を返す（任意）、check: 設定に問題があればメッセージを返す（任意）、
  // perSource: 提供元ごとの最大件数（任意）
  function createPanel({ list, status, feeds, filter, check, perSource }) {
    let timer = null;
    let seq = 0;

    async function render() {
      const listEl = $(list);
      const statusEl = $(status);
      const problem = check && check();
      if (problem) {
        listEl.innerHTML = '<li class="empty">' + esc(problem) + '</li>';
        statusEl.textContent = '';
        return;
      }
      const mySeq = ++seq;
      if (!listEl.children.length) listEl.innerHTML = '<li class="empty">読み込み中…</li>';

      const { items, failed, total } = await collect(feeds(), filter ? filter() : null, perSource);
      if (mySeq !== seq) return;
      listEl.innerHTML = items.length
        ? itemsHtml(items)
        : '<li class="empty">' + (failed === total ? 'ニュースを取得できませんでした。' : '該当する記事がありません。') + '</li>';
      statusEl.textContent = '更新 ' + hhmm(new Date()) + (failed ? '（' + failed + '件のフィードを取得できませんでした）' : '');
    }

    return {
      start() {
        clearInterval(timer);
        render();
        timer = setInterval(render, DASH.REFRESH.newsMs);
      },
      refresh: render,
    };
  }

  function renderTabs() {
    const tabs = enabledTabs();
    $('#news-tabs').innerHTML = tabs.map((t, i) =>
      '<button type="button" role="tab" class="tab' + (i === activeIndex ? ' active' : '') + '" aria-selected="' + (i === activeIndex) + '" data-index="' + i + '">' + esc(tabName(t)) + '</button>',
    ).join('');
  }

  async function renderList() {
    const tabs = enabledTabs();
    const list = $('#news-list');
    const status = $('#news-status');
    if (!tabs.length) {
      list.innerHTML = '<li class="empty">表示するジャンルがありません。⚙設定からジャンルを選んでください。</li>';
      status.textContent = '';
      return;
    }
    const seq = ++renderSeq;
    const tab = tabs[activeIndex];
    if (!list.children.length || list.dataset.tab !== String(activeIndex)) {
      list.innerHTML = '<li class="empty">読み込み中…</li>';
    }
    list.dataset.tab = String(activeIndex);

    const { items, failed, total } = await loadTab(tab);
    if (seq !== renderSeq) return; // 別のタブに切り替わった

    if (!items.length) {
      list.innerHTML = '<li class="empty">' + (failed && failed === total
        ? 'ニュースを取得できませんでした。' + (tab.type === 'rss' ? 'このフィードはブラウザからの直接取得（CORS）に対応していない可能性があります。' : '')
        : '該当する記事がありません。') + '</li>';
    } else {
      list.innerHTML = itemsHtml(items);
    }
    status.textContent = '更新 ' + hhmm(new Date()) + (failed ? '（' + failed + '件のフィードを取得できませんでした）' : '');
  }

  function select(index) {
    const count = enabledTabs().length;
    if (!count) return;
    activeIndex = ((index % count) + count) % count;
    save(ACTIVE_KEY, activeIndex);
    renderTabs();
    renderList();
  }

  function setupRotation() {
    clearInterval(rotateTimer);
    const sec = DASH.settings.news.rotateSec;
    if (sec > 0) {
      rotateTimer = setInterval(() => {
        if (!hovering) select(activeIndex + 1);
      }, sec * 1000);
    }
  }

  let bound = false;
  function bindOnce() {
    if (bound) return;
    bound = true;
    $('#news-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-index]');
      if (btn) select(Number(btn.dataset.index));
    });
    const card = $('#news-card');
    card.addEventListener('mouseenter', () => { hovering = true; });
    card.addEventListener('mouseleave', () => { hovering = false; });
  }

  DASH.news = {
    start() {
      bindOnce();
      const count = enabledTabs().length;
      activeIndex = Math.min(Number(load(ACTIVE_KEY, 0)) || 0, Math.max(0, count - 1));
      renderTabs();
      renderList();
      setupRotation();
      clearInterval(refreshTimer);
      refreshTimer = setInterval(renderList, DASH.REFRESH.newsMs);
    },

    refresh() {
      cache.clear();
      return renderList();
    },

    // 設定画面で追加するフィードの事前確認用
    async test(url) {
      return (await fetchFeed(url)).length;
    },

    // 中継サーバーの接続確認用（設定画面）
    testRelay(relayUrl) {
      const feed = DASH.TECH_NEWS_FEEDS.find((f) => f.relay);
      return DASH.news.test(relayed(feed.url, relayUrl));
    },

    // 生成AIニュース・ITテックニュース・ITセキュリティニュースのパネルと共用
    createPanel,
    allGenreFeeds,
    keywordFilter,
    pickFeeds,
  };
})(window.DASH);
