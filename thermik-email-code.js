// =============================================================================
// THERMIK-VORHERSAGE EDXE - Email-optimierter Code
// Table-basiertes Layout für maximale E-Mail-Client-Kompatibilität
// =============================================================================

const items = $input.all();
const data = items[0]?.json;

if (!data) {
  throw new Error('Keine Meteoblue-Daten vorhanden');
}

// Farbpalette (Papercraft-Design, Solid Colors für E-Mail)
const palette = {
  bg: '#f4efe6',
  ink: '#2b2b2b',
  edge: '#7a5a2e',
  card: '#fff9e9',
  shadow: '#d9c9a5',
  accent: '#d1b98f',
  sun: '#ffbe0b',
  cloud: '#9db0c6',
  rain: '#85c5ff',
  blh: '#7fbf7f'
};

// Solid Colors statt Gradients (bessere E-Mail-Kompatibilität)
const scoreColors = {
  0: '#ffd2dc', // Rot
  1: '#ffd6c4', // Orange
  2: '#ffe29a', // Gelb
  3: '#c9f5b9', // Hellgrün
  4: '#9ff5ce', // Grün
  5: '#a8d4ff'  // Blau
};

// =============================================================================
// Hilfsfunktionen
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
// API-Parsing
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
// Thermikscore-Berechnung
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
// Steigwerte-Berechnung (CAPE/BLH-basiert)
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
// Phasen-Beschreibungen
// =============================================================================

function buildPhaseBlocks(idxs, series) {
  const phases = [
    { key: 'morning', label: 'Vormittag (08–12 Uhr)', from: 8, to: 12 },
    { key: 'early', label: 'Früher Nachmittag (12–15 Uhr)', from: 12, to: 15 },
    { key: 'late', label: 'Später Nachmittag (15–18 Uhr)', from: 15, to: 18 },
    { key: 'eve', label: 'Abends (nach 18 Uhr)', from: 18, to: 21 }
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
      lines.push(`• Bewölkung ${pct(tcc)} %, Schauer ${round(rr)} mm/h, BLH ~${round((blh || 0) / 1000)} km → ${labelForScore(score)}`);
    } else if (phase.key === 'early') {
      lines.push(`• Bewölkung ${pct(tcc)} %, ggf. Schauerpeak, BLH bis ~${round((blh || 0) / 1000)} km; CAPE ~${Math.round(cape || 0)} J/kg.`);
      lines.push(`• Einstrahlung/Niederschlag begrenzen → ${labelForScore(score)} Kurze Fenster möglich.`);
    } else if (phase.key === 'late') {
      lines.push(`• Schauertrend ↓, TCC ~${pct(tcc)} %, BLH ~${round((blh || 0) / 1000)} km, CAPE ~${Math.round(cape || 0)} J/kg.`);
      lines.push(`• Bestes Tagesfenster → ${labelForScore(score)}`);
    } else {
      const adjusted = Math.max(0, score - 1);
      lines.push(`• Einstrahlung ↓, BLH fällt → ${labelForScore(adjusted)} Ende.`);
    }

    blocks.push({
      title: phase.label,
      lines
    });
  }

  return blocks;
}

// =============================================================================
// HTML-Generierung (EMAIL-OPTIMIERT mit Tables)
// =============================================================================

