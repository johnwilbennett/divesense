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
let currentHour = new Date().getHours();
let currentMinute = new Date().getMinutes();
let isProgrammaticScroll = false;
let currentCalendarMonth = new Date();

const windDirections = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

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

// MOCK DATA
function getMockTideData(station, date) {
    const tideTypes = ["High", "Low", "High", "Low"];
    const times = ["02:30", "08:45", "15:00", "21:15"];
    const heights = [4.2, 1.1, 4.5, 0.9];
    
    const stationVariation = stations.findIndex(s => s.name === station.name) * 0.1;
    
    const events = tideTypes.map((type, i) => ({
        type: type,
        time: times[i],
        height: heights[i] + stationVariation,
        timestamp: new Date(date).setHours(parseInt(times[i].split(':')[0]), parseInt(times[i].split(':')[1]))
    }));
    
    const dayOfMonth = date.getDate();
    const isSpring = dayOfMonth < 7 || (dayOfMonth > 14 && dayOfMonth < 21);
    
    return {
        events: events,
        moonPhase: getMoonPhase(date),
        tideType: isSpring ? "Springs" : "Neaps"
    };
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

// CALENDAR
function buildCalendar() {
    const container = document.getElementById('calendarContainer');
    if (!container) return;
    
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let selectedDate = new Date(currentDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 10);
    const minDate = today;
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    let html = `
        <div class="calendar-header">
            <div class="calendar-month-year">${monthNames[month]} ${year}</div>
            <div class="calendar-nav">
                <button class="calendar-nav-btn" data-prev-month>&lt;</button>
                <button class="calendar-nav-btn" data-next-month>&gt;</button>
            </div>
        </div>
        <div class="calendar-weekdays">
            <div class="calendar-weekday">Su</div><div class="calendar-weekday">Mo</div>
            <div class="calendar-weekday">Tu</div><div class="calendar-weekday">We</div>
            <div class="calendar-weekday">Th</div><div class="calendar-weekday">Fr</div>
            <div class="calendar-weekday">Sa</div>
        </div>
        <div class="calendar-days">
    `;
    
    for (let i = 0; i < startDay; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDateObj = new Date(year, month, day);
        currentDateObj.setHours(0, 0, 0, 0);
        
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
            const date = new Date(day.dataset.date);
            currentDate = date;
            buildCalendar();
            loadAllData();
        });
    });
    
    document.querySelectorAll('.calendar-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.dataset.prevMonth !== undefined) {
                currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
            } else if (btn.dataset.nextMonth !== undefined) {
                currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
            }
            buildCalendar();
        });
    });
}

// STATIONS
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
            const idx = parseInt(card.dataset.idx);
            currentStation = stations[idx];
            initStations();
            loadAllData();
        });
    });
}

