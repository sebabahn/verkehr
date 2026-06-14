// main.js – Komplette überarbeitete Version mit aggressivem No-Cache für proxy.php
// Version: 2026-04-04 – optimiert für Workbox + striktes No-Cache-Verhalten

"use strict";

import {
  WAZE_URL,
  bigPolygonWKT,
  rawCategories
} from './data.js';

import {
  renderUI,
  assignToCategory,
  getJamMapColor,
  buildAlertContent,
  buildJamContent,
  buildIrregularityContent,
  shouldTriggerNotification
} from './ui.js';

import { parseWKT } from './geometry.js';

import { alertTypesTrans } from './data.js';

let appState = {
  map: null,
  alertClusterGroup: null,
  jamLayerGroup: null,
  irregularityLayerGroup: null,
  categories: [],
  bigPolygonCoords: [],
  countdownInterval: null,
  countdown: 30,
  isLoading: false,
  userHasInteracted: false,
  notifiedIds: new Set(),
  isAlarmPlaying: false,
  notificationPermission: 'default',
  isMapExpanded: false
};

// Web Audio Context für 3x Piep
let audioContext;

function playAttentionBeep(repeat = 3) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  let count = 0;

  function playSingleBeep() {
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

      gain.gain.value = 0.35;
      gain.gain.setValueAtTime(0.35, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.35);

      count++;
      if (count < repeat) {
        setTimeout(playSingleBeep, 450);
      } else {
        setTimeout(() => appState.isAlarmPlaying = false, 800);
      }
    } catch (e) {
      console.warn("Web Audio Piep konnte nicht abgespielt werden:", e);
      appState.isAlarmPlaying = false;
    }
  }

  playSingleBeep();
}

// Visueller Alarm (roter Blitz + Popup-Puls)
function triggerVisualAlarm() {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const flash = document.createElement('div');
      flash.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(231, 76, 60, 0.65); z-index: 99999; pointer-events: none;
        animation: alarmFlash 280ms ease-in-out forwards;
      `;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 400);
    }, i * 420);
  }

  setTimeout(() => {
    const popup = document.getElementById('important-popup');
    if (popup) popup.style.animation = 'alarmPopupPulse 1.2s ease-in-out 3';
  }, 200);
}

// CSS-Animationen einmalig laden
function injectAlarmStyles() {
  if (document.getElementById('alarm-styles')) return;
  const style = document.createElement('style');
  style.id = 'alarm-styles';
  style.textContent = `
    @keyframes alarmFlash { 0% { opacity: 0.75; } 100% { opacity: 0; } }
    @keyframes alarmPopupPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(231,76,60,0.9); } 50% { box-shadow: 0 0 0 25px rgba(231,76,60,0); } }
  `;
  document.head.appendChild(style);
}

// Notification Permission
async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === 'granted') {
    appState.notificationPermission = 'granted';
    return;
  }
  if (!appState.userHasInteracted) return;

  try {
    const permission = await Notification.requestPermission();
    appState.notificationPermission = permission;
  } catch (err) {
    console.error("Notification-Permission Fehler:", err);
  }
}

// Wichtiges Popup
function showImportantPopup(item, itemType, categoryName) {
  const oldPopup = document.getElementById('important-popup');
  if (oldPopup) oldPopup.remove();

  const popup = document.createElement('div');
  popup.id = 'important-popup';
  popup.className = 'important-popup';

  const title = getNotificationTitle(item, itemType);
  const body = getNotificationBody(item, itemType);
  const icon = getNotificationIcon(item, itemType);

  popup.innerHTML = `
    <div class="popup-content">
      <div class="popup-header">
        <img src="${icon}" style="height:28px; margin-right:10px;">
        <strong>${title}</strong>
        <button class="popup-close">×</button>
      </div>
      <div class="popup-body">
        <strong>${categoryName}</strong><br>
        ${body}
      </div>
      <div class="popup-footer">
        <small>Automatisch schließen in <span id="popup-countdown">30</span> Sekunden</small>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  let timeLeft = 30;
  const countdownEl = popup.querySelector('#popup-countdown');

  const timer = setInterval(() => {
    timeLeft--;
    if (countdownEl) countdownEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timer);
      popup.remove();
    }
  }, 1000);

  popup.querySelector('.popup-close').addEventListener('click', () => {
    clearInterval(timer);
    popup.remove();
  });
}

