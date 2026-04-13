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

let currentStation = stations[1];
let currentDate = new Date();
let selectedChips = new Set();
let currentRisk = "Moderate";
let currentRiskPercent = 37.5;
let currentHour = new Date().getHours();
let currentMinute = new Date().getMinutes();
let currentCalendarMonth = new Date();
let isShallowMode = false;

const windDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const weatherIcons = {
  clear: '☀️',
  partlyCloudy: '⛅',
  cloudy: '☁️',
  rain: '🌧️'
};

function getWeatherIcon(cloudCover, rain) {
  if (rain > 0.5) return weatherIcons.rain;
  if (cloudCover > 70) return weatherIcons.cloudy;
  if (cloudCover > 30) return weatherIcons.partlyCloudy;
  return weatherIcons.clear;
}

function degreesToDirection(deg) {
  const index = Math.round(deg / 22.5) % 16;
  return windDirections[index];
}

function formatDateForAPI(date) {
  return date.getFullYear() + "-" + (date.getMonth() + 1).toString().padStart(2, '0') + "-" + date.getDate().toString().padStart(2, '0');
}

function formatDateDisplay(date) {
  return date.getDate().toString().padStart(2, '0') + "-" + (date.getMonth() + 1).toString().padStart(2, '0') + "-" + date.getFullYear();
}

function getMoonPhase(date) {
  const lunarCycle = 29.53058867;
  const knownNewMoon = new Date(2024, 0, 11);
  const diffDays = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const phase = (diffDays % lunarCycle) / lunarCycle;
  
  if (phase < 0.0625) return "New Moon 🌑";
  if (phase < 0.1875) return "Waxing Crescent 🌒";
  if (phase < 0.3125) return "First Quarter 🌓";
  if (phase < 0.4375) return "Waxing Gibbous 🌔";
  if (phase < 0.5625) return "Full Moon 🌕";
  if (phase < 0.6875) return "Waning Gibbous 🌖";
  if (phase < 0.8125) return "Last Quarter 🌗";
  if (phase < 0.9375) return "Waning Crescent 🌘";
  return "New Moon 🌑";
}

function getSelectedTime() {
  return currentHour.toString().padStart(2, '0') + ":" + currentMinute.toString().padStart(2, '0');
}

function updateTimeLabel() {
  const timeLabel = document.getElementById('timeLabel');
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let i = 0; i < diveTypeRadios.length; i++) {
    if (diveTypeRadios[i].checked) {
      diveType = diveTypeRadios[i].value;
      break;
    }
  }
  const prefix = diveType === 'Boat' ? 'Lines Away Time' : 'Kitted Brief Time';
  if (timeLabel) {
    timeLabel.innerHTML = prefix + ': <span style="color: #2FFFEF; font-weight: bold;">' + getSelectedTime() + '</span>';
  }
}

function hapticFeedback() {
  const element = document.activeElement;
  if (element) {
    element.classList.add('haptic-feedback');
    setTimeout(() => element.classList.remove('haptic-feedback'), 100);
  }
}

function showLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

function saveUserPreferences() {
  const diveType = document.querySelector('input[name="diveType"]:checked')?.value || 'Boat';
  const preferences = {
    stationName: currentStation.name,
    diveType: diveType,
    selectedChips: Array.from(selectedChips),
    isShallowMode: isShallowMode
  };
  localStorage.setItem('divesense_preferences', JSON.stringify(preferences));
}

function loadUserPreferences() {
  const saved = localStorage.getItem('divesense_preferences');
  if (saved) {
    const prefs = JSON.parse(saved);
    const savedStation = stations.find(s => s.name === prefs.stationName);
    if (savedStation) currentStation = savedStation;
    if (prefs.diveType) {
      const radio = document.querySelector(`input[name="diveType"][value="${prefs.diveType}"]`);
      if (radio) radio.checked = true;
    }
    if (prefs.selectedChips) {
      prefs.selectedChips.forEach(chip => selectedChips.add(chip));
    }
    if (prefs.isShallowMode !== undefined) {
      isShallowMode = prefs.isShallowMode;
      if (isShallowMode) {
        document.body.classList.add('shallow-mode');
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) themeBtn.textContent = '🌊 Deep Mode';
      }
    }
  }
}

let savedPlans = [];

function loadSavedPlans() {
  const saved = localStorage.getItem('divesense_plans');
  if (saved) {
    savedPlans = JSON.parse(saved);
  }
  renderSavedPlans();
}