// TIME SPINNERS
function initTimeSpinners() {
    const hourWheel = document.getElementById('hourWheel');
    const minuteWheel = document.getElementById('minuteWheel');
    if (!hourWheel || !minuteWheel) return;
    
    let hourHtml = '';
    for (let h = 0; h < 24; h++) {
        hourHtml += `<div class="spinner-option" data-value="${h}">${h.toString().padStart(2, '0')}</div>`;
    }
    hourWheel.innerHTML = hourHtml;
    
    let minuteHtml = '';
    for (let m = 0; m < 60; m++) {
        minuteHtml += `<div class="spinner-option" data-value="${m}">${m.toString().padStart(2, '0')}</div>`;
    }
    minuteWheel.innerHTML = minuteHtml;
    
    function updateHighlights() {
        document.querySelectorAll('#hourWheel .spinner-option').forEach(opt => {
            if (parseInt(opt.dataset.value) === currentHour) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
        document.querySelectorAll('#minuteWheel .spinner-option').forEach(opt => {
            if (parseInt(opt.dataset.value) === currentMinute) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
        updateTimeLabel();
    }
    
    function scrollToValue(wheel, value) {
        isProgrammaticScroll = true;
        const option = Array.from(wheel.querySelectorAll('.spinner-option')).find(opt => parseInt(opt.dataset.value) === value);
        if (option) option.scrollIntoView({ block: 'center', behavior: 'auto' });
        setTimeout(() => { isProgrammaticScroll = false; }, 100);
    }
    
    hourWheel.addEventListener('scroll', () => {
        if (isProgrammaticScroll) return;
        const center = hourWheel.scrollTop + hourWheel.clientHeight / 2;
        let closest = null, minDist = Infinity;
        hourWheel.querySelectorAll('.spinner-option').forEach(opt => {
            const dist = Math.abs(opt.offsetTop + opt.offsetHeight / 2 - center);
            if (dist < minDist) {
                minDist = dist;
                closest = opt;
            }
        });
        if (closest) {
            currentHour = parseInt(closest.dataset.value);
            updateHighlights();
            updateDetailed();
            updateHourly();
        }
    });
    
    minuteWheel.addEventListener('scroll', () => {
        if (isProgrammaticScroll) return;
        const center = minuteWheel.scrollTop + minuteWheel.clientHeight / 2;
        let closest = null, minDist = Infinity;
        minuteWheel.querySelectorAll('.spinner-option').forEach(opt => {
            const dist = Math.abs(opt.offsetTop + opt.offsetHeight / 2 - center);
            if (dist < minDist) {
                minDist = dist;
                closest = opt;
            }
        });
        if (closest) {
            currentMinute = parseInt(closest.dataset.value);
            updateHighlights();
            updateDetailed();
            updateHourly();
        }
    });
    
    updateHighlights();
    setTimeout(() => {
        scrollToValue(hourWheel, currentHour);
        scrollToValue(minuteWheel, currentMinute);
    }, 100);
}

// DIVE TYPE
function initDiveType() {
    const radios = document.querySelectorAll('input[name="diveType"]');
    const coxField = document.getElementById('coxField');
    
    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (coxField) coxField.style.display = e.target.value === 'Boat' ? 'block' : 'none';
            document.getElementById('lifeJackets').checked = e.target.value === 'Boat';
            updateTimeLabel();
        });
    });
    
    if (coxField) coxField.style.display = 'block';
    updateTimeLabel();
}

// UPDATE FUNCTIONS
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
        let closestTide = tides.events[0];
        let minDiff = Math.abs(parseInt(closestTide.time) - hourNum);
        tides.events.forEach(tide => {
            const diff = Math.abs(parseInt(tide.time) - hourNum);
            if (diff < minDiff) {
                minDiff = diff;
                closestTide = tide;
            }
        });
        
        const isSlack = Math.abs(hourNum - parseInt(closestTide.time)) <= 40;
        const highlightClass = hourNum === selectedHour ? 'highlight' : '';
        
        html += `<div class="hourly-card ${highlightClass}">
            <strong>${hour.time}</strong>
            <div>💨 ${hour.windSpeed} Bft</div>
            <div>${degreesToDirection(hour.windDir)}</div>
            <div>🌊 ${hour.swellHeight.toFixed(1)}m</div>
            ${isSlack ? '<div style="color:#44ff44; font-size:10px;">⚡ Slack Water</div>' : ''}
        </div>`;
    });
    container.innerHTML = html;
}