// Wichtiger Alarm (3x Piep + visuell)
function triggerImportantAlert(item, itemType, categoryName) {
  const uniqueId = `${itemType}-${item.id || item.pubMillis || Date.now()}`;

  if (appState.notifiedIds.has(uniqueId)) return;
  appState.notifiedIds.add(uniqueId);

  if (appState.userHasInteracted && !appState.isAlarmPlaying) {
    appState.isAlarmPlaying = true;
    playAttentionBeep(3);
    triggerVisualAlarm();
  }

  showImportantPopup(item, itemType, categoryName);

  if (appState.notificationPermission === 'granted') {
    try {
      new Notification(getNotificationTitle(item, itemType), {
        body: `${categoryName}\n${getNotificationBody(item, itemType)}`,
        icon: getNotificationIcon(item, itemType)
      });
    } catch (e) {
      console.warn("Desktop-Benachrichtigung fehlgeschlagen", e);
    }
  }
}

// Hilfsfunktionen
function getNotificationTitle(item, itemType) {
  if (itemType === 'alerts') return `${alertTypesTrans?.[item.type] || item.type} – ${item.street || ''}`;
  if (itemType === 'jams') return `Stau Level ${item.level} – ${item.street || ''}`;
  return "Wichtige Verkehrsstörung";
}

function getNotificationBody(item, itemType) {
  if (itemType === 'alerts') return item.city || '';
  if (itemType === 'jams') return `${item.length} m | ${item.speedKMH || '?'} km/h`;
  return '';
}

function getNotificationIcon(item, itemType) {
  if (itemType === 'alerts') {
    if (item.type === 'ACCIDENT') return '../assets/accident.png';
    if (item.type === 'ROAD_CLOSED') return '../assets/sperrung.png';
    return '../assets/hazard.png';
  }
  return '../assets/stau.png';
}

// Testalarm
function triggerTestAlarm() {
  console.log("🧪 Testalarm ausgelöst (3x Piep + visueller Alarm)");

  const testItem = {
    type: "ACCIDENT",
    street: "Teststrecke A3",
    city: "Oberndorf",
    pubMillis: Date.now(),
    id: "test-" + Date.now()
  };

  appState.userHasInteracted = true;
  triggerImportantAlert(testItem, 'alerts', "🧪 TESTALARM – Feuerwehr Oberndorf");
}

// View Toggle + fixer Zurück-Button
function toggleView() {
  appState.isMapExpanded = !appState.isMapExpanded;
  const body = document.body;

  if (appState.isMapExpanded) {
    body.classList.add('map-expanded');
    showBackButton();
  } else {
    body.classList.remove('map-expanded');
    hideBackButton();
  }

  if (appState.map) {
    setTimeout(() => appState.map.invalidateSize(), 120);
  }
}

function showBackButton() {
  let backBtn = document.getElementById('back-to-list-btn');
  if (!backBtn) {
    backBtn = document.createElement('button');
    backBtn.id = 'back-to-list-btn';
    backBtn.innerHTML = '📋 Liste wiederherstellen';
    backBtn.style.cssText = `
      position: fixed; top: 12px; right: 12px; z-index: 100000;
      padding: 12px 18px; background: #27ae60; color: white;
      border: none; border-radius: 8px; font-size: 1.02em; font-weight: 600;
      box-shadow: 0 4px 15px rgba(0,0,0,0.4); min-height: 52px;
      touch-action: manipulation;
    `;
    backBtn.addEventListener('click', toggleView);
    document.body.appendChild(backBtn);
  }
  backBtn.style.display = 'block';
}

function hideBackButton() {
  const backBtn = document.getElementById('back-to-list-btn');
  if (backBtn) backBtn.style.display = 'none';
}

// Warte auf Map
function waitForMap(callback, maxAttempts = 50) {
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    if (window.leafletMap) {
      clearInterval(check);
      console.log("✅ Leaflet Map erkannt – starte Anwendung");
      appState.map = window.leafletMap;
      callback();
    } else if (attempts >= maxAttempts) {
      clearInterval(check);
      console.error("❌ Leaflet Map konnte nicht gefunden werden.");
    }
  }, 80);
}

