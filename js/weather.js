'use strict';

// 天気（Open-Meteo）と現在地の取得
(function (DASH) {
  const { $, esc, fetchJson, load, save, hhmm } = DASH.util;
  const POS_KEY = 'mydashboard.lastPosition';
  const WDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const DIRS = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];

  // WMO 天気コード → [昼アイコン, 夜アイコン, 表記]
  const CODES = {
    0: ['☀️', '🌙', '快晴'],
    1: ['🌤️', '🌙', '晴れ'],
    2: ['⛅', '☁️', '晴れ時々曇り'],
    3: ['☁️', '☁️', '曇り'],
    45: ['🌫️', '🌫️', '霧'],
    48: ['🌫️', '🌫️', '霧（着氷）'],
    51: ['🌦️', '🌧️', '弱い霧雨'],
    53: ['🌦️', '🌧️', '霧雨'],
    55: ['🌧️', '🌧️', '強い霧雨'],
    56: ['🌧️', '🌧️', '着氷性の霧雨'],
    57: ['🌧️', '🌧️', '着氷性の霧雨'],
    61: ['🌦️', '🌧️', '小雨'],
    63: ['🌧️', '🌧️', '雨'],
    65: ['🌧️', '🌧️', '大雨'],
    66: ['🌧️', '🌧️', '着氷性の雨'],
    67: ['🌧️', '🌧️', '着氷性の強い雨'],
    71: ['🌨️', '🌨️', '小雪'],
    73: ['🌨️', '🌨️', '雪'],
    75: ['❄️', '❄️', '大雪'],
    77: ['🌨️', '🌨️', '霧雪'],
    80: ['🌦️', '🌧️', 'にわか雨'],
    81: ['🌧️', '🌧️', 'にわか雨'],
    82: ['⛈️', '⛈️', '激しいにわか雨'],
    85: ['🌨️', '🌨️', 'にわか雪'],
    86: ['❄️', '❄️', '強いにわか雪'],
    95: ['⛈️', '⛈️', '雷雨'],
    96: ['⛈️', '⛈️', '雷雨（ひょう）'],
    99: ['⛈️', '⛈️', '激しい雷雨（ひょう）'],
  };

  function codeInfo(code, isDay) {
    const c = CODES[code] || ['❔', '❔', '不明'];
    return { icon: isDay === 0 ? c[1] : c[0], label: c[2] };
  }

  let current = null; // { name, lat, lon }
  let timer = null;

  function setStatus(text) {
    $('#weather-status').textContent = text;
  }

  // 位置情報 → 地名（BigDataCloud の無料逆ジオコーディング）
  async function reverseGeocode(lat, lon) {
    try {
      const j = await fetchJson('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=ja', 10000);
      const parts = [j.principalSubdivision, j.city || j.locality].filter(Boolean);
      return [...new Set(parts)].join(' ') || '現在地';
    } catch (e) {
      return '現在地';
    }
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('このブラウザは位置情報に対応していません'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 30 * 60 * 1000 },
      );
    });
  }

  async function resolveLocation() {
    const loc = DASH.settings.location;
    if (loc.mode === 'manual' && loc.lat != null && loc.lon != null) {
      return { name: loc.name || '指定地点', lat: loc.lat, lon: loc.lon };
    }

    const cached = load(POS_KEY, null);
    // 先にキャッシュ位置で描画し、取得後に必要なら描き直す
    if (cached && !current) {
      current = cached;
      fetchWeather();
    }
    try {
      const pos = await getPosition();
      const moved = !cached || Math.abs(cached.lat - pos.lat) > 0.02 || Math.abs(cached.lon - pos.lon) > 0.02;
      const name = moved || !cached.name ? await reverseGeocode(pos.lat, pos.lon) : cached.name;
      const result = { name, lat: pos.lat, lon: pos.lon };
      save(POS_KEY, result);
      return result;
    } catch (e) {
      if (cached) return cached;
      DASH.weather.notice = '位置情報を取得できないため' + DASH.FALLBACK_LOCATION.name + 'を表示中（⚙設定で地点を指定できます）';
      return DASH.FALLBACK_LOCATION;
    }
  }

  async function fetchWeather() {
    if (!current) return;
    const params = new URLSearchParams({
      latitude: current.lat.toFixed(4),
      longitude: current.lon.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
      hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      timezone: 'auto',
      timeformat: 'unixtime',
      wind_speed_unit: 'ms',
      forecast_days: '8',
    });
    try {
      const data = await fetchJson('https://api.open-meteo.com/v1/forecast?' + params, 15000);
      render(data);
      setStatus((DASH.weather.notice ? DASH.weather.notice + ' ・ ' : '') + '更新 ' + hhmm(new Date()) + ' ・ Open-Meteo');
    } catch (e) {
      setStatus('天気を取得できませんでした（' + e.message + '）');
    }
  }

  function fmtTemp(v) {
    return v == null ? '--' : Math.round(v);
  }

  function render(data) {
    const tz = data.timezone;
    const fmtHour = new Intl.DateTimeFormat('ja-JP', { hour: 'numeric', hourCycle: 'h23', timeZone: tz });
    const fmtTime = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    const fmtMD = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', timeZone: tz });
    const fmtDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz });
    const dayIdx = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    $('#loc-name').textContent = '📍 ' + current.name;

    // 現在
    const c = data.current;
    const info = codeInfo(c.weather_code, c.is_day);
    const d = data.daily;
    $('#now-icon').textContent = info.icon;
    $('#now-temp').textContent = c.temperature_2m.toFixed(1);
    $('#now-desc').textContent = info.label;
    $('#now-hi').textContent = fmtTemp(d.temperature_2m_max[0]) + '℃';
    $('#now-lo').textContent = fmtTemp(d.temperature_2m_min[0]) + '℃';
    const stats = [
      ['体感', Math.round(c.apparent_temperature) + '℃'],
      ['湿度', c.relative_humidity_2m + '%'],
      ['風', DIRS[Math.round(c.wind_direction_10m / 22.5) % 16] + ' ' + c.wind_speed_10m.toFixed(1) + 'm/s'],
      ['降水量', c.precipitation + 'mm'],
      ['日の出', fmtTime.format(new Date(d.sunrise[0] * 1000))],
      ['日の入', fmtTime.format(new Date(d.sunset[0] * 1000))],
    ];
    $('#now-stats').innerHTML = stats.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>').join('');

    // 直近12時間（現在の時間帯から）
    const h = data.hourly;
    const nowSec = Date.now() / 1000;
    let start = h.time.findIndex((t) => t + 3600 > nowSec);
    if (start < 0) start = 0;
    const cells = [];
    for (let i = start; i < Math.min(start + 12, h.time.length); i++) {
      const hi = codeInfo(h.weather_code[i], h.is_day[i]);
      const pop = h.precipitation_probability[i];
      cells.push(
        '<div class="hour' + (i === start ? ' current' : '') + '" title="' + esc(hi.label) + '">' +
          '<div class="h-time">' + (i === start ? '今' : Number(fmtHour.formatToParts(new Date(h.time[i] * 1000)).find((p) => p.type === 'hour').value) + '時') + '</div>' +
          '<div class="h-icon">' + hi.icon + '</div>' +
          '<div class="h-temp">' + fmtTemp(h.temperature_2m[i]) + '°</div>' +
          '<div class="h-pop"><span class="pop-bar" style="--p:' + (pop || 0) + '%"></span>' + (pop == null ? '-' : pop + '%') + '</div>' +
        '</div>',
      );
    }
    $('#hourly').innerHTML = cells.join('');

    // 週間
    const weekMin = Math.min(...d.temperature_2m_min);
    const weekMax = Math.max(...d.temperature_2m_max);
    const span = Math.max(1, weekMax - weekMin);
    const days = d.time.map((t, i) => {
      const date = new Date(t * 1000 + 12 * 3600 * 1000); // 当地の正午で曜日を判定
      const wd = dayIdx[fmtDay.format(date)];
      const di = codeInfo(d.weather_code[i], 1);
      const lo = d.temperature_2m_min[i];
      const hi = d.temperature_2m_max[i];
      const label = i === 0 ? '今日' : i === 1 ? '明日' : WDAYS[wd];
      const left = ((lo - weekMin) / span) * 100;
      const width = Math.max(4, ((hi - lo) / span) * 100);
      return (
        '<div class="day' + (i === 0 ? ' today' : '') + '">' +
          '<div class="d-label' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + '">' + label + '</div>' +
          '<div class="d-date">' + fmtMD.format(date) + '（' + WDAYS[wd] + '）</div>' +
          '<div class="d-icon" title="' + esc(di.label) + '">' + di.icon + '</div>' +
          '<div class="d-desc">' + esc(di.label) + '</div>' +
          '<div class="d-temp"><span class="hi">' + fmtTemp(hi) + '°</span><span class="lo">' + fmtTemp(lo) + '°</span></div>' +
          '<div class="d-range"><span style="left:' + left + '%;width:' + width + '%"></span></div>' +
          '<div class="d-pop">☂ ' + (d.precipitation_probability_max[i] ?? '-') + '%</div>' +
        '</div>'
      );
    });
    $('#weekly').innerHTML = days.join('');
  }

  DASH.weather = {
    notice: '',

    async start() {
      clearInterval(timer);
      DASH.weather.notice = '';
      current = null;
      setStatus('位置情報を取得中…');
      current = await resolveLocation();
      await fetchWeather();
      timer = setInterval(fetchWeather, DASH.REFRESH.weatherMs);
    },

    refresh() {
      return fetchWeather();
    },

    // 地名検索（国土地理院 地名検索API）
    async search(query) {
      const list = await fetchJson('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent(query), 10000);
      // dataSource のない結果が住所・地名、ある結果は施設なので後ろに回す
      const ranked = [...list.filter((f) => !f.properties.dataSource), ...list.filter((f) => f.properties.dataSource)];
      return ranked.slice(0, 8).map((f) => ({
        name: f.properties.title,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
    },
  };
})(window.DASH);