function updateDetailed() {
    const weather = getMockWeatherData(currentStation, currentDate);
    const tides = getMockTideData(currentStation, currentDate);
    const selectedHour = currentHour;
    
    let hourData = weather.find(w => parseInt(w.time) === selectedHour) || weather[12];
    
    let prevTide = null, nextTide = null;
    tides.events.forEach(tide => {
        const tideHour = parseInt(tide.time);
        if (tideHour <= selectedHour) prevTide = tide;
        if (tideHour >= selectedHour && !nextTide) nextTide = tide;
    });
    
    let riskScore = (hourData.windSpeed / 12) * 0.4 + (hourData.swellHeight / 4) * 0.4 + (1 - (hourData.visibility / 20)) * 0.2;
    riskScore = Math.min(1, Math.max(0, riskScore));
    
    let riskLevel = "Low", riskPercent = 12.5;
    if (riskScore > 0.75) { riskLevel = "High"; riskPercent = 87.5; }
    else if (riskScore > 0.5) { riskLevel = "Caution"; riskPercent = 62.5; }
    else if (riskScore > 0.25) { riskLevel = "Moderate"; riskPercent = 37.5; }
    
    currentRisk = riskLevel;
    const riskPointer = document.getElementById('riskPointer');
    if (riskPointer) riskPointer.style.marginLeft = riskPercent + '%';
    
    let html = `
        <div class="detail-row"><strong>Wind:</strong> ${hourData.windSpeed} Bft ${degreesToDirection(hourData.windDir)} (Gusts ${hourData.gusts} Bft)</div>
        <div class="detail-row"><strong>Visibility:</strong> ${hourData.visibility.toFixed(1)} km</div>
        <div class="detail-row"><strong>Rain:</strong> ${hourData.rain.toFixed(1)} mm</div>
        <div class="detail-row"><strong>Cloud Cover:</strong> ${hourData.cloudCover}%</div>
        <div class="detail-row"><strong>Air Temp:</strong> ${hourData.airTemp.toFixed(1)}°C</div>
        <div class="detail-row"><strong>UV Index:</strong> ${hourData.uvIndex}</div>
        <div class="detail-row"><strong>Swell:</strong> ${hourData.swellHeight.toFixed(1)}m from ${degreesToDirection(hourData.swellDir)}</div>
        <div class="detail-row"><strong>Risk Assessment:</strong> <span style="color: ${riskLevel === 'High' ? '#ff8888' : riskLevel === 'Caution' ? '#ffaa66' : riskLevel === 'Moderate' ? '#ffff88' : '#88ff88'}">${riskLevel}</span></div>
    `;
    
    if (prevTide || nextTide) {
        html += `<div class="detail-row" style="margin-top:10px;"><strong>Tides near ${getSelectedTime()}:</strong></div>`;
        if (prevTide) html += `<div class="detail-row">← ${prevTide.type} at ${prevTide.time} (${prevTide.height.toFixed(2)}m)</div>`;
        if (nextTide) html += `<div class="detail-row">→ ${nextTide.type} at ${nextTide.time} (${nextTide.height.toFixed(2)}m)</div>`;
        html += `<div class="detail-row">${tides.tideType === 'Springs' ? '🌕 Spring tides expected' : '🌙 Neap tides expected'}</div>`;
        html += `<div class="detail-row">${tides.moonPhase}</div>`;
    }
    
    const panel = document.getElementById('detailedPanel');
    if (panel) panel.innerHTML = html;
}

