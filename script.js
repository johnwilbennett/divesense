
// STATIONS DATA
const stations = [
  { name: "Cobh", county: "Co. Cork", lat: 51.8489, lon: -8.2995, worldtidesId: "cobh" },
  { name: "Kinsale", county: "Co. Cork", lat: 51.7075, lon: -8.5225, worldtidesId: "kinsale" },
  { name: "Baltimore", county: "Co. Cork", lat: 51.4833, lon: -9.3667, worldtidesId: "baltimore" },
  { name: "Dunmanus Harbour", county: "Co. Cork", lat: 51.55, lon: -9.6833, worldtidesId: "dunmanus" },
  { name: "Castletownbere", county: "Co. Cork", lat: 51.65, lon: -9.9167, worldtidesId: "castletownbere" },
  { name: "Valentia Harbour", county: "Co. Kerry", lat: 51.9333, lon: -10.35, worldtidesId: "valentia" },
  { name: "Dingle Harbour", county: "Co. Kerry", lat: 52.1333, lon: -10.2667, worldtidesId: "dingle" }
];

let currentStation = stations[1]; // Kinsale default
let currentDate = new Date();
let tideCache = new Map();
let weatherCache = new Map();
let selectedChips = new Set();
let currentRisk = "Moderate";

// 16-point wind directions
const windDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

function degreesToDirection(deg) {
  const index = Math.round(deg / 22.5) % 16;
  return windDirections[index];
}

// Format date
function formatDate(date) {
  return `${date.getDate().toString().padStart(2,'0')}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getFullYear()}`;
}

// Initialize stations
function initStations() {
  const container = document.getElementById('stationScroll');
  container.innerHTML = stations.map((station, idx) => `
    <div class="station-card ${station.name === currentStation.name ? 'active' : ''}" data-idx="${idx}">
      ${station.name}<br><small>${station.county}</small>
    </div>
  `).join('');
  
  document.querySelectorAll('.station-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      currentStation = stations[idx];
      initStations();
      loadAllData();
    });
  });
}

// Initialize time wheel (iPhone style)
function initTimeWheel() {
  const wheel = document.getElementById('timeWheel');
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      times.push(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`);
    }
  }
  
  wheel.innerHTML = times.map(t => `<div class="time-option" data-time="${t}">${t}</div>`).join('');
  
  const now = new Date();
  const defaultTime = `${now.getHours().toString().padStart(2,'0')}:${Math.floor(now.getMinutes()/15)*15.toString().padStart(2,'0')}`;
  
  const scrollToTime = (time) => {
    const el = document.querySelector(`.time-option[data-time="${time}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      document.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
      el.classList.add('selected');
    }
  };
  
  wheel.addEventListener('scroll', () => {
    const center = wheel.scrollTop + wheel.clientHeight/2;
    const options = document.querySelectorAll('.time-option');
    let closest = null;
    let minDist = Infinity;
    options.forEach(opt => {
      const dist = Math.abs(opt.offsetTop + opt.offsetHeight/2 - center);
      if (dist < minDist) {
        minDist = dist;
        closest = opt;
      }
    });
    if (closest) {
      document.querySelectorAll('.time-option').forEach(opt => opt.classList.remove('selected'));
      closest.classList.add('selected');
      const time = closest.dataset.time;
      document.getElementById('hourInput').value = time.split(':')[0];
      document.getElementById('minuteInput').value = time.split(':')[1];
    }
  });
  
  scrollToTime(defaultTime);
  
  document.getElementById('hourInput').addEventListener('change', () => {
    const h = document.getElementById('hourInput').value.padStart(2,'0');
    const m = document.getElementById('minuteInput').value.padStart(2,'0');
    scrollToTime(`${h}:${m}`);
  });
  
  document.getElementById('minuteInput').addEventListener('change', () => {
    const h = document.getElementById('hourInput').value.padStart(2,'0');
    const m = document.getElementById('minuteInput').value.padStart(2,'0');
    scrollToTime(`${h}:${m}`);
  });
}

// Dive type change
function initDiveType() {
  const radios = document.querySelectorAll('input[name="diveType"]');
  const coxField = document.getElementById('coxField');
  const timeLabel = document.getElementById('timeLabel');
  
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'Boat') {
        coxField.style.display = 'block';
        timeLabel.innerText = '⏱️ Lines Away Time:';
        document.getElementById('lifeJackets').checked = true;
      } else {
        coxField.style.display = 'none';
        timeLabel.innerText = '⏱️ Kitted Brief Time:';
        document.getElementById('lifeJackets').checked = false;
      }
    });
  });
}

