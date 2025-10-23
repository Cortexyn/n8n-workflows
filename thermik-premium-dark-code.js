// =============================================================================
// THERMIK-VORHERSAGE EDXE - Premium Dark Design + Telegram
// Inspiriert von Steam Deals + thecodingcortex.org
// =============================================================================

const items = $input.all();
const data = items[0]?.json;

if (!data) {
  throw new Error('Keine Meteoblue-Daten vorhanden');
}

// =============================================================================
// DARK THEME COLOR PALETTE
// =============================================================================

const palette = {
  // Dark Background (wie Steam Deals)
  bg: '#0e1621',
  cardBg: '#1a2332',
  cardDark: '#0e1621',

  // Text Colors
  textPrimary: '#f5e6d3',
  textSecondary: '#d4e3f0',
  textTertiary: '#8f98a0',
  textQuaternary: '#66788a',

  // Accent Colors (von thecodingcortex.org)
  accentGold: '#FFB300',   // Sonne/Gold
  accentTeal: '#36C3F2',   // Himmel/Exzellent
  accentBlue: '#1e90ff',   // CTA Buttons
  accentBlueDark: '#0066cc',

  // Structural
  border: '#2a3f5f',
  shadow: 'rgba(0,0,0,0.5)',
  divider: 'rgba(102, 192, 244, 0.3)'
};

// Score Colors (Thermik-Qualität)
const scoreColors = {
  0: { bg: '#ff6b6b', gradient: 'linear-gradient(135deg, #ff6b6b 0%, #d32f2f 100%)', label: 'Keine Thermik', emoji: '🔴' },
  1: { bg: '#ff8a65', gradient: 'linear-gradient(135deg, #ff8a65 0%, #e64a19 100%)', label: 'Sehr schwach', emoji: '🔴' },
  2: { bg: '#ffa726', gradient: 'linear-gradient(135deg, #ffa726 0%, #f57c00 100%)', label: 'Schwach', emoji: '🟠' },
  3: { bg: '#FFB300', gradient: 'linear-gradient(135deg, #FFB300 0%, #f57f17 100%)', label: 'Brauchbar', emoji: '🟡' },
  4: { bg: '#66bb6a', gradient: 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)', label: 'Gut', emoji: '🟢' },
  5: { bg: '#36C3F2', gradient: 'linear-gradient(135deg, #36C3F2 0%, #0288d1 100%)', label: 'Exzellent', emoji: '🟢' }
};

// =============================================================================
// Helper Functions
// =============================================================================

function pick(o, ...keys) {
  for (const k of keys) {
    if (o && o[k] != null) return o[k];
  }
  return null;
}