function buildTimelineHTML(idxs, series) {
  const hours = idxs
    .map(i => ({ i, h: new Date(series.time[i]).getHours() }))
    .filter(x => x.h >= 7 && x.h <= 19);

  const uniqueHours = [...new Set(hours.map(x => x.h))].sort((a, b) => a - b);

  const barCells = uniqueHours.map(h => {
    const idx = hours.find(x => x.h === h)?.i;
    if (idx == null) return '';

    const t2m = series.temp?.[idx];
    const rh = series.rh?.[idx];
    const td2m = series.td?.[idx] ?? estimateTd(t2m, rh);
    const sun = series.sunmin?.[idx] || 0;
    const tcc = series.tcc?.[idx] || 0;
    const rr = series.precip?.[idx] || 0;
    const blh = series.blh?.[idx] || 0;
    const cape = series.cape?.[idx] || 0;
    const cin = series.cin?.[idx];
    const wind10 = series.wind10?.[idx];

    const score = thermicScore({ sun, tcc, rr, blh, cape, cin, wind10, t2m, td2m });

    const barHeight = Math.max(20, 26 + score * 18);
    const bgColor = scoreColors[score] || scoreColors[0];

    // Zusatz-Info (Wind, BLH-Marker, CAPE-Risk)
    const windText = wind10 != null ? `${Math.round(wind10)} m/s` : '';
    const blhMarker = blh > 1500 ? '🟢' : '';
    const riskMarker = cape > 800 && rr > 0 ? '⚠️' : '';

    return `
      <td style="width:${100 / uniqueHours.length}%; vertical-align:bottom; padding:2px; text-align:center;">
        <table role="presentation" style="width:100%; border-collapse:collapse; margin:0 auto;">
          <tr>
            <td style="height:${barHeight}px; background:${bgColor}; border:2px solid ${palette.edge}; border-radius:6px; font-size:9px; vertical-align:middle; position:relative;">
              ${blhMarker}${riskMarker}
            </td>
          </tr>
          <tr>
            <td style="font-size:10px; font-weight:bold; color:#5a4a2a; padding-top:3px;">${String(h).padStart(2, '0')}h</td>
          </tr>
          <tr>
            <td style="font-size:8px; color:#5a4a2a;">${windText}</td>
          </tr>
        </table>
      </td>`;
  }).join('');

  return `
    <table role="presentation" style="width:100%; border-collapse:collapse; margin-top:10px; background:#ffffff; border:2px solid ${palette.accent}; border-radius:10px;">
      <tr>
        <td style="padding:10px;">
          <div style="font-size:12px; font-weight:600; margin-bottom:8px; color:${palette.ink};">Timeline 07–19 Uhr</div>
          <table role="presentation" style="width:100%; border-collapse:collapse;">
            <tr>${barCells}</tr>
          </table>
          <div style="margin-top:8px; font-size:10px; color:#5a4a2a;">
            <span style="display:inline-block; width:12px; height:8px; background:${scoreColors[0]}; border:1px solid ${palette.edge}; margin-right:4px;"></span>0
            <span style="display:inline-block; width:12px; height:8px; background:${scoreColors[3]}; border:1px solid ${palette.edge}; margin:0 4px 0 8px;"></span>3
            <span style="display:inline-block; width:12px; height:8px; background:${scoreColors[5]}; border:1px solid ${palette.edge}; margin:0 4px 0 8px;"></span>5
            | 🟢 BLH>1500m | ⚠️ CAPE-Risk
          </div>
        </td>
      </tr>
    </table>`;
}

function buildClimbBoxHTML(idxs, series) {
  const hours = idxs
    .map(i => ({ i, h: new Date(series.time[i]).getHours() }))
    .filter(x => x.h >= 7 && x.h <= 19);

  const uniqueHours = [...new Set(hours.map(x => x.h))].sort((a, b) => a - b);

  const climbData = uniqueHours.map(h => {
    const idx = hours.find(x => x.h === h)?.i;
    if (idx == null) return { h, climb: 0 };

    const sun = series.sunmin?.[idx] || 0;
    const tcc = series.tcc?.[idx] || 0;
    const rr = series.precip?.[idx] || 0;
    const blh = series.blh?.[idx] || 0;
    const cape = series.cape?.[idx] || 0;
    const wind10 = series.wind10?.[idx] || 0;

    const climb = climbFromPhysics({ sun, tcc, precip: rr, blh, cape, wind: wind10 });

    return { h, climb };
  });

  const maxClimb = Math.max(2.5, ...climbData.map(x => x.climb));

  // Horizontale Balken-Chart (E-Mail-kompatibel)
  const rows = climbData.map(d => {
    const barWidth = Math.round((d.climb / maxClimb) * 200);
    return `
      <tr>
        <td style="padding:3px 8px; font-size:10px; font-weight:600; color:#5a4a2a; text-align:right; width:30px;">${String(d.h).padStart(2, '0')}h</td>
        <td style="padding:3px 4px;">
          <div style="width:${barWidth}px; max-width:200px; height:12px; background:#2e7d32; border:1px solid ${palette.edge}; border-radius:4px;"></div>
        </td>
        <td style="padding:3px 8px; font-size:10px; color:#5a4a2a;">${round(d.climb, 1)} m/s</td>
      </tr>`;
  }).join('');

  return `
    <table role="presentation" style="width:100%; border-collapse:collapse; margin-top:10px; background:#ffffff; border:2px solid ${palette.accent}; border-radius:10px;">
      <tr>
        <td style="padding:10px;">
          <div style="font-size:12px; font-weight:600; margin-bottom:8px; color:${palette.ink};">
            Steigwerte
            <span style="font-size:10px; padding:2px 6px; border:1px solid #c3a46b; border-radius:12px; background:#fffef7; margin-left:6px;">m/s</span>
            <span style="font-size:10px; padding:2px 6px; border:1px solid #c3a46b; border-radius:12px; background:#fffef7; margin-left:4px;">CAPE/BLH</span>
          </div>
          <table role="presentation" style="width:100%; border-collapse:collapse;">
            ${rows}
          </table>
        </td>
      </tr>
    </table>`;
}