function getFormattedExportText() {
  const diveSite = document.getElementById('diveSite')?.value || '';
  const dod = document.getElementById('dod')?.value || '';
  const dodAsst = document.getElementById('dodAsst')?.value || '';
  const coxName = document.getElementById('coxName')?.value || '';
  const coxMode = document.querySelector('input[name="coxMode"]:checked')?.value || '';
  const participation = document.querySelector('input[name="participation"]:checked')?.value || 'Open to All';
  const maxDepth = document.getElementById('maxDepth')?.value || '';
  const torches = document.getElementById('torches')?.checked || false;
  const lifeJackets = document.getElementById('lifeJackets')?.checked || false;
  const diveTypeRadios = document.querySelectorAll('input[name="diveType"]');
  let diveType = "Boat";
  for (let i = 0; i < diveTypeRadios.length; i++) {
    if (diveTypeRadios[i].checked) {
      diveType = diveTypeRadios[i].value;
      break;
    }
  }
  const timePrefix = diveType === 'Boat' ? 'Lines Away Time' : 'Kitted Brief Time';
  
  const weather = getMockWeatherData(currentStation, currentDate);
  const hourWeather = weather.find(w => parseInt(w.time) === currentHour);
  const tides = getMockTideData(currentStation, currentDate);
  const { prev: prevTide, next: nextTide } = getClosestTides(tides.events, currentHour, currentMinute);
  
  const highWater = prevTide?.type === 'High' ? prevTide : (nextTide?.type === 'High' ? nextTide : null);
  const lowWater = prevTide?.type === 'Low' ? prevTide : (nextTide?.type === 'Low' ? nextTide : null);
  
  const categories = Array.from(selectedChips).join(', ');
  
  let weatherText = '';
  if (hourWeather) {
    weatherText = `${getWeatherIcon(hourWeather.cloudCover, hourWeather.rain)} Wind: ${hourWeather.windSpeed} Bft ${degreesToDirection(hourWeather.windDir)}, Gusts: ${hourWeather.gusts} Bft, Swell: ${hourWeather.swellHeight.toFixed(1)}m / ${hourWeather.swellPeriod}s, Visibility: ${hourWeather.visibility.toFixed(1)}km, Rain: ${hourWeather.rain.toFixed(1)}mm, Temp: ${hourWeather.airTemp.toFixed(1)}°C`;
  }
  
  let text = `Date: ${formatDateDisplay(currentDate)}\n`;
  text += `Station Name: ${currentStation.name}\n`;
  text += `Station Map Co-ordinates: ${currentStation.lat}, ${currentStation.lon}\n`;
  text += `Google Maps Link: https://www.google.com/maps?q=${currentStation.lat},${currentStation.lon}\n`;
  text += `Dive Site Name: ${diveSite || 'Not specified'}\n`;
  text += `Dive Type: ${diveType}\n`;
  text += `Time: ${getSelectedTime()} (${timePrefix})\n`;
  text += `High Water: ${highWater ? `${highWater.time} (${highWater.height.toFixed(2)}m)` : 'N/A'}\n`;
  text += `Low Water: ${lowWater ? `${lowWater.time} (${lowWater.height.toFixed(2)}m)` : 'N/A'}\n`;
  text += `Weather at Dive Time: ${weatherText}\n`;
  text += `DOD: ${dod || 'Not specified'}\n`;
  text += `Assistant DOD: ${dodAsst || 'None'}\n`;
  text += `Cox: ${coxName || 'N/A'} ${coxMode ? `(${coxMode} Cox'n)` : ''}\n`;
  text += `Participation: ${participation}\n`;
  text += `Max Depth: ${maxDepth || 'N/A'}m\n`;
  if (torches) text += `Torches Required: ✓\n`;
  if (lifeJackets) text += `Life Jackets Required: ✓\n`;
  text += `Dive Categories: ${categories || 'None selected'}\n`;
  text += `\n---\nRisk Level: ${currentRisk} (${currentRiskPercent}%)\n`;
  text += `Created with DiveSense - Always verify with official sources`;
  
  return text;
}

function saveCurrentPlan() {
  const diveSite = document.getElementById('diveSite')?.value || 'Unnamed Dive';
  const planName = prompt('Enter a name for this dive plan:', diveSite);
  if (!planName) return;
  
  const plan = {
    id: Date.now(),
    name: planName,
    exportText: getFormattedExportText(),
    station: currentStation.name,
    date: formatDateDisplay(currentDate),
    time: getSelectedTime(),
    diveType: document.querySelector('input[name="diveType"]:checked')?.value,
    maxDepth: document.getElementById('maxDepth')?.value,
    categories: Array.from(selectedChips),
    risk: currentRisk,
    riskPercent: currentRiskPercent
  };
  
  savedPlans.unshift(plan);
  if (savedPlans.length > 10) savedPlans.pop();
  localStorage.setItem('divesense_plans', JSON.stringify(savedPlans));
  renderSavedPlans();
  showNotification('Plan saved successfully!');
}

function deleteSavedPlan(planId) {
  savedPlans = savedPlans.filter(p => p.id !== planId);
  localStorage.setItem('divesense_plans', JSON.stringify(savedPlans));
  renderSavedPlans();
  showNotification('Plan deleted');
}

function loadSavedPlan(plan) {
  const savedStation = stations.find(s => s.name === plan.station);
  if (savedStation) currentStation = savedStation;
  currentDate = new Date(plan.date.split('-').reverse().join('-'));
  const [hour, minute] = plan.time.split(':');
  currentHour = parseInt(hour);
  currentMinute = parseInt(minute);
  
  const radio = document.querySelector(`input[name="diveType"][value="${plan.diveType}"]`);
  if (radio) radio.checked = true;
  
  if (document.getElementById('maxDepth')) {
    document.getElementById('maxDepth').value = plan.maxDepth;
  }
  
  selectedChips.clear();
  plan.categories.forEach(cat => selectedChips.add(cat));
  
  initStations();
  initTimeSpinners();
  buildCalendar();
  loadAllData();
  
  setTimeout(() => {
    renderChips();
    showNotification(`Loaded: ${plan.name}`);
  }, 100);
}

function renderSavedPlans() {
  const container = document.getElementById('savedPlansContainer');
  if (!container) return;
  
  if (savedPlans.length === 0) {
    container.innerHTML = '<div class="saved-plans-empty">No saved plans yet. Save a plan below.</div>';
    return;
  }
  
  let html = '';
  savedPlans.forEach(plan => {
    html += `
      <div class="saved-plan-item" data-plan-id="${plan.id}">
        <div>
          <div class="saved-plan-name">${escapeHtml(plan.name)}</div>
          <div class="saved-plan-details">${plan.station} | ${plan.date} | ${plan.time} | Risk: ${plan.risk}</div>
        </div>
        <button class="delete-plan-btn" data-plan-id="${plan.id}">🗑️</button>
      </div>
    `;
  });
  container.innerHTML = html;
  
  container.querySelectorAll('.saved-plan-item').forEach(item => {
    const planId = parseInt(item.dataset.planId);
    const plan = savedPlans.find(p => p.id === planId);
    if (plan) {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-plan-btn')) {
          loadSavedPlan(plan);
        }
      });
    }
  });
  
  container.querySelectorAll('.delete-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const planId = parseInt(btn.dataset.planId);
      deleteSavedPlan(planId);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(47, 255, 238, 0.9);
    color: #020B24;
    padding: 10px 20px;
    border-radius: 30px;
    font-size: 12px;
    font-weight: bold;
    z-index: 2000;
    animation: fadeOut 2s forwards;
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

function initThemeToggle() {
  const themeBtn = document.getElementById('themeToggleBtn');
  if (!themeBtn) return;
  
  themeBtn.addEventListener('click', () => {
    isShallowMode = !isShallowMode;
    if (isShallowMode) {
      document.body.classList.add('shallow-mode');
      themeBtn.textContent = '🌊 Deep Mode';
    } else {
      document.body.classList.remove('shallow-mode');
      themeBtn.textContent = '☀️ Shallow Mode';
    }
    saveUserPreferences();
  });
}

function isSlackWaterTime(tideEvents, hour, minute) {
  const totalMinutes = hour * 60 + minute;
  for (let i = 0; i < tideEvents.length; i++) {
    const tideParts = tideEvents[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    const diff = Math.abs(totalMinutes - tideMinutes);
    if (diff <= 40) return true;
  }
  return false;
}

function getClosestTides(tideEvents, targetHour, targetMinute) {
  if (!tideEvents || tideEvents.length === 0) return { prev: null, next: null };
  const targetMinutes = targetHour * 60 + targetMinute;
  let prevTide = null, nextTide = null;
  for (let i = 0; i < tideEvents.length; i++) {
    const tideParts = tideEvents[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    if (tideMinutes <= targetMinutes) prevTide = tideEvents[i];
    if (tideMinutes >= targetMinutes && !nextTide) nextTide = tideEvents[i];
  }
  return { prev: prevTide, next: nextTide };
}

function getTideDirectionForHour(tideEvents, hour) {
  if (!tideEvents || tideEvents.length < 2) return "Unknown";
  const targetMinutes = hour * 60;
  let prevTide = null, nextTide = null;
  for (let i = 0; i < tideEvents.length; i++) {
    const tideParts = tideEvents[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    if (tideMinutes <= targetMinutes) prevTide = tideEvents[i];
    if (tideMinutes >= targetMinutes && !nextTide) nextTide = tideEvents[i];
  }
  if (!prevTide || !nextTide) return "Unknown";
  const timeToPrev = Math.abs(targetMinutes - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
  const timeToNext = Math.abs(targetMinutes - (parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])));
  if (timeToPrev <= 40 || timeToNext <= 40) return "Slack Water ⚡";
  if (prevTide.type === "High" && nextTide.type === "Low") return "Ebbing 🌊⬇️";
  if (prevTide.type === "Low" && nextTide.type === "High") return "Flooding 🌊⬆️";
  return "Slack Water ⚡";
}

function getTideDirection(tideEvents, targetHour, targetMinute) {
  if (!tideEvents || tideEvents.length < 2) return "Unknown";
  const targetMinutes = targetHour * 60 + targetMinute;
  let prevTide = null, nextTide = null;
  for (let i = 0; i < tideEvents.length; i++) {
    const tideParts = tideEvents[i].time.split(':');
    const tideMinutes = parseInt(tideParts[0]) * 60 + parseInt(tideParts[1]);
    if (tideMinutes <= targetMinutes) prevTide = tideEvents[i];
    if (tideMinutes >= targetMinutes && !nextTide) nextTide = tideEvents[i];
  }
  if (!prevTide || !nextTide) return "Unknown";
  const timeToPrev = Math.abs(targetMinutes - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
  const timeToNext = Math.abs(targetMinutes - (parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])));
  if (timeToPrev <= 40 || timeToNext <= 40) return "Slack Water ⚡";
  if (prevTide.type === "High" && nextTide.type === "Low") return "Ebbing (Outgoing) 🌊⬇️";
  if (prevTide.type === "Low" && nextTide.type === "High") return "Flooding (Incoming) 🌊⬆️";
  return "Slack Water ⚡";
}

function getMockTideData(station, date) {
  const tideTypes = ["High", "Low", "High", "Low"];
  const times = ["02:30", "08:45", "15:00", "21:15"];
  const heights = [4.2, 1.1, 4.5, 0.9];
  const stationVariation = stations.findIndex(s => s.name === station.name) * 0.1;
  const events = tideTypes.map((type, i) => ({
    type: type, time: times[i], height: heights[i] + stationVariation,
    timestamp: new Date(date).setHours(parseInt(times[i].split(':')[0]), parseInt(times[i].split(':')[1]))
  }));
  const dayOfMonth = date.getDate();
  const isSpring = dayOfMonth < 7 || (dayOfMonth > 14 && dayOfMonth < 21);
  return { events, moonPhase: getMoonPhase(date), tideType: isSpring ? "Springs" : "Neaps" };
}

function getMockWeatherData(station, date) {
  const hourly = [];
  const baseWindSpeed = Math.floor(Math.random() * 10) + 8;
  const baseSwell = 0.8 + Math.random() * 1.2;
  const baseTemp = 12 + Math.random() * 6;
  for (let hour = 0; hour < 24; hour++) {
    const variation = Math.sin(hour * Math.PI / 12) * 0.3;
    hourly.push({
      time: hour.toString().padStart(2, '0') + ":00",
      windSpeed: Math.max(1, Math.floor(baseWindSpeed + variation * 5)),
      windSpeedKmh: (baseWindSpeed + variation * 5) * 3.6,
      windDir: (hour * 15) % 360,
      gusts: Math.max(2, Math.floor(baseWindSpeed + variation * 8 + 3)),
      swellHeight: Math.max(0.3, baseSwell + variation * 0.5),
      swellPeriod: Math.floor(6 + Math.random() * 5),
      swellDir: (hour * 20) % 360,
      visibility: 8 + Math.random() * 7,
      rain: Math.random() > 0.7 ? Math.random() * 2 : 0,
      cloudCover: Math.floor(30 + Math.random() * 60),
      airTemp: baseTemp + variation * 3,
      uvIndex: hour > 8 && hour < 17 ? Math.floor(2 + Math.random() * 6) : 0
    });
  }
  return hourly;
}

function buildCalendar() {
  const container = document.getElementById('calendarContainer');
  if (!container) return;
  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let selectedDate = new Date(currentDate); selectedDate.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + 10);
  const minDate = today;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  let html = `<div class="calendar-header"><div class="calendar-month-year">${monthNames[month]} ${year}</div><div class="calendar-nav"><button class="calendar-nav-btn" data-prev-month>&lt;</button><button class="calendar-nav-btn" data-next-month>&gt;</button></div></div><div class="calendar-weekdays"><div class="calendar-weekday">Su</div><div class="calendar-weekday">Mo</div><div class="calendar-weekday">Tu</div><div class="calendar-weekday">We</div><div class="calendar-weekday">Th</div><div class="calendar-weekday">Fr</div><div class="calendar-weekday">Sa</div></div><div class="calendar-days">`;
  for (let i = 0; i < startDay; i++) html += '<div class="calendar-day other-month"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDateObj = new Date(year, month, day); currentDateObj.setHours(0, 0, 0, 0);
    const isSelected = currentDateObj.getTime() === selectedDate.getTime();
    const isToday = currentDateObj.getTime() === today.getTime();
    const isDisabled = currentDateObj < minDate || currentDateObj > maxDate;
    let classes = 'calendar-day';
    if (isSelected) classes += ' selected';
    if (isToday) classes += ' today';
    if (isDisabled) classes += ' disabled';
    html += `<div class="${classes}" data-date="${currentDateObj.toISOString()}">${day}</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
  document.querySelectorAll('.calendar-day:not(.disabled):not(.other-month)').forEach(day => {
    day.addEventListener('click', () => {
      hapticFeedback();
      const date = new Date(day.dataset.date);
      currentDate = date;
      buildCalendar();
      loadAllData();
    });
  });
  document.querySelectorAll('.calendar-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.prevMonth !== undefined) currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
      else if (btn.dataset.nextMonth !== undefined) currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
      buildCalendar();
    });
  });
}

function initStations() {
  const container = document.getElementById('stationScroll');
  if (!container) return;
  let html = '';
  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    const activeClass = (station.name === currentStation.name) ? 'active' : '';
    html += '<div class="station-card ' + activeClass + '" data-idx="' + i + '">' + station.name + '<br><small>' + station.county + '</small></div>';
  }
  container.innerHTML = html;
  document.querySelectorAll('.station-card').forEach(card => {
    card.addEventListener('click', () => {
      hapticFeedback();
      const idx = parseInt(card.dataset.idx);
      currentStation = stations[idx];
      initStations();
      loadAllData();
    });
  });
}

function initTimeSpinners() {
  const hourWheel = document.getElementById('hourWheel');
  const minuteWheel = document.getElementById('minuteWheel');
  if (!hourWheel || !minuteWheel) return;
  hourWheel.innerHTML = ''; minuteWheel.innerHTML = '';
  
  // Create hours 0-23 with extra padding for smooth scrolling
  for (let h = 0; h < 24; h++) {
    const option = document.createElement('div');
    option.className = 'spinner-option';
    option.textContent = h.toString().padStart(2, '0');
    option.dataset.value = h;
    hourWheel.appendChild(option);
  }
  
  // Create minutes 0-59 with extra padding for smooth scrolling
  for (let m = 0; m < 60; m++) {
    const option = document.createElement('div');
    option.className = 'spinner-option';
    option.textContent = m.toString().padStart(2, '0');
    option.dataset.value = m;
    minuteWheel.appendChild(option);
  }
  
  function updateHighlights() {
    document.querySelectorAll('#hourWheel .spinner-option').forEach(opt => {
      if (parseInt(opt.dataset.value) === currentHour) opt.classList.add('selected');
      else opt.classList.remove('selected');
    });
    document.querySelectorAll('#minuteWheel .spinner-option').forEach(opt => {
      if (parseInt(opt.dataset.value) === currentMinute) opt.classList.add('selected');
      else opt.classList.remove('selected');
    });
    updateTimeLabel();
  }
  
  function scrollToValue(wheel, value) {
    const option = Array.from(wheel.children).find(opt => parseInt(opt.dataset.value) === value);
    if (option) {
      option.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  
  let scrollTimeout;
  
  hourWheel.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const center = hourWheel.scrollTop + hourWheel.clientHeight / 2;
      let closest = null;
      let minDist = Infinity;
      Array.from(hourWheel.children).forEach(opt => {
        const rect = opt.getBoundingClientRect();
        const wheelRect = hourWheel.getBoundingClientRect();
        const optCenter = rect.top + rect.height / 2;
        const wheelCenter = wheelRect.top + wheelRect.height / 2;
        const dist = Math.abs(optCenter - wheelCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = opt;
        }
      });
      if (closest) {
        const newHour = parseInt(closest.dataset.value);
        if (newHour !== currentHour) {
          currentHour = newHour;
          updateHighlights();
          updateDetailed();
          updateHourly();
        }
      }
    }, 30);
  });
  
  minuteWheel.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const center = minuteWheel.scrollTop + minuteWheel.clientHeight / 2;
      let closest = null;
      let minDist = Infinity;
      Array.from(minuteWheel.children).forEach(opt => {
        const rect = opt.getBoundingClientRect();
        const wheelRect = minuteWheel.getBoundingClientRect();
        const optCenter = rect.top + rect.height / 2;
        const wheelCenter = wheelRect.top + wheelRect.height / 2;
        const dist = Math.abs(optCenter - wheelCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = opt;
        }
      });
      if (closest) {
        const newMinute = parseInt(closest.dataset.value);
        if (newMinute !== currentMinute) {
          currentMinute = newMinute;
          updateHighlights();
          updateDetailed();
          updateHourly();
        }
      }
    }, 30);
  });
  
  updateHighlights();
  setTimeout(() => {
    scrollToValue(hourWheel, currentHour);
    scrollToValue(minuteWheel, currentMinute);
  }, 100);
}

function initDiveType() {
  const radios = document.querySelectorAll('input[name="diveType"]');
  const coxField = document.getElementById('coxField');
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (coxField) coxField.style.display = e.target.value === 'Boat' ? 'block' : 'none';
      document.getElementById('lifeJackets').checked = e.target.value === 'Boat';
      updateTimeLabel();
      saveUserPreferences();
    });
  });
  if (coxField) coxField.style.display = 'block';
  updateTimeLabel();
}

function renderChips() {
  document.querySelectorAll('.chips span').forEach(chip => {
    if (selectedChips.has(chip.dataset.chip)) chip.classList.add('active-chip');
    else chip.classList.remove('active-chip');
  });
}

function updateTides() {
  const tides = getMockTideData(currentStation, currentDate);
  const tideTypeClass = tides.tideType === 'Springs' ? 'springs-text' : 'neaps-text';
  const tideTypeIcon = tides.tideType === 'Springs' ? '🌕' : '🌙';
  let html = `<div class="${tideTypeClass}" style="font-size:1.2rem; margin-bottom:10px;">${tideTypeIcon} ${tides.tideType.toUpperCase()} TIDES</div>`;
  tides.events.forEach(e => {
    const tideIcon = e.type === 'High' ? '🌊 HIGH' : '⬇️ LOW';
    html += `<div class="tide-event"><span>${tideIcon}</span><span>${e.time}</span><span>${e.height.toFixed(2)}m</span></div>`;
  });
  html += `<div class="text-small mt-2">🌙 ${tides.moonPhase}</div>`;
  const tideDiv = document.getElementById('tideData');
  if (tideDiv) tideDiv.innerHTML = html;
}

function updateHourly() {
  const weather = getMockWeatherData(currentStation, currentDate);
  const tides = getMockTideData(currentStation, currentDate);
  const selectedHour = currentHour;
  const container = document.getElementById('hourlyScroll');
  if (!container) return;
  let html = '';
  weather.forEach(hour => {
    const hourNum = parseInt(hour.time);
    const tideDirection = getTideDirectionForHour(tides.events, hourNum);
    let tideIcon = tideDirection.includes('Flooding') ? '⬆️' : (tideDirection.includes('Ebbing') ? '⬇️' : '⚡');
    const weatherIcon = getWeatherIcon(hour.cloudCover, hour.rain);
    const highlightClass = hourNum === selectedHour ? 'highlight' : '';
    html += `<div class="hourly-card ${highlightClass}">
      <strong>${hour.time}</strong>
      <div>${weatherIcon} ${hour.windSpeed} Bft</div>
      <div>${degreesToDirection(hour.windDir)}</div>
      <div>🌊 ${hour.swellHeight.toFixed(1)}m / ${hour.swellPeriod}s</div>
      <div style="font-size: 10px; margin-top: 4px;">${tideIcon} ${tideDirection}</div>
    </div>`;
  });
  container.innerHTML = html;
  // Just highlight without scrolling
}

function updateDetailed() {
  const weather = getMockWeatherData(currentStation, currentDate);
  const tides = getMockTideData(currentStation, currentDate);
  const selectedHour = currentHour, selectedMinute = currentMinute;
  let hourData = weather.find(w => parseInt(w.time) === selectedHour) || weather[12];
  const { prev: prevTide, next: nextTide } = getClosestTides(tides.events, selectedHour, selectedMinute);
  const isSlackWater = isSlackWaterTime(tides.events, selectedHour, selectedMinute);
  const tideDirection = getTideDirection(tides.events, selectedHour, selectedMinute);
  let riskScore = (hourData.windSpeed / 12) * 0.4 + (hourData.swellHeight / 4) * 0.4 + (1 - (hourData.visibility / 20)) * 0.2;
  riskScore = Math.min(1, Math.max(0, riskScore));
  let riskLevel = "Low", riskPercent = 12.5;
  if (riskScore > 0.75) { riskLevel = "High"; riskPercent = 87.5; currentRiskPercent = Math.round(riskScore * 100); }
  else if (riskScore > 0.5) { riskLevel = "Caution"; riskPercent = 62.5; currentRiskPercent = Math.round(riskScore * 100); }
  else if (riskScore > 0.25) { riskLevel = "Moderate"; riskPercent = 37.5; currentRiskPercent = Math.round(riskScore * 100); }
  else { currentRiskPercent = Math.round(riskScore * 100); }
  currentRisk = riskLevel;
  const riskBar = document.getElementById('riskBarGradient');
  if (riskBar) {
    riskBar.style.background = `linear-gradient(90deg, #1f8a4c 0%, #1f8a4c ${Math.max(0, riskPercent - 15)}%, #e0b01a ${Math.max(0, riskPercent - 5)}%, #e67e22 ${Math.min(100, riskPercent + 5)}%, #c0392b ${Math.min(100, riskPercent + 20)}%)`;
  }
  const riskPointer = document.getElementById('riskPointer');
  if (riskPointer) riskPointer.style.marginLeft = riskPercent + '%';
  let riskColor = '#88ff88';
  if (riskLevel === 'High') riskColor = '#ff8888';
  else if (riskLevel === 'Caution') riskColor = '#ffaa66';
  else if (riskLevel === 'Moderate') riskColor = '#ffff88';
  const weatherIcon = getWeatherIcon(hourData.cloudCover, hourData.rain);
  let html = `
    <div class="detail-row"><strong>Wind:</strong> ${weatherIcon} ${hourData.windSpeed} Bft ${degreesToDirection(hourData.windDir)} (Gusts ${hourData.gusts} Bft)</div>
    <div class="detail-row"><strong>Visibility:</strong> ${hourData.visibility.toFixed(1)} km</div>
    <div class="detail-row"><strong>Rain:</strong> ${hourData.rain.toFixed(1)} mm</div>
    <div class="detail-row"><strong>Cloud Cover:</strong> ${hourData.cloudCover}%</div>
    <div class="detail-row"><strong>Air Temp:</strong> ${hourData.airTemp.toFixed(1)}°C</div>
    <div class="detail-row"><strong>UV Index:</strong> ${hourData.uvIndex}</div>
    <div class="detail-row"><strong>Swell:</strong> ${hourData.swellHeight.toFixed(1)}m / ${hourData.swellPeriod}s from ${degreesToDirection(hourData.swellDir)}</div>`;
  if (isSlackWater) {
    html += `<div class="detail-row" style="background: rgba(47, 255, 238, 0.15); border-radius: 8px; margin-top: 5px; padding: 8px;"><strong>⚡ Slack Water Alert:</strong> Current time is within 40 minutes of a tide change</div>`;
  }
  html += `<div class="detail-row"><strong>Risk Assessment:</strong> <span style="color: ${riskColor}; font-weight: bold;">${riskLevel} (${currentRiskPercent}%)</span></div>`;
  if (prevTide || nextTide) {
    html += `<div class="detail-row" style="margin-top:12px;"><strong>📊 Relevant tides for this dive:</strong></div>`;
    if (prevTide) {
      const timeDiff = Math.abs((selectedHour * 60 + selectedMinute) - (parseInt(prevTide.time.split(':')[0]) * 60 + parseInt(prevTide.time.split(':')[1])));
      html += `<div class="detail-row">← Previous ${prevTide.type} at ${prevTide.time} (${prevTide.height.toFixed(2)}m) - ${Math.floor(timeDiff / 60)}h ${timeDiff % 60}m before</div>`;
    }
    if (nextTide) {
      const timeDiff = Math.abs((parseInt(nextTide.time.split(':')[0]) * 60 + parseInt(nextTide.time.split(':')[1])) - (selectedHour * 60 + selectedMinute));
      html += `<div class="detail-row">→ Next ${nextTide.type} at ${nextTide.time} (${nextTide.height.toFixed(2)}m) - ${Math.floor(timeDiff / 60)}h ${timeDiff % 60}m after</div>`;
    }
    html += `<div class="detail-row"><strong>🌊 Tide Direction:</strong> ${tideDirection}</div>`;
    html += `<div class="detail-row">${tides.tideType === 'Springs' ? '🌕 Spring tides expected (larger ranges)' : '🌙 Neap tides expected (smaller ranges)'}</div>`;
    html += `<div class="detail-row">🌙 ${tides.moonPhase}</div>`;
  }
  const panel = document.getElementById('detailedPanel');
  if (panel) panel.innerHTML = html;
}

function initChips() {
  const categories = ["Reef", "Wreck", "Drift", "Deep", "Night", "Snorkel", "Kelp", "Photography", "Navigation", "Training", "Citizen Science", "Fitness Test"];
  const container = document.getElementById('chipsContainer');
  if (!container) return;
  let html = '';
  categories.forEach(cat => { html += `<span data-chip="${cat}">${cat}</span>`; });
  container.innerHTML = html;
  document.querySelectorAll('.chips span').forEach(chip => {
    chip.addEventListener('click', () => {
      hapticFeedback();
      chip.classList.toggle('active-chip');
      const chipName = chip.dataset.chip;
      if (chip.classList.contains('active-chip')) selectedChips.add(chipName);
      else selectedChips.delete(chipName);
      saveUserPreferences();
    });
  });
  renderChips();
}

const maxDepthInput = document.getElementById('maxDepth');
if (maxDepthInput) {
  maxDepthInput.addEventListener('change', (e) => {
    const depth = parseInt(e.target.value);
    if (depth >= 21) {
      const deepChip = Array.from(document.querySelectorAll('.chips span')).find(c => c.dataset.chip === 'Deep');
      if (deepChip && !deepChip.classList.contains('active-chip')) {
        deepChip.classList.add('active-chip');
        selectedChips.add('Deep');
        renderChips();
      }
    }
    e.target.style.borderColor = (depth < 5 || depth > 45) ? '#ff4444' : '#1AA7A7';
  });
}

document.getElementById('whatsappBtn')?.addEventListener('click', () => {
  const text = getFormattedExportText();
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

document.getElementById('emailBtn')?.addEventListener('click', () => {
  const text = getFormattedExportText();
  const subject = `Dive Plan - ${document.getElementById('diveSite')?.value || 'Dive Plan'} - ${formatDateDisplay(currentDate)}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
});

document.getElementById('copyBtn')?.addEventListener('click', async () => {
  const text = getFormattedExportText();
  await navigator.clipboard.writeText(text);
  showNotification('Plan copied to clipboard!');
});

document.getElementById('savePlanBtn')?.addEventListener('click', () => {
  saveCurrentPlan();
});

function loadAllData() {
  showLoading();
  setTimeout(() => {
    updateTides();
    updateHourly();
    updateDetailed();
    hideLoading();
    saveUserPreferences();
  }, 300);
}

function init() {
  loadUserPreferences();
  loadSavedPlans();
  initStations();
  initTimeSpinners();
  initDiveType();
  initChips();
  initThemeToggle();
  buildCalendar();
  loadAllData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}