'use strict';

// 株価・マーケット（TradingView ウィジェット）
(function (DASH) {
  const { $, esc } = DASH.util;
  const WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';

  function widget(container, symbol, opts) {
    container.innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div></div>';
    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    // ウィジェットは自身の script 要素の中身を設定として読む
    script.textContent = JSON.stringify(Object.assign({
      symbol,
      width: '100%',
      height: '100%',
      locale: 'ja',
      dateRange: '1D',
      colorTheme: DASH.util.effectiveTheme(),
      isTransparent: true,
      autosize: true,
      largeChartUrl: '',
    }, opts));
    container.firstElementChild.appendChild(script);
  }

  function renderRange() {
    const range = DASH.settings.market.range;
    document.querySelectorAll('#market-range button').forEach((b) => {
      b.classList.toggle('active', b.dataset.range === range);
      b.setAttribute('aria-pressed', String(b.dataset.range === range));
    });
  }

  function render() {
    const { symbols, range } = DASH.settings.market;
    const main = $('#market-main');
    const tiles = $('#market-tiles');
    renderRange();

    if (!symbols.length) {
      main.innerHTML = '<p class="empty">⚙設定から表示する銘柄を追加してください。</p>';
      tiles.innerHTML = '';
      return;
    }

    main.innerHTML = '<div class="m-label">' + esc(symbols[0].label) + '</div><div class="m-widget"></div>';
    widget(main.querySelector('.m-widget'), symbols[0].symbol, { dateRange: range });

    tiles.innerHTML = symbols.slice(1).map((s) =>
      '<div class="tile"><div class="m-label">' + esc(s.label) + '</div><div class="m-widget"></div></div>',
    ).join('');
    tiles.querySelectorAll('.m-widget').forEach((el, i) => {
      widget(el, symbols[i + 1].symbol, { dateRange: range, chartOnly: false, noTimeScale: true });
    });
  }

  let bound = false;

  DASH.market = {
    start() {
      if (!bound) {
        bound = true;
        $('#market-range').addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-range]');
          if (!btn) return;
          DASH.settings.market.range = btn.dataset.range;
          DASH.util.saveSettings(DASH.settings);
          render();
        });
        // OS のテーマ変更に追従
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          if (DASH.settings.theme === 'auto') render();
        });
      }
      render();
    },

    refresh: render,
  };
})(window.DASH);