// Mock data (replace with actual API call to Cloudflare function)
async function fetchTideData(station, date) {
  const cacheKey = `${station.name}_${formatDate(date)}`;
  if (tideCache.has(cacheKey)) return tideCache.get(cacheKey);
  
  // Simulate API response - in production, call /api/tides
  const mockTides = {
    events: [
      { type: "High", time: "02:30", height: 4.2 },
      { type: "Low", time: "08:45", height: 1.1 },
      { type: "High", time: "15:00", height: 4.5 },
      { type: "Low", time: "21:15", height: 0.9 }
    ],
    moonPhase: "Waxing Gibbous",
    tideType: Math.random() > 0.5 ? "Springs" : "Neaps"
  };
  
  tideCache.set(cacheKey, mockTides);
  return mockTides;
}

async function fetchWeather(station, date) {
  const cacheKey = `${station.name}_${formatDate(date)}`;
  if (weatherCache.has(cacheKey)) return weatherCache.get(cacheKey);
  
  // Mock hourly data
  const hourly = [];
  for (let hour = 0; hour < 24; hour++) {
    hourly.push({
      time: `${hour.toString().padStart(2,'0')}:00`,
      windSpeed: Math.floor(Math.random() * 20) + 5,
      windDir: Math.floor(Math.random() * 360),
      gusts: Math.floor(Math.random() * 25) + 8,
      swellHeight: Math.random() * 2,
      swellDir: Math.floor(Math.random() * 360),
      visibility: Math.random() * 10 + 5,
      rain: Math.random() * 5,
      cloudCover: Math.floor(Math.random() * 100),
      airTemp: Math.floor(Math.random() * 15) + 10,
      uvIndex: Math.floor(Math.random() * 8)
    });
  }
  
  weatherCache.set(cacheKey, hourly);
  return hourly;
}

// Update tides section
async function updateTides() {
  const tides = await fetchTideData(currentStation, currentDate);
  const html = `
    <div class="tide-type ${tides.tideType === 'Springs' ? 'springs-text' : 'neaps-text'}">
      ${tides.tideType === 'Springs' ? '🌕 SPRINGS' : '🌙 NEAPS'}
    </div>
    ${tides.events.map(e => `
      <div class="tide-event">
        <span>${e.type === 'High' ? '🌊 HIGH' : '⬇️ LOW'}</span>
        <span>${e.time}</span>
        <span>${e.height}m</span>
      </div>
    `).join('')}
    <div>🌙 Moon Phase: ${tides.moonPhase}</div>
  `;
  document.getElementById('tideData').innerHTML = html;
}

// Update hourly cards
async function updateHourly() {
  const weather = await fetchWeather(currentStation, currentDate);
  const tides = await fetchTideData(currentStation, currentDate);
  const selectedTime = document.querySelector('.time-option.selected')?.dataset.time || "12:00";
  
  const container = document.getElementById('hourlyScroll');
  container.innerHTML = weather.map(hour => {
    const closestTide = tides.events.reduce((prev, curr) => {
      const prevDiff = Math.abs(parseInt(prev.time) - parseInt(hour.time));
      const currDiff = Math.abs(parseInt(curr.time) - parseInt(hour.time));
      return currDiff < prevDiff ? curr : prev;
    });
    const isSlack = Math.abs(parseInt(hour.time) - parseInt(closestTide.time)) <= 40;
    
    return `
      <div class="hourly-card ${hour.time === selectedTime ? 'highlight' : ''}">
        <strong>${hour.time}</strong><br>
        💨 ${hour.windSpeed} Bft ${degreesToDirection(hour.windDir)}<br>
        🌊 ${hour.swellHeight.toFixed(1)}m ${degreesToDirection(hour.swellDir)}<br>
        ${isSlack ? '<span style="color:#44ff44">⚡ Slack Water</span>' : ''}
      </div>
    `;
  }).join('');
}