// ================================================
// Haupt-Fetch-Funktion mit aggressivem No-Cache
// ================================================
export async function refreshData() {
  if (appState.isLoading) {
    console.log("⏳ refreshData() bereits aktiv – übersprungen");
    return;
  }

  appState.isLoading = true;

  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = 'Daten werden frisch vom Proxy geladen...';
  }

  try {
    console.log("🔄 Starte Fetch von proxy.php mit no-store...");

    const res = await fetch(WAZE_URL, {
      cache: 'no-store',                    // Browser-Cache komplett umgehen
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} – ${res.statusText}`);
    }

    const data = await res.json();

    if (statusEl) statusEl.style.display = 'none';
    document.getElementById('last-updated').textContent =
      `Aktueller Stand: ${new Date().toLocaleString('de-DE')} Uhr`;

    // Kategorien zurücksetzen
    appState.categories.forEach(cat => {
      cat.items.alerts = [];
      cat.items.jams = [];
      cat.items.irregularities = [];
    });

    const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
    const jams = Array.isArray(data?.jams) ? data.jams : [];

    console.log(`✅ Geladen → Alerts: ${alerts.length}, Jams: ${jams.length}`);

    const alertMarkers = [];

    alerts.forEach(alert => {
      if (!alert?.location?.x || !alert?.location?.y) return;

      if (assignToCategory(alert, 'alerts', appState.categories, appState.bigPolygonCoords)) {
        const icon = window.alertIcons?.[alert.type] ?? window.defaultAlertIcon;
        const marker = L.marker([alert.location.y, alert.location.x], { icon })
          .bindPopup(buildAlertContent(alert));

        alert._leafletLayer = marker;
        alertMarkers.push(marker);

        const category = appState.categories.find(c => c.items.alerts.includes(alert));
        if (category && shouldTriggerNotification(alert, 'alerts', category)) {
          triggerImportantAlert(alert, 'alerts', category.name);
        }
      }
    });

    appState.alertClusterGroup.clearLayers();
    if (alertMarkers.length) appState.alertClusterGroup.addLayers(alertMarkers);

    const jamPolylines = [];
    jams.forEach(jam => {
      if (!Array.isArray(jam?.line) || jam.line.length < 2) return;

      if (assignToCategory(jam, 'jams', appState.categories, appState.bigPolygonCoords)) {
        const latlngs = jam.line
          .filter(p => typeof p?.y === 'number' && typeof p?.x === 'number')
          .map(p => [p.y, p.x]);

        if (latlngs.length < 2) return;

        const polyline = L.polyline(latlngs, {
          color: getJamMapColor(jam.level),
          weight: 5,
          opacity: 0.85
        }).bindPopup(buildJamContent(jam));

        jam._leafletLayer = polyline;
        jamPolylines.push(polyline);

        const category = appState.categories.find(c => c.items.jams.includes(jam));
        if (category && shouldTriggerNotification(jam, 'jams', category)) {
          triggerImportantAlert(jam, 'jams', category.name);
        }
      }
    });

    appState.jamLayerGroup.clearLayers();
    jamPolylines.forEach(p => appState.jamLayerGroup.addLayer(p));

    renderUI(appState.categories);

  } catch (err) {
    console.error("❌ Daten-Ladefehler:", err);
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = `Fehler beim Laden: ${err.message}`;
  } finally {
    appState.isLoading = false;
    startCountdown();
  }
}

// Countdown
function startCountdown() {
  if (appState.countdownInterval) clearInterval(appState.countdownInterval);

  appState.countdown = 30;
  const countdownEl = document.getElementById('countdown-timer');

  appState.countdownInterval = setInterval(() => {
    appState.countdown--;
    if (appState.countdown <= 0) {
      clearInterval(appState.countdownInterval);
      refreshData();
    } else if (countdownEl) {
      countdownEl.textContent = `Nächste Aktualisierung in ${appState.countdown} Sekunden`;
    }
  }, 1000);
}

// Button-Setup
function setupManualRefresh() {
  const btn = document.getElementById('manual-refresh');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (appState.isLoading) return;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = 'Lädt...';

    try {
      await refreshData();
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = '↻ Aktualisieren';
      }, 600);
    }
  });
}

function setupTestAlarmButton() {
  const testBtn = document.getElementById('test-alarm');
  if (testBtn) {
    testBtn.addEventListener('click', triggerTestAlarm);
    console.log("✅ Testalarm-Button erfolgreich registriert");
  }
}

// Initialisierung
function initApp() {
  injectAlarmStyles();

  appState.alertClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    spiderfyOnMaxZoom: true
  });

  appState.jamLayerGroup = L.layerGroup();
  appState.irregularityLayerGroup = L.layerGroup();

  appState.alertClusterGroup.addTo(appState.map);
  appState.jamLayerGroup.addTo(appState.map);
  appState.irregularityLayerGroup.addTo(appState.map);

  appState.bigPolygonCoords = parseWKT(bigPolygonWKT);

  appState.categories = rawCategories.map(cat => ({
    name: cat.name,
    coords: parseWKT(cat.wkt),
    items: { alerts: [], jams: [], irregularities: [] },
    notifications: cat.notifications || { alerts: [], jams: [], irregularities: [] }
  }));

  console.log(`✅ App initialisiert mit ${appState.categories.length} Kategorien`);

  // User-Interaktion für Audio & Notifications
  document.addEventListener('click', () => {
    appState.userHasInteracted = true;
    requestNotificationPermission();
  }, { once: true });

  // Buttons registrieren
  document.getElementById('toggle-view')?.addEventListener('click', toggleView);
  document.getElementById('test-alarm')?.addEventListener('click', triggerTestAlarm);

  refreshData();
  startCountdown();
  setupManualRefresh();
  setupTestAlarmButton();
}

// Start
window.refreshTrafficData = refreshData;
waitForMap(initApp);