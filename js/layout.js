'use strict';

// パネルのレイアウト（表示／非表示・並び順・サイズ）と編集モード
(function (DASH) {
  const { $, esc } = DASH.util;
  const COLS = 12;
  const MIN_W = 2;
  const MIN_H = 2;
  const MAX_H = 24;

  let editing = false;
  let drag = null;

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function panelEl(id) {
    return document.querySelector('.card[data-panel="' + id + '"]');
  }

  function panelName(id) {
    return (DASH.PANELS.find((p) => p.id === id) || {}).name || id;
  }

  function findItem(id) {
    return DASH.settings.layout.find((x) => x.id === id);
  }

  // 編集開始時の配置: 今の画面幅の自動レイアウトに近づける
  function defaultLayout() {
    const p = (id, w, h) => ({ id, visible: true, w, h });
    const width = window.innerWidth;
    if (width >= 1400) {
      return [p('clock', 4, 3), p('now', 4, 3), p('market', 4, 12), p('hourly', 8, 3), p('weekly', 8, 3), p('news', 8, 3)];
    }
    if (width >= 1200) {
      return [p('clock', 4, 3), p('now', 8, 3), p('hourly', 8, 3), p('market', 4, 9), p('news', 4, 6), p('weekly', 4, 6)];
    }
    return [p('clock', 5, 3), p('now', 7, 3), p('hourly', 12, 3), p('weekly', 12, 4), p('news', 7, 6), p('market', 5, 6)];
  }

  function save() {
    DASH.util.saveSettings(DASH.settings);
  }

  function applyStyles() {
    const layout = DASH.settings.layout;
    $('.grid').classList.toggle('custom', !!layout);
    DASH.PANELS.forEach((p) => {
      const el = panelEl(p.id);
      const item = layout && layout.find((x) => x.id === p.id);
      if (item) {
        el.style.order = layout.indexOf(item);
        el.style.setProperty('--w', item.w);
        el.style.setProperty('--h', item.h);
        el.hidden = !item.visible;
      } else {
        el.style.removeProperty('order');
        el.style.removeProperty('--w');
        el.style.removeProperty('--h');
        el.hidden = false;
      }
    });
  }

  // 時計パネルが非表示のときは操作ボタンを画面右上に出す
  function placeActions() {
    const actions = $('#actions');
    const clock = panelEl('clock');
    if (clock.hidden) {
      if (actions.parentElement !== document.body) document.body.appendChild(actions);
      actions.classList.add('floating');
    } else if (actions.parentElement !== clock) {
      clock.prepend(actions);
      actions.classList.remove('floating');
    }
  }

  function sizeText(item) {
    return '幅 ' + item.w + ' × 高さ ' + item.h;
  }

  function renderEditUI() {
    const layout = DASH.settings.layout;
    layout.forEach((item) => {
      const el = panelEl(item.id);
      let ov = el.querySelector(':scope > .edit-overlay');
      if (!ov) {
        ov = document.createElement('div');
        ov.className = 'edit-overlay';
        ov.dataset.id = item.id;
        el.appendChild(ov);
      }
      ov.innerHTML =
        '<div class="edit-name">' + esc(panelName(item.id)) + '</div>' +
        '<div class="edit-size" data-size>' + sizeText(item) + '</div>' +
        '<div class="edit-tools">' +
          '<button type="button" data-size data-op="w-" aria-label="幅を狭く">幅−</button>' +
          '<button type="button" data-size data-op="w+" aria-label="幅を広く">幅＋</button>' +
          '<button type="button" data-size data-op="h-" aria-label="高さを低く">高さ−</button>' +
          '<button type="button" data-size data-op="h+" aria-label="高さを高く">高さ＋</button>' +
          '<button type="button" data-op="hide">非表示</button>' +
        '</div>' +
        '<div class="edit-resize" aria-hidden="true"></div>';
    });
    $('#edit-hidden').innerHTML = layout.filter((x) => !x.visible).map((x) =>
      '<button type="button" class="chip" data-show="' + x.id + '" title="表示する">＋ ' + esc(panelName(x.id)) + '</button>',
    ).join('');
  }

  function apply() {
    applyStyles();
    placeActions();
    if (editing) renderEditUI();
  }

  function enter() {
    if (editing) return;
    if (!DASH.settings.layout) DASH.settings.layout = defaultLayout();
    editing = true;
    document.body.classList.add('editing');
    document.querySelectorAll('.card[data-panel]').forEach((c) => { c.scrollTop = 0; });
    $('#edit-bar').hidden = false;
    apply();
    save();
  }

  function exit() {
    editing = false;
    document.body.classList.remove('editing');
    document.querySelectorAll('.edit-overlay').forEach((ov) => ov.remove());
    $('#edit-bar').hidden = true;
    apply();
    save();
  }

  function onClick(e) {
    const btn = e.target.closest('[data-op]');
    if (!btn) return;
    const item = findItem(btn.closest('.edit-overlay').dataset.id);
    switch (btn.dataset.op) {
      case 'w-': item.w = clamp(item.w - 1, MIN_W, COLS); break;
      case 'w+': item.w = clamp(item.w + 1, MIN_W, COLS); break;
      case 'h-': item.h = clamp(item.h - 1, MIN_H, MAX_H); break;
      case 'h+': item.h = clamp(item.h + 1, MIN_H, MAX_H); break;
      case 'hide': item.visible = false; break;
      default: return;
    }
    apply();
    save();
  }

  function onPointerDown(e) {
    if (!editing || e.button !== 0 || e.target.closest('button')) return;
    const ov = e.target.closest('.edit-overlay');
    if (!ov) return;
    e.preventDefault();
    const item = findItem(ov.dataset.id);
    const el = panelEl(item.id);
    const handle = e.target.closest('.edit-resize');
    const target = handle || ov;
    try {
      target.setPointerCapture(e.pointerId);
    } catch (err) {
      /* キャプチャできなくても対象要素上の操作は受け取れる */
    }

    if (handle) {
      // 1列・1行あたりの移動量を今の描画サイズから求める
      const grid = $('.grid');
      const cs = getComputedStyle(grid);
      const gap = parseFloat(cs.columnGap) || 0;
      const inner = grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const rect = el.getBoundingClientRect();
      drag = {
        type: 'resize', item, target, el,
        x: e.clientX, y: e.clientY, w: item.w, h: item.h,
        unitW: (inner - gap * (COLS - 1)) / COLS + gap,
        unitH: (rect.height - gap * (item.h - 1)) / item.h + gap,
      };
    } else {
      drag = { type: 'move', item, target, el, lock: null };
      el.classList.add('dragging');
    }
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e) {
    if (!drag) return;
    const item = drag.item;

    if (drag.type === 'resize') {
      const w = clamp(drag.w + Math.round((e.clientX - drag.x) / drag.unitW), MIN_W, COLS);
      const h = clamp(drag.h + Math.round((e.clientY - drag.y) / drag.unitH), MIN_H, MAX_H);
      if (w !== item.w || h !== item.h) {
        item.w = w;
        item.h = h;
        applyStyles();
        drag.el.querySelector('.edit-size').textContent = sizeText(item);
      }
      return;
    }

    // 入れ替え直後は配置が動くので、少し動かすまで次の入れ替えをしない（行ったり来たりを防ぐ）
    if (drag.lock && Math.hypot(e.clientX - drag.lock.x, e.clientY - drag.lock.y) < 24) return;
    const over = document.elementsFromPoint(e.clientX, e.clientY)
      .map((node) => node.closest('.card[data-panel]'))
      .find((card) => card && card !== drag.el);
    if (!over) return;

    const layout = DASH.settings.layout;
    const from = layout.indexOf(item);
    const rect = over.getBoundingClientRect();
    const after = e.clientX > rect.left + rect.width / 2;
    layout.splice(from, 1);
    const to = layout.findIndex((x) => x.id === over.dataset.panel) + (after ? 1 : 0);
    layout.splice(to, 0, item);
    if (to !== from) {
      applyStyles();
      drag.lock = { x: e.clientX, y: e.clientY };
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    const { target } = drag;
    target.removeEventListener('pointermove', onPointerMove);
    target.removeEventListener('pointerup', onPointerUp);
    target.removeEventListener('pointercancel', onPointerUp);
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    if (drag.type === 'move') drag.el.classList.remove('dragging');
    drag = null;
    apply();
    save();
  }

  DASH.layout = {
    init() {
      const grid = $('.grid');
      grid.addEventListener('click', onClick);
      grid.addEventListener('pointerdown', onPointerDown);

      $('#edit-hidden').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-show]');
        if (!chip) return;
        findItem(chip.dataset.show).visible = true;
        apply();
        save();
      });
      $('#layout-done').addEventListener('click', exit);
      $('#layout-reset').addEventListener('click', () => {
        if (!confirm('画面サイズに合わせた自動レイアウトに戻しますか？（表示・並び順・サイズの変更は元に戻ります）')) return;
        DASH.settings.layout = null;
        exit();
      });
      document.addEventListener('keydown', (e) => {
        if (editing && e.key === 'Escape' && !document.querySelector('dialog[open]')) exit();
      });

      apply();
    },

    apply,
    enter,
  };
})(window.DASH);