// Update detailed panel
async function updateDetailed() {
  const weather = await fetchWeather(currentStation, currentDate);
  const tides = await fetchTideData(currentStation, currentDate);
  const selectedTime = document.querySelector('.time-option.selected')?.dataset.time || "12:00";
  const hourData = weather.find(w => w.time === selectedTime) || weather[12];
  
  // Calculate risk
  let riskScore = (hourData.windSpeed / 40) + (hourData.swellHeight / 3);
  let riskLevel = "Low";
  if (riskScore > 1.2) riskLevel = "High";
  else if (riskScore > 0.8) riskLevel = "Caution";
  else if (riskScore > 0.4) riskLevel = "Moderate";
  
  currentRisk = riskLevel;
  const riskPositions = { "Low": 12.5, "Moderate": 37.5, "Caution": 62.5, "High": 87.5 };
  document.getElementById('riskPointer').style.marginLeft = `${riskPositions[riskLevel]}%`;
  
  const html = `
    <div class="detail-row"><strong>🌬️ Wind:</strong> ${hourData.windSpeed} Bft ${degreesToDirection(hourData.windDir)} (Gusts ${hourData.gusts} Bft)</div>
    <div class="detail-row"><strong>👁️ Visibility:</strong> ${hourData.visibility.toFixed(1)} km</div>
    <div class="detail-row"><strong>🌧️ Rain:</strong> ${hourData.rain.toFixed(1)} mm</div>
    <div class="detail-row"><strong>☁️ Cloud Cover:</strong> ${hourData.cloudCover}%</div>
    <div class="detail-row"><strong>🌡️ Air Temp:</strong> ${hourData.airTemp}°C</div>
    <div class="detail-row"><strong>☀️ UV Index:</strong> ${hourData.uvIndex}</div>
    <div class="detail-row"><strong>🌊 Swell:</strong> ${hourData.swellHeight.toFixed(1)}m from ${degreesToDirection(hourData.swellDir)}</div>
    <div class="detail-row"><strong>📊 Risk Assessment:</strong> ${riskLevel}</div>
  `;
  document.getElementById('detailedPanel').innerHTML = html;
}

// Initialize chips
function initChips() {
  const categories = ["Reef", "Wreck", "Drift", "Deep", "Night", "Snorkel", "Kelp", "Photography", "Navigation", "Training", "Citizen Science", "Fitness Test"];
  const container = document.getElementById('chipsContainer');
  
  container.innerHTML = categories.map(cat => `
    <span data-chip="${cat}">${cat}</span>
  `).join('');
  
  document.querySelectorAll('.chips span').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active-chip');
      const chipName = chip.dataset.chip;
      if (chip.classList.contains('active-chip')) {
        selectedChips.add(chipName);
      } else {
        selectedChips.delete(chipName);
      }
    });
  });
}

// Auto-select Deep chip if depth >=21m
document.getElementById('maxDepth').addEventListener('change', (e) => {
  const depth = parseInt(e.target.value);
  if (depth >= 21) {
    const deepChip = Array.from(document.querySelectorAll('.chips span')).find(c => c.dataset.chip === 'Deep');
    if (deepChip && !deepChip.classList.contains('active-chip')) {
      deepChip.classList.add('active-chip');
      selectedChips.add('Deep');
    }
  }
});

// Export functions
function getExportData() {
  const diveSite = document.getElementById('diveSite').value;
  const dod = document.getElementById('dod').value;
  const diveType = document.querySelector('input[name="diveType"]:checked').value;
  const selectedTime = document.querySelector('.time-option.selected')?.dataset.time;
  const categories = Array.from(selectedChips).join(', ');
  
  return { diveSite, dod, diveType, selectedTime, categories };
}

document.getElementById('whatsappBtn').addEventListener('click', () => {
  const data = getExportData();
  const text = `DiveSense Plan\n📍 ${currentStation.name}\n🏊 ${data.diveSite}\n⏰ ${data.selectedTime}\n📋 ${data.categories}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

document.getElementById('pdfBtn').addEventListener('click', () => {
  alert('PDF export ready – you can implement jsPDF here');
});

document.getElementById('emailBtn').addEventListener('click', () => {
  const data = getExportData();
  const subject = `Dive Plan - ${data.diveSite}`;
  const body = `Dive Site: ${data.diveSite}\nStation: ${currentStation.name}\nTime: ${data.selectedTime}\nCategories: ${data.categories}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

// Load all data
async function loadAllData() {
  await updateTides();
  await updateHourly();
  await updateDetailed();
}

// Date picker
document.getElementById('datePicker').valueAsDate = new Date();
document.getElementById('datePicker').addEventListener('change', (e) => {
  currentDate = new Date(e.target.value);
  loadAllData();
});

// Initialize everything
function init() {
  initStations();
  initTimeWheel();
  initDiveType();
  initChips();
  loadAllData();
}

init();