// theme.js – Optimierte Version mit Warte-Logik für Leaflet Map

"use strict";

const html = document.documentElement;
const toggleBtn = document.getElementById('theme-toggle');

const THEME_CONFIG = {
  dark: {
    class: 'dark',
    buttonText: '☀️ Light Mode',
    mapLayer: 'dark'
  },
  light: {
    class: 'light',
    buttonText: '🌙 Dark Mode',
    mapLayer: 'light'
  }
};

let currentTheme = 'light';

// ================================================
// Karte aktualisieren (mit Retry, falls noch nicht bereit)
// ================================================
function updateMapTheme(desiredLayer) {
  const map = window.leafletMap;
  const lightLayer = window.lightTileLayer;
  const darkLayer = window.darkTileLayer;

  if (!map || !lightLayer || !darkLayer) {
    // Karte noch nicht bereit → in 100ms erneut versuchen (max. 10 Versuche)
    let attempts = 0;
    const retry = setInterval(() => {
      attempts++;
      const m = window.leafletMap;
      const l = window.lightTileLayer;
      const d = window.darkTileLayer;

      if (m && l && d) {
        clearInterval(retry);
        performLayerSwitch(m, l, d, desiredLayer);
      } else if (attempts > 10) {
        clearInterval(retry);
        console.warn("⚠️ Konnte Karten-Layer nicht wechseln – Map zu spät initialisiert.");
      }
    }, 100);
    return;
  }

  performLayerSwitch(map, lightLayer, darkLayer, desiredLayer);
}

function performLayerSwitch(map, lightLayer, darkLayer, desiredLayer) {
  try {
    if (desiredLayer === 'dark') {
      if (map.hasLayer(lightLayer)) map.removeLayer(lightLayer);
      if (!map.hasLayer(darkLayer)) map.addLayer(darkLayer);
    } else {
      if (map.hasLayer(darkLayer)) map.removeLayer(darkLayer);
      if (!map.hasLayer(lightLayer)) map.addLayer(lightLayer);
    }
  } catch (e) {
    console.error("Fehler beim Layer-Wechsel:", e);
  }
}

// ================================================
// Theme anwenden
// ================================================
function applyTheme(theme) {
  if (!THEME_CONFIG[theme]) theme = 'light';

  const config = THEME_CONFIG[theme];
  currentTheme = theme;

  html.classList.remove('dark', 'light');
  html.classList.add(config.class);

  if (toggleBtn) {
    toggleBtn.textContent = config.buttonText;
  }

  updateMapTheme(config.mapLayer);
  localStorage.setItem('theme', theme);

  console.log(`✅ Theme gewechselt zu: ${theme}`);
}

// ================================================
// Toggle-Button + Tastatur
// ================================================
function setupThemeToggle() {
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });
}

// ================================================
// Initialisierung
// ================================================
export function initTheme() {
  let savedTheme = localStorage.getItem('theme');
  if (!savedTheme) {
    savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  applyTheme(savedTheme);
  setupThemeToggle();

  console.log("✅ Theme-System erfolgreich initialisiert");
}

// Automatischer Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}

// Öffentliche API
window.switchTheme = applyTheme;