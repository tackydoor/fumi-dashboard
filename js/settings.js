'use strict';

// 設定ダイアログ
(function (DASH) {
  const { $, esc, clone } = DASH.util;

  let draft = null;
  let locResults = [];
  let aiShow = false; // 生成AIニュースのパネルを表示するか（保存時にレイアウトへ反映）

  function aiShown(settings) {
    return !!(settings.layout && settings.layout.some((x) => x.id === 'ainews' && x.visible));
  }

  function tabLabel(tab) {
    if (tab.type === 'genre') return (DASH.NEWS_GENRES.find((g) => g.id === tab.id) || {}).name || tab.id;
    if (tab.type === 'keyword') return tab.query;
    return tab.name;
  }

  const TYPE_BADGE = { genre: 'ジャンル', keyword: 'キーワード', rss: 'RSS' };

  function option(value, label, current) {
    return '<option value="' + esc(value) + '"' + (String(value) === String(current) ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  function moveButtons(list, i) {
    return '<button type="button" class="mini" data-act="up" data-list="' + list + '" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="上へ">▲</button>' +
      '<button type="button" class="mini" data-act="down" data-list="' + list + '" data-i="' + i + '" aria-label="下へ">▼</button>';
  }

  function render() {
    const s = draft;
    const loc = s.location;
    const news = s.news;
    const market = s.market;

    $('#settings-body').innerHTML =
      // 地点
      '<fieldset><legend>天気の地点</legend>' +
        '<label class="row"><input type="radio" name="locmode" value="auto"' + (loc.mode === 'auto' ? ' checked' : '') + '> 現在地を自動で取得する（ブラウザの位置情報）</label>' +
        '<label class="row"><input type="radio" name="locmode" value="manual"' + (loc.mode === 'manual' ? ' checked' : '') + '> 地点を指定する</label>' +
        '<div class="indent' + (loc.mode === 'manual' ? '' : ' disabled') + '">' +
          '<div class="row"><input type="search" id="loc-q" placeholder="例: 札幌市、大阪市北区、那覇市" autocomplete="off"><button type="button" class="btn" data-act="loc-search">検索</button></div>' +
          '<ul class="choices" id="loc-results">' + locResults.map((r, i) =>
            '<li><button type="button" data-act="loc-pick" data-i="' + i + '">' + esc(r.name) + '</button></li>').join('') + '</ul>' +
          '<div class="muted small">指定中: ' + (loc.lat != null ? esc(loc.name) + '（' + loc.lat.toFixed(3) + ', ' + loc.lon.toFixed(3) + '）' : '未指定') + '</div>' +
        '</div>' +
      '</fieldset>' +

      // 表示
      '<fieldset><legend>表示</legend>' +
        '<label class="row">テーマ <select data-field="theme">' +
          option('auto', 'OS の設定に合わせる', s.theme) + option('dark', 'ダーク', s.theme) + option('light', 'ライト', s.theme) +
        '</select></label>' +
      '</fieldset>' +

      // ニュース
      '<fieldset><legend>ニュース</legend>' +
        '<p class="muted small">チェックしたジャンルがタブとして上から順に表示されます。</p>' +
        '<ul class="sortable">' + news.tabs.map((t, i) =>
          '<li><label><input type="checkbox" data-act="tab-toggle" data-i="' + i + '"' + (t.enabled ? ' checked' : '') + '> ' +
            '<span class="badge">' + TYPE_BADGE[t.type] + '</span> ' + esc(tabLabel(t)) + '</label>' +
            '<span class="ops">' + moveButtons('tabs', i) +
            (t.type === 'genre' ? '' : '<button type="button" class="mini danger" data-act="tab-del" data-i="' + i + '" aria-label="削除">✕</button>') +
            '</span></li>').join('') + '</ul>' +

        '<div class="sub"><div class="sub-title">キーワードでタブを追加</div>' +
          '<div class="row"><input type="text" id="kw-q" placeholder="例: AI 半導体（スペース区切りでいずれかを含む）"><button type="button" class="btn" data-act="kw-add">追加</button></div>' +
        '</div>' +

        '<div class="sub"><div class="sub-title">RSS フィードを追加</div>' +
          '<div class="row"><input type="text" id="rss-name" placeholder="タブ名" class="w-sm"><input type="url" id="rss-url" placeholder="https://example.com/feed.xml"><button type="button" class="btn" data-act="rss-add">追加</button></div>' +
          '<div class="muted small" id="rss-msg">ブラウザから直接読み込める（CORS 対応の）フィードのみ表示できます。</div>' +
        '</div>' +

        '<div class="sub"><div class="sub-title">提供元</div><div class="row wrap">' +
          Object.entries(DASH.NEWS_SOURCES).map(([key, src]) =>
            '<label><input type="checkbox" data-act="src-toggle" data-key="' + key + '"' + (news.sources[key] !== false ? ' checked' : '') + '> ' + esc(src.name) + '</label>').join('') +
        '</div></div>' +

        '<div class="row wrap">' +
          '<label>表示件数 <select data-field="perTab">' + [10, 15, 20, 30].map((n) => option(n, n + '件', news.perTab)).join('') + '</select></label>' +
          '<label>タブの自動切替 <select data-field="rotateSec">' +
            [[0, 'しない'], [15, '15秒ごと'], [30, '30秒ごと'], [60, '1分ごと'], [180, '3分ごと']].map(([v, l]) => option(v, l, news.rotateSec)).join('') +
          '</select></label>' +
        '</div>' +
      '</fieldset>' +

      // 生成AIニュース
      '<fieldset><legend>生成AIニュース</legend>' +
        '<label class="row"><input type="checkbox" data-act="ai-show"' + (aiShow ? ' checked' : '') + '> 生成AIニュースのパネルを表示する</label>' +
        '<p class="muted small">主要紙（上の「提供元」で選んだもの）と CNET Japan・ZDNET Japan・WIRED.jp から、見出しに次のキーワードのいずれかを含む記事を集めます。1行に1つ入力します（大文字小文字・全角半角は区別しません）。</p>' +
        '<textarea id="ai-keywords" data-field="aiKeywords" rows="6" spellcheck="false">' + esc(s.aiNews.keywords.join('\n')) + '</textarea>' +
        '<div class="row"><button type="button" class="btn ghost" data-act="ai-reset">キーワードを初期値に戻す</button></div>' +
      '</fieldset>' +

      // 株価
      '<fieldset><legend>マーケット</legend>' +
        '<p class="muted small">先頭の銘柄が大きく表示されます。シンボルは TradingView の表記（例: FX_IDC:USDJPY）です。</p>' +
        '<ul class="sortable">' + market.symbols.map((m, i) =>
          '<li><span class="sym-fields">' +
            (i === 0 ? '<span class="badge accent">メイン</span>' : '') +
            '<input type="text" class="w-sm" data-act="sym-label" data-i="' + i + '" value="' + esc(m.label) + '" aria-label="表示名">' +
            '<input type="text" data-act="sym-symbol" data-i="' + i + '" value="' + esc(m.symbol) + '" aria-label="シンボル">' +
          '</span><span class="ops">' + moveButtons('symbols', i) +
            '<button type="button" class="mini danger" data-act="sym-del" data-i="' + i + '" aria-label="削除">✕</button></span></li>').join('') + '</ul>' +
        '<div class="row"><select id="sym-preset">' +
          DASH.MARKET_PRESETS.map((p, i) => option(i, p.label + '（' + p.symbol + '）', -1)).join('') +
          '<option value="custom">任意のシンボルを入力…</option>' +
        '</select><button type="button" class="btn" data-act="sym-add">追加</button></div>' +
      '</fieldset>';
  }

  function swap(arr, i, j) {
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'INPUT') return;
    const act = btn.dataset.act;
    const i = Number(btn.dataset.i);

    switch (act) {
      case 'close':
        $('#settings-dialog').close();
        return;
      case 'save':
        save();
        return;
      case 'reset':
        if (confirm('すべての設定を初期状態に戻しますか？')) {
          draft = clone(DASH.DEFAULT_SETTINGS);
          locResults = [];
          aiShow = false;
          render();
        }
        return;
      case 'up':
      case 'down': {
        const arr = btn.dataset.list === 'tabs' ? draft.news.tabs : draft.market.symbols;
        swap(arr, i, act === 'up' ? i - 1 : i + 1);
        break;
      }
      case 'ai-reset':
        draft.aiNews.keywords = DASH.AI_NEWS_KEYWORDS.slice();
        break;
      case 'tab-del':
        draft.news.tabs.splice(i, 1);
        break;
      case 'kw-add': {
        const q = $('#kw-q').value.trim();
        if (!q) return;
        draft.news.tabs.push({ type: 'keyword', query: q, enabled: true });
        break;
      }
      case 'rss-add': {
        const name = $('#rss-name').value.trim();
        const url = $('#rss-url').value.trim();
        const msg = $('#rss-msg');
        if (!/^https?:\/\//.test(url)) {
          msg.textContent = 'URL を http(s):// から入力してください。';
          return;
        }
        msg.textContent = '確認中…';
        try {
          const count = await DASH.news.test(url);
          draft.news.tabs.push({ type: 'rss', name: name || new URL(url).hostname, url, enabled: true });
          render();
          $('#rss-msg').textContent = '追加しました（' + count + '件の記事）。';
        } catch (err) {
          msg.textContent = '読み込めませんでした（' + err.message + '）。CORS 非対応のフィードはブラウザ単体では表示できません。';
        }
        return;
      }
      case 'sym-del':
        draft.market.symbols.splice(i, 1);
        break;
      case 'sym-add': {
        const v = $('#sym-preset').value;
        if (v === 'custom') {
          const symbol = (prompt('TradingView のシンボルを入力してください（例: FX_IDC:GBPJPY）') || '').trim();
          if (!symbol) return;
          draft.market.symbols.push({ label: symbol.split(':').pop(), symbol });
        } else {
          draft.market.symbols.push(clone(DASH.MARKET_PRESETS[Number(v)]));
        }
        break;
      }
      case 'loc-search': {
        const q = $('#loc-q').value.trim();
        if (!q) return;
        btn.disabled = true;
        try {
          locResults = await DASH.weather.search(q);
          if (!locResults.length) locResults = [];
        } catch (err) {
          locResults = [];
          alert('地点を検索できませんでした（' + err.message + '）');
        }
        render();
        $('#loc-q').value = q;
        return;
      }
      case 'loc-pick': {
        const r = locResults[i];
        Object.assign(draft.location, { mode: 'manual', name: r.name, lat: r.lat, lon: r.lon });
        locResults = [];
        break;
      }
      default:
        return;
    }
    render();
  }

  function onChange(e) {
    const el = e.target;
    const i = Number(el.dataset.i);
    if (el.name === 'locmode') {
      draft.location.mode = el.value;
      render();
    } else if (el.dataset.field === 'theme') {
      draft.theme = el.value;
    } else if (el.dataset.field === 'perTab' || el.dataset.field === 'rotateSec') {
      draft.news[el.dataset.field] = Number(el.value);
    } else if (el.dataset.act === 'tab-toggle') {
      draft.news.tabs[i].enabled = el.checked;
    } else if (el.dataset.act === 'src-toggle') {
      draft.news.sources[el.dataset.key] = el.checked;
    } else if (el.dataset.act === 'ai-show') {
      aiShow = el.checked;
    }
  }

  function onInput(e) {
    const el = e.target;
    const i = Number(el.dataset.i);
    if (el.dataset.act === 'sym-label') draft.market.symbols[i].label = el.value;
    else if (el.dataset.act === 'sym-symbol') draft.market.symbols[i].symbol = el.value.trim();
    else if (el.dataset.field === 'aiKeywords') draft.aiNews.keywords = el.value.split('\n').map((k) => k.trim()).filter(Boolean);
  }

  function onKeydown(e) {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    const target = { 'loc-q': 'loc-search', 'kw-q': 'kw-add', 'rss-url': 'rss-add' }[e.target.id];
    if (target) $('[data-act="' + target + '"]', $('#settings-body')).click();
  }

  function save() {
    const prev = DASH.settings;
    draft.market.symbols = draft.market.symbols.filter((m) => m.symbol);
    if (draft.location.mode === 'manual' && draft.location.lat == null) {
      alert('地点を検索して選択してください。');
      return;
    }
    // 生成AIニュースのパネルの表示はレイアウトの一部として保存する
    if (aiShow !== aiShown(draft)) {
      if (aiShow) draft.layout = DASH.layout.showPanel(draft.layout || DASH.layout.defaultLayout(false), 'ainews');
      else draft.layout.find((x) => x.id === 'ainews').visible = false;
    }
    DASH.settings = draft;
    DASH.util.saveSettings(draft);
    $('#settings-dialog').close();

    DASH.util.applyTheme();
    if (JSON.stringify(prev.layout) !== JSON.stringify(draft.layout)) DASH.layout.apply();
    if (JSON.stringify(prev.location) !== JSON.stringify(draft.location)) DASH.weather.start();
    if (JSON.stringify(prev.news) !== JSON.stringify(draft.news)) DASH.news.start();
    if (JSON.stringify(prev.news) !== JSON.stringify(draft.news) || JSON.stringify(prev.aiNews) !== JSON.stringify(draft.aiNews)) DASH.aiNews.start();
    if (JSON.stringify(prev.market) !== JSON.stringify(draft.market) || prev.theme !== draft.theme) DASH.market.start();
  }

  let bound = false;

  DASH.settingsUI = {
    open() {
      const dlg = $('#settings-dialog');
      if (!bound) {
        bound = true;
        dlg.addEventListener('click', onClick);
        dlg.addEventListener('change', onChange);
        dlg.addEventListener('input', onInput);
        dlg.addEventListener('keydown', onKeydown);
      }
      draft = clone(DASH.settings);
      locResults = [];
      aiShow = aiShown(DASH.settings);
      render();
      dlg.showModal();
    },
  };
})(window.DASH);