function mean(arr) {
  const valid = arr.filter(v => Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function round(v, decimals = 1) {
  if (v == null) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

function pct(v) {
  return v == null ? null : Math.round(v);
}

function estimateTd(t, rh) {
  if (t == null || rh == null) return null;
  return t - (100 - rh) / 5;
}

// =============================================================================
// API Parsing
// =============================================================================

function parseSeries(j) {
  const d1 = j?.data_1h;
  const basic1h = j['basic-1h'] || j.basic_1h;
  const clouds1h = j['clouds-1h'] || j.clouds_1h;
  const air1h = j['air-1h'] || j.air_1h;

  const time = d1?.time || basic1h?.time || air1h?.time || clouds1h?.time;
  if (!time) throw new Error('Keine 1h Zeitreihe gefunden.');

  const temp = pick(d1, 'temperature', 'temperature_2m') || pick(basic1h || air1h, 'temperature', 'temperature_2m', 't_2m');
  const rh = pick(d1, 'relative_humidity', 'relativehumidity_2m') || pick(basic1h || air1h, 'relative_humidity', 'relativehumidity_2m');
  const wind10 = pick(d1, 'windspeed', 'windspeed_10m') || pick(basic1h || air1h, 'windspeed', 'windspeed_10m');
  const winddir = pick(d1, 'winddirection', 'winddirection_10m') || pick(basic1h || air1h, 'winddirection', 'winddirection_10m');
  const precip = pick(d1, 'precipitation', 'precipitation_1h') || pick(basic1h, 'precipitation', 'precipitation_1h');
  const tcc = pick(d1, 'totalcloudcover_total', 'totalcloudcover') || pick(clouds1h, 'totalcloudcover_total', 'totalcloudcover');
  const sunmin = pick(d1, 'sunshine', 'sunshine_time') || pick(clouds1h, 'sunshine', 'sunshine_time');
  const blh = pick(d1, 'boundarylayer_height') || pick(air1h, 'boundarylayer_height');
  const cape = pick(d1, 'cape') || pick(air1h, 'cape');
  const cin = pick(d1, 'cin') || pick(air1h, 'cin');
  const td = pick(d1, 'dewpoint_2m') || pick(air1h, 'dewpoint_2m');

  return { time, temp, rh, wind10, winddir, precip, tcc, sunmin, blh, cape, cin, td };
}

function groupByDay(times) {
  const out = {};
  for (let i = 0; i < times.length; i++) {
    const dt = new Date(times[i]);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    (out[key] ||= []).push(i);
  }
  return out;
}

// =============================================================================
// Thermik Score Calculation
// =============================================================================

function thermicScore(p) {
  let s = 0;
  const { sun, tcc, rr, blh, cape, cin, wind10, t2m, td2m } = p;

  if (sun != null) {
    if (sun >= 45) s += 2;
    else if (sun >= 20) s += 1;
    else if (sun <= 5) s -= 1;
  }

  if (tcc != null) {
    if (tcc <= 20) s += 1;
    else if (tcc >= 85) s -= 1;
  }

  if (rr != null) {
    if (rr > 0) s -= (rr >= 1 ? 2 : 1);
  }

  if (blh != null) {
    if (blh >= 1800) s += 2;
    else if (blh >= 1200) s += 1;
    else if (blh < 600) s -= 1;
  }

  if (cape != null) {
    if (cape >= 50 && cape <= 600) s += 1;
    if (cape > 800) s -= 1;
  }

  if (cin != null && cin < -50) s -= 1;

  if (wind10 != null) {
    if (wind10 >= 2 && wind10 <= 6) s += 1;
    else if (wind10 > 9) s -= 1;
  }

  if (t2m != null && td2m != null) {
    const spread = t2m - td2m;
    if (spread >= 6 && spread <= 12) s += 1;
    else if (spread < 3) s -= 1;
  }

  return Math.max(0, Math.min(5, Math.round(s)));
}

function labelForScore(sc) {
  if (sc <= 0) return 'Thermik 0/5. Praktisch keine nutzbaren Bärte.';
  if (sc === 1) return 'Thermik 1/5. Fetzen, selten zentrierbar.';
  if (sc === 2) return 'Thermik 2/5. Schwach, kurzlebig.';
  if (sc === 3) return 'Thermik 3/5. Brauchbar mit Arbeit.';
  if (sc === 4) return 'Thermik 4/5. Gut, teils kräftig.';
  return 'Thermik 5/5. Sehr gut.';
}

// =============================================================================
// Steigwerte Calculation
// =============================================================================

function climbFromPhysics(p) {
  const cape = Math.max(0, p.cape || 0);
  const blh_km = Math.max(0, (p.blh || 0) / 1000);
  const sunFrac = Math.max(0, Math.min(1, (p.sun || 0) / 60));
  const tccFrac = Math.max(0, Math.min(1, (p.tcc || 0) / 100));
  const rr = Math.max(0, p.precip || 0);
  const wind = Math.max(0, p.wind || 0);

  let w = 0.02 * Math.sqrt(cape) + 0.6 * blh_km + 0.3 * sunFrac;
  w -= 0.8 * tccFrac;
  w -= 0.5 * Math.min(rr, 2.0);
  w -= Math.max(0, wind - 8) * 0.08;

  return Math.max(0, Math.min(w, 5.0));
}

// =============================================================================
// Phase Blocks
// =============================================================================

function buildPhaseBlocks(idxs, series) {
  const phases = [
    { key: 'morning', label: 'Vormittag (08–12 Uhr)', icon: '☀️', from: 8, to: 12 },
    { key: 'early', label: 'Früher Nachmittag (12–15 Uhr)', icon: '🌤️', from: 12, to: 15 },
    { key: 'late', label: 'Später Nachmittag (15–18 Uhr)', icon: '⛅', from: 15, to: 18 },
    { key: 'eve', label: 'Abends (nach 18 Uhr)', icon: '🌙', from: 18, to: 21 }
  ];

  const blocks = [];

  for (const phase of phases) {
    const pickIdx = idxs.filter(i => {
      const hour = new Date(series.time[i]).getHours();
      return hour >= phase.from && hour < phase.to;
    });

    if (!pickIdx.length) continue;

    const avgField = (field) => {
      if (!field) return null;
      return mean(pickIdx.map(i => field[i]).filter(Number.isFinite));
    };

    const t2m = avgField(series.temp);
    const rh = avgField(series.rh);
    const td2m = series.td ? avgField(series.td) : estimateTd(t2m, rh);
    const tcc = avgField(series.tcc);
    const rr = avgField(series.precip) ?? 0;
    const blh = avgField(series.blh);
    const cape = avgField(series.cape);
    const cin = avgField(series.cin);
    const wind10 = avgField(series.wind10);
    const sun = avgField(series.sunmin);

    const score = thermicScore({ sun, tcc, rr, blh, cape, cin, wind10, t2m, td2m });

    const lines = [];

    if (phase.key === 'morning') {
      lines.push(`• Bewölkung ${pct(tcc)} %, Schauer ${round(rr)} mm/h, BLH ~${round((blh || 0) / 1000)} km`);
      lines.push(`• ${labelForScore(score)}`);
    } else if (phase.key === 'early') {
      lines.push(`• Bewölkung ${pct(tcc)} %, ggf. Schauerpeak, BLH bis ~${round((blh || 0) / 1000)} km`);
      lines.push(`• CAPE ~${Math.round(cape || 0)} J/kg, ${labelForScore(score)}`);
    } else if (phase.key === 'late') {
      lines.push(`• Schauertrend ↓, TCC ~${pct(tcc)} %, BLH ~${round((blh || 0) / 1000)} km`);
      lines.push(`• Bestes Tagesfenster → ${labelForScore(score)}`);
    } else {
      const adjusted = Math.max(0, score - 1);
      lines.push(`• Einstrahlung ↓, BLH fällt`);
      lines.push(`• ${labelForScore(adjusted)} Ende`);
    }

    blocks.push({
      icon: phase.icon,
      title: phase.label,
      lines,
      score
    });
  }

  return blocks;
}

// =============================================================================
// Weather Icon Helper
// =============================================================================

function getWeatherIcon(tcc, rr) {
  if (rr > 1) return '🌧️';
  if (rr > 0) return '🌦️';
  if (tcc > 70) return '⛅';
  if (tcc > 40) return '🌤️';
  return '☀️';
}

// Wird in Teil 2 fortgesetzt...
