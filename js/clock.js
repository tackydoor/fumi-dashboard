'use strict';

// 現在時刻の表示
(function (DASH) {
  const { $, load, save, fetchJson } = DASH.util;
  const WDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const HOLIDAY_URL = 'https://holidays-jp.github.io/api/v1/date.json';
  const HOLIDAY_KEY = 'mydashboard.holidays';

  let holidays = {};
  let lastDateKey = '';

  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function loadHolidays() {
    const cached = load(HOLIDAY_KEY, null);
    const today = dateKey(new Date());
    if (cached && cached.fetched === today) {
      holidays = cached.data;
      return;
    }
    try {
      holidays = await fetchJson(HOLIDAY_URL);
      save(HOLIDAY_KEY, { fetched: today, data: holidays });
    } catch (e) {
      holidays = (cached && cached.data) || {};
    }
    lastDateKey = ''; // 祝日表示を描き直す
  }

  function renderDate(now) {
    const key = dateKey(now);
    if (key === lastDateKey) return;
    lastDateKey = key;

    const day = now.getDay();
    const holiday = holidays[key] || '';
    $('#clock-ymd').textContent = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
    const wday = $('#clock-wday');
    wday.textContent = '（' + WDAYS[day] + '）';
    wday.className = 'wday' + (day === 0 || holiday ? ' sun' : day === 6 ? ' sat' : '');
    $('#clock-holiday').textContent = holiday;

    try {
      $('#clock-era').textContent = new Intl.DateTimeFormat('ja-JP-u-ca-japanese', { era: 'long', year: 'numeric' }).format(now);
    } catch (e) {
      $('#clock-era').textContent = '';
    }
  }

  function tick() {
    const now = new Date();
    renderDate(now);
    $('#clock-hm').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    $('#clock-s').textContent = String(now.getSeconds()).padStart(2, '0');
    // 秒の切り替わりに合わせて次回を予約
    setTimeout(tick, 1000 - now.getMilliseconds() + 10);
  }

  DASH.clock = {
    start() {
      tick();
      loadHolidays();
      setInterval(loadHolidays, 6 * 60 * 60 * 1000);
    },
  };
})(window.DASH);
