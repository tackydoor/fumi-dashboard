'use strict';

// 共通ユーティリティ
(function (DASH) {
  const SETTINGS_KEY = 'mydashboard.settings.v1';

  const util = {
    $(sel, root) {
      return (root || document).querySelector(sel);
    },

    esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[c]);
    },

    clone(obj) {
      return JSON.parse(JSON.stringify(obj));
    },

    async fetchWithTimeout(url, ms) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), ms || 15000);
      try {
        const res = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res;
      } finally {
        clearTimeout(timer);
      }
    },

    async fetchJson(url, ms) {
      return (await util.fetchWithTimeout(url, ms)).json();
    },

    async fetchText(url, ms) {
      return (await util.fetchWithTimeout(url, ms)).text();
    },

    // 「5分前」のような相対時刻
    relTime(date) {
      const diff = (Date.now() - date.getTime()) / 1000;
      if (diff < 60) return 'たった今';
      if (diff < 3600) return Math.floor(diff / 60) + '分前';
      if (diff < 86400) return Math.floor(diff / 3600) + '時間前';
      if (diff < 86400 * 7) return Math.floor(diff / 86400) + '日前';
      return (date.getMonth() + 1) + '/' + date.getDate();
    },

    hhmm(date) {
      return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    },

    // localStorage はプライベートモード等で使えないことがあるため例外を握りつぶす
    load(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },

    save(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* 保存できなくても動作は継続 */
      }
    },

    loadSettings() {
      const saved = util.load(SETTINGS_KEY, null);
      const s = util.clone(DASH.DEFAULT_SETTINGS);
      if (!saved || typeof saved !== 'object') return s;

      if (['auto', 'dark', 'light'].includes(saved.theme)) s.theme = saved.theme;
      if (saved.location && typeof saved.location === 'object') Object.assign(s.location, saved.location);
      if (saved.news && typeof saved.news === 'object') {
        if (Array.isArray(saved.news.tabs)) {
          const tabs = saved.news.tabs.filter((t) => t && (t.type !== 'genre' || DASH.NEWS_GENRES.some((g) => g.id === t.id)));
          // 後から追加された組み込みジャンルは末尾に（非表示で）足す
          DASH.NEWS_GENRES.forEach((g) => {
            if (!tabs.some((t) => t.type === 'genre' && t.id === g.id)) tabs.push({ type: 'genre', id: g.id, enabled: false });
          });
          s.news.tabs = tabs;
        }
        if (saved.news.sources) Object.assign(s.news.sources, saved.news.sources);
        if (Number(saved.news.perTab) > 0) s.news.perTab = Number(saved.news.perTab);
        if (Number(saved.news.rotateSec) >= 0) s.news.rotateSec = Number(saved.news.rotateSec);
      }
      if (Array.isArray(saved.layout)) {
        const known = new Set(DASH.PANELS.map((p) => p.id));
        const layout = saved.layout.filter((p) => p && known.has(p.id));
        if (layout.length) {
          DASH.PANELS.forEach((p) => {
            if (!layout.some((x) => x.id === p.id)) layout.push({ id: p.id, visible: true, w: 4, h: 3 });
          });
          s.layout = layout;
        }
      }
      if (saved.market && typeof saved.market === 'object') {
        if (saved.market.range) s.market.range = saved.market.range;
        if (Array.isArray(saved.market.symbols)) s.market.symbols = saved.market.symbols.filter((x) => x && x.symbol);
      }
      return s;
    },

    saveSettings(settings) {
      util.save(SETTINGS_KEY, settings);
    },

    effectiveTheme() {
      const t = DASH.settings.theme;
      if (t === 'dark' || t === 'light') return t;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },

    applyTheme() {
      const t = DASH.settings.theme;
      if (t === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', t);
    },
  };

  DASH.util = util;
})(window.DASH);