// CHIPS
function initChips() {
    const categories = ["Reef", "Wreck", "Drift", "Deep", "Night", "Snorkel", "Kelp", "Photography", "Navigation", "Training", "Citizen Science", "Fitness Test"];
    const container = document.getElementById('chipsContainer');
    if (!container) return;
    
    let html = '';
    categories.forEach(cat => {
        html += `<span data-chip="${cat}">${cat}</span>`;
    });
    container.innerHTML = html;
    
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

// DEPTH VALIDATION
const maxDepthInput = document.getElementById('maxDepth');
if (maxDepthInput) {
    maxDepthInput.addEventListener('change', (e) => {
        const depth = parseInt(e.target.value);
        if (depth >= 21) {
            const deepChip = Array.from(document.querySelectorAll('.chips span')).find(c => c.dataset.chip === 'Deep');
            if (deepChip && !deepChip.classList.contains('active-chip')) {
                deepChip.classList.add('active-chip');
                selectedChips.add('Deep');
            }
        }
        e.target.style.borderColor = (depth < 5 || depth > 45) ? '#ff4444' : '#1AA7A7';
    });
}

// EXPORT
function getExportData() {
    const diveSite = document.getElementById('diveSite');
    const dod = document.getElementById('dod');
    const diveType = document.querySelector('input[name="diveType"]:checked')?.value || 'Boat';
    const categories = Array.from(selectedChips).join(', ');
    const maxDepth = document.getElementById('maxDepth');
    const coxName = document.getElementById('coxName');
    const coxMode = document.querySelector('input[name="coxMode"]:checked')?.value || 'N/A';
    const participation = document.querySelector('input[name="participation"]:checked')?.value || 'Open to All';
    const torches = document.getElementById('torches');
    const lifeJackets = document.getElementById('lifeJackets');
    
    return {
        diveSite: diveSite?.value || '',
        dod: dod?.value || '',
        diveType: diveType,
        selectedTime: getSelectedTime(),
        categories: categories,
        maxDepth: maxDepth?.value || '',
        coxName: coxName?.value || 'N/A',
        coxMode: coxMode,
        participation: participation,
        torches: torches?.checked ? '✓ Torches Required' : '',
        lifeJackets: lifeJackets?.checked ? '✓ Life Jackets Required' : ''
    };
}

// EXPORT BUTTONS
document.getElementById('whatsappBtn')?.addEventListener('click', () => {
    const data = getExportData();
    const weather = getMockWeatherData(currentStation, currentDate);
    const hourWeather = weather.find(w => parseInt(w.time) === currentHour);
    
    let text = `🌊 DiveSense Dive Plan 🌊\n\n📍 Station: ${currentStation.name}\n🏊 Dive Site: ${data.diveSite}\n⏰ Time: ${data.selectedTime} (${data.diveType === 'Boat' ? 'Lines Away' : 'Kitted Brief'})\n\n🌡️ Conditions:\n• Wind: ${hourWeather?.windSpeed || '?'} Bft ${hourWeather ? degreesToDirection(hourWeather.windDir) : '?'}\n• Swell: ${hourWeather?.swellHeight?.toFixed(1) || '?'}m\n• Visibility: ${hourWeather?.visibility?.toFixed(1) || '?'}km\n• Air Temp: ${hourWeather?.airTemp?.toFixed(1) || '?'}°C\n\n📋 Plan:\n• DOD: ${data.dod}\n• Max Depth: ${data.maxDepth}m\n• Categories: ${data.categories}\n\n⚠️ Risk: ${currentRisk}\n\n_Always verify with official sources_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

document.getElementById('emailBtn')?.addEventListener('click', () => {
    const data = getExportData();
    const weather = getMockWeatherData(currentStation, currentDate);
    const hourWeather = weather.find(w => parseInt(w.time) === currentHour);
    
    const subject = `Dive Plan - ${data.diveSite} - ${formatDateDisplay(currentDate)}`;
    let body = `DiveSense Dive Plan\n==================\nStation: ${currentStation.name}\nDate: ${formatDateDisplay(currentDate)}\nDive Site: ${data.diveSite}\nDive Type: ${data.diveType}\nTime: ${data.selectedTime}\n\nConditions:\n- Wind: ${hourWeather?.windSpeed || '?'} Bft ${hourWeather ? degreesToDirection(hourWeather.windDir) : '?'}\n- Swell: ${hourWeather?.swellHeight?.toFixed(1) || '?'}m\n- Visibility: ${hourWeather?.visibility?.toFixed(1) || '?'}km\n- Air Temp: ${hourWeather?.airTemp?.toFixed(1) || '?'}°C\n\nPlan Details:\n- DOD: ${data.dod}\n- Max Depth: ${data.maxDepth}m\n- Categories: ${data.categories}\n- Risk Level: ${currentRisk}\n\n---\nCreated with DiveSense`;
    
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

// LOAD ALL DATA
function loadAllData() {
    updateTides();
    updateHourly();
    updateDetailed();
}

// INITIALIZE
function init() {
    initStations();
    initTimeSpinners();
    initDiveType();
    initChips();
    buildCalendar();
    loadAllData();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}