function buildPhaseHTML(blocks) {
  return blocks.map(block => `
    <table role="presentation" style="width:100%; border-collapse:collapse; margin-top:10px;">
      <tr>
        <td style="background:#fffef7; border:2px solid ${palette.accent}; border-radius:10px; padding:10px;">
          <div style="font-size:13px; font-weight:600; color:${palette.ink}; margin-bottom:6px;">${block.title}</div>
          ${block.lines.map(line => `<div style="font-size:12px; color:${palette.ink}; line-height:1.5; margin:2px 0;">${line}</div>`).join('')}
        </td>
      </tr>
    </table>`).join('');
}

// =============================================================================
// Hauptlogik
// =============================================================================

const series = parseSeries(data);
const daysMap = groupByDay(series.time);
const dayKeys = Object.keys(daysMap).sort().slice(0, 3);

if (!dayKeys.length) {
  throw new Error('Keine Tagesfenster in den Daten gefunden.');
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Europe/Berlin'
});

const days = dayKeys.map(key => {
  const idxs = daysMap[key];
  const dateMid = new Date(key + 'T12:00:00Z');
  const title = dateFormatter.format(dateMid);

  const dayIdx = idxs.filter(i => {
    const h = new Date(series.time[i]).getHours();
    return h >= 7 && h <= 19;
  });

  const maxScore = dayIdx.length ? Math.max(...dayIdx.map(i => {
    const t2m = series.temp?.[i];
    const rh = series.rh?.[i];
    const td2m = series.td?.[i] ?? estimateTd(t2m, rh);
    return thermicScore({
      sun: series.sunmin?.[i],
      tcc: series.tcc?.[i],
      rr: series.precip?.[i] || 0,
      blh: series.blh?.[i],
      cape: series.cape?.[i],
      cin: series.cin?.[i],
      wind10: series.wind10?.[i],
      t2m,
      td2m
    });
  })) : 0;

  return {
    key,
    title,
    maxScore,
    idxs
  };
});

// Generiere HTML für die 3 Tage (EMAIL-OPTIMIERT mit Tables)
const dayColumns = days.map(day => `
  <td style="width:33.33%; padding:8px; vertical-align:top;">
    <table role="presentation" style="width:100%; border-collapse:collapse; background:${palette.card}; border:3px solid ${palette.edge}; border-radius:12px;">
      <tr>
        <td style="padding:12px;">

          <!-- Header -->
          <table role="presentation" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
            <tr>
              <td style="font-size:17px; font-weight:700; color:${palette.ink}; padding-bottom:6px; border-bottom:2px dashed ${palette.accent};">
                ${day.title}
              </td>
            </tr>
          </table>

          <!-- Summary -->
          <table role="presentation" style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="background:#fffef7; border:2px solid ${palette.accent}; border-radius:10px; padding:10px; font-size:13px; color:${palette.ink};">
                <strong>${day.title}:</strong> Generelle Thermikaussichten <strong style="color:#2e7d32;">${day.maxScore}/5</strong>.
              </td>
            </tr>
          </table>

          <!-- Timeline -->
          ${buildTimelineHTML(day.idxs, series)}

          <!-- Steigwerte -->
          ${buildClimbBoxHTML(day.idxs, series)}

          <!-- Phasen -->
          ${buildPhaseHTML(buildPhaseBlocks(day.idxs, series))}

        </td>
      </tr>
    </table>
  </td>`).join('');

// E-Mail-Betreff
const firstDate = dateFormatter.format(new Date(dayKeys[0] + 'T12:00:00Z'));
const lastDate = dateFormatter.format(new Date(dayKeys[dayKeys.length - 1] + 'T12:00:00Z'));
const subject = `Thermikvorhersage EDXE (${firstDate} – ${lastDate})`;

// Vollständiges HTML-E-Mail-Template (EMAIL-OPTIMIERT)
const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:${palette.bg}; color:${palette.ink}; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" style="width:100%; border-collapse:collapse; background:${palette.bg};">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" style="max-width:1100px; width:100%; border-collapse:collapse;">
          <tr>${dayColumns}</tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

return [{ json: { subject, html } }];
