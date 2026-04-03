// ui.js – Bereinigte Version mit visueller Markierung für "Andere"

"use strict";

import {
  jamLevelsTrans,
  alertTypesTrans,
  alertSubtypesTrans,
  irrTypesTrans
} from './data.js';

import {
  isPointInPolygonTurf,
  isLineInPolygonTurf
} from './geometry.js';

// ================================================
// Formatierungen
// ================================================
function formatDate(millis) {
  if (!millis) return 'Keine Angabe';
  return new Date(millis).toLocaleString('de-DE') + ' Uhr';
}

function getJamColorClass(level) {
  switch (level) {
    case 1: return 'color-gold';
    case 2: return 'color-orange';
    case 3: return 'color-red';
    case 4: return 'color-darkred';
    case 5: return 'color-darkred';
    default: return 'color-gray';
  }
}

function getJamMapColor(level) {
  switch (level) {
    case 1: return '#f1c40f';
    case 2: return '#f39c12';
    case 3: return '#e74c3c';
    case 4: return '#c0392b';
    case 5: return '#8e0000';
    default: return '#95a5a6';
  }
}

function formatCategoryName(name) {
  let n = (name || '').trim();

  if (n === 'Andere') {
    return '<span style="color:#777;">Andere <small style="font-weight:normal;">(nicht zugeordnete Meldungen)</small></span>';
  }

  n = n.replace('A3', '<img src="./assets/AS.png" style="height:1.2em; vertical-align:middle; margin-right:5px;"> A3');
  n = n.replace('St 2312', '<img src="./assets/B10.png" style="height:1.2em; vertical-align:middle; margin-right:5px;"> St 2312');

  if (n === 'Stadtgebiet Stuttgart') {
    n = '<img src="./assets/S.png" style="height:1.2em; vertical-align:middle; margin-right:5px;"> Stadtgebiet Stuttgart';
  }

  return n;
}

// ================================================
// Content Builder (unverändert)
// ================================================
function buildAlertContent(d) {
  const typeText = alertTypesTrans[d.type] || d.type;
  const subtypeText = alertSubtypesTrans[d.subtype] || d.subtype || 'Keine Angabe';

  let iconFile = '';
  if (d.type === 'ACCIDENT') iconFile = '../assets/accident.png';
  else if (d.type === 'JAM') iconFile = '../assets/stau.png';
  else if (d.type === 'ROAD_CLOSED') iconFile = '../assets/sperrung.png';
  else if (d.type === 'HAZARD') iconFile = '../assets/hazard.png';

  const iconHtml = iconFile ? `<img src="${iconFile}" style="height:1.2em; margin-right:6px;">` : '';
  const thumbsUp = (d.numberOfThumbsUp && d.numberOfThumbsUp > 0)
    ? `<span style="margin-left:8px; color:#e74c3c; font-weight:bold;">👍 ${d.numberOfThumbsUp}</span>`
    : '';

  return `
    <div class="report-title">${iconHtml}${typeText}${thumbsUp}</div>
    <div class="report-grid">
      <span>Ort:</span> <strong>${d.street || 'N/A'}, ${d.city || 'N/A'}</strong>
      <span>Zeitstempel:</span> <strong>${formatDate(d.pubMillis)}</strong>
      <span>Subtype:</span> <strong>${subtypeText}</strong>
      <span>Ausrichtung:</span> <strong>${d.magvar != null ? d.magvar + '°' : 'N/A'}</strong>
      <span>Zuverlässigkeit:</span> <strong>${d.confidence || 'N/A'}</strong>
    </div>
  `;
}

function buildJamContent(d) {
  const titleText = jamLevelsTrans[d.level] || `Stau (Level ${d.level})`;
  const iconFile = d.level === 5 ? '../assets/sperrung.png' : '../assets/stau.png';

  return `
    <div class="report-title"><img src="${iconFile}" style="height:1.2em; margin-right:6px;">${titleText}</div>
    <div class="report-grid">
      <span>Ort:</span> <strong>${d.street || 'N/A'}, ${d.city || 'N/A'}</strong>
      <span>Zeitstempel:</span> <strong>${formatDate(d.pubMillis)}</strong>
      <span>Länge:</span> <strong>${d.length} m</strong>
      <span>Geschwindigkeit:</span> <strong>${d.speedKMH} km/h</strong>
      <span>Verzögerung:</span> <strong>${d.delay > -1 ? Math.round(d.delay / 60) + ' min' : 'N/A'}</strong>
    </div>
  `;
}

function buildIrregularityContent(d) {
  const typeText = irrTypesTrans[d.type] || d.type;

  return `
    <div class="report-title">${typeText}</div>
    <div class="report-grid">
      <span>Ort:</span> <strong>${d.street || 'N/A'}, ${d.city || 'N/A'}</strong>
      <span>Zeitstempel:</span> <strong>${formatDate(d.updateDateMillis)}</strong>
      <span>Länge:</span> <strong>${d.length} m</strong>
      <span>Geschwindigkeit:</span> <strong>${d.speed ? Math.round(d.speed) : 0} km/h</strong>
      <span>Verzögerung:</span> <strong>${Math.round(d.delaySeconds / 60)} min</strong>
      <span>Fahrer / Alerts:</span> <strong>${d.driversCount || 0} / ${d.alertsCount || 0}</strong>
    </div>
  `;
}

// ================================================
// Interaktion
// ================================================
function addZoomClickEvent(div, itemData) {
  div.style.cursor = 'pointer';
  div.onclick = () => {
    const map = window.leafletMap;
    if (!map || !itemData?._leafletLayer) return;

    if (itemData._leafletLayer.getBounds) {
      map.fitBounds(itemData._leafletLayer.getBounds(), { padding: [50, 50], maxZoom: 16 });
    } else {
      map.setView(itemData._leafletLayer.getLatLng(), 16);
    }
    itemData._leafletLayer.openPopup();
  };
}

// ================================================
// Kategorisierung
// ================================================
function assignToCategory(itemData, itemType, categories, bigPolygonCoords) {
  let isInBigPolygon = false;

  if (itemType === 'alerts') {
    const point = [itemData.location.y, itemData.location.x];
    isInBigPolygon = isPointInPolygonTurf(point, bigPolygonCoords);
  } else {
    isInBigPolygon = isLineInPolygonTurf(itemData.line, bigPolygonCoords);
  }

  if (!isInBigPolygon && bigPolygonCoords.length > 0) return false;

  for (let i = 0; i < categories.length - 1; i++) {
    const cat = categories[i];
    let isInside = false;

    if (itemType === 'alerts') {
      const point = [itemData.location.y, itemData.location.x];
      isInside = isPointInPolygonTurf(point, cat.coords);
    } else {
      isInside = isLineInPolygonTurf(itemData.line, cat.coords);
    }

    if (isInside) {
      cat.items[itemType].push(itemData);
      return true;
    }
  }

  // Fallback → "Andere"
  categories[categories.length - 1].items[itemType].push(itemData);
  return true;
}

// ================================================
// Benachrichtigungs-Prüfung
// ================================================
function shouldTriggerNotification(itemData, itemType, category) {
  if (!category || !category.notifications) return false;

  const notif = category.notifications;

  if (itemType === 'alerts') {
    return Array.isArray(notif.alerts) && notif.alerts.includes(itemData.type);
  }
  if (itemType === 'jams') {
    return Array.isArray(notif.jams) && notif.jams.includes(itemData.level);
  }
  if (itemType === 'irregularities') {
    return Array.isArray(notif.irregularities) && notif.irregularities.includes(itemData.type);
  }
  return false;
}

// ================================================
// Haupt-Render Funktion mit visueller Markierung für "Andere"
// ================================================
function renderUI(categories) {
  const container = document.getElementById('categories-container');
  if (!container) {
    console.error("renderUI: #categories-container nicht gefunden!");
    return;
  }

  const fragment = document.createDocumentFragment();

  const sectionConfig = {
    'Meldungen': { open: true },
    'Staus': { open: true },
    'Sperrungen': { open: false },
    'Verkehrsstörungen': { open: false }
  };

  let rendered = 0;

  categories.forEach(cat => {
    const totalItems = cat.items.alerts.length + cat.items.jams.length + cat.items.irregularities.length;
    if (totalItems === 0) return;

    rendered++;

    const section = document.createElement('div');
    section.className = 'category-section';

    // Visuelle Markierung für "Andere"
    if (cat.name === 'Andere') {
      section.classList.add('category-andere');
    }

    const header = document.createElement('div');
    header.className = 'category-header';
    header.innerHTML = formatCategoryName(cat.name);
    section.appendChild(header);

    const realJams = cat.items.jams.filter(jam => jam.level < 5);
    if (realJams.length > 0) {
      let totalLen = 0, totalDelay = 0, speedSum = 0, speedCount = 0;
      realJams.forEach(j => {
        totalLen += (j.length || 0);
        if (j.delay > -1) totalDelay += j.delay;
        if (j.speedKMH > 0) {
          speedSum += j.speedKMH;
          speedCount++;
        }
      });

      const avgSpeed = speedCount > 0 ? Math.round(speedSum / speedCount) : 0;

      const summary = document.createElement('div');
      summary.className = 'summary-section';
      summary.innerHTML = `
        <div class="summary-title">
          <img src="../assets/stau.png" style="height:1.2em;"> Stauübersicht aktuell
        </div>
        <div class="report-grid">
          <span>Gesamtlänge:</span> <strong>${totalLen} m</strong>
          <span>Ø Geschwindigkeit:</span> <strong>${avgSpeed} km/h</strong>
          <span>Verzögerung gesamt:</span> <strong>${Math.round(totalDelay / 60)} min</strong>
        </div>
      `;
      section.appendChild(summary);
    }

    function createDetail(title, items, builderFn, sectionKey, extraClass = '') {
      if (items.length === 0) return null;

      const det = document.createElement('details');
      if (sectionConfig[sectionKey]?.open) det.setAttribute('open', '');

      const summaryHTML = sectionKey === 'Sperrungen' ? `<strong>${title}</strong>` : title;
      det.innerHTML = `<summary>${summaryHTML}</summary>`;

      const content = document.createElement('div');
      content.className = `details-content ${extraClass}`;

      items.forEach(item => {
        const div = document.createElement('div');
        div.className = `report-item ${extraClass || getItemColorClass(item)}`;
        div.innerHTML = builderFn(item);
        addZoomClickEvent(div, item);
        content.appendChild(div);
      });

      det.appendChild(content);
      return det;
    }

    function getItemColorClass(item) {
      if (item.level !== undefined) return getJamColorClass(item.level);
      if (item.type === 'HAZARD') return 'color-gold';
      if (item.type === 'ACCIDENT') return 'color-gray';
      if (item.type === 'JAM') return 'color-red';
      return 'color-purple';
    }

    const realAlerts = cat.items.alerts.filter(a => a.type !== 'ROAD_CLOSED');
    const alertsDetail = createDetail(`Meldungen (${realAlerts.length})`, realAlerts, buildAlertContent, 'Meldungen');
    if (alertsDetail) section.appendChild(alertsDetail);

    const stausDetail = createDetail(`Staus (${realJams.length})`, realJams, buildJamContent, 'Staus');
    if (stausDetail) section.appendChild(stausDetail);

    const closures = [
      ...cat.items.jams.filter(j => j.level === 5),
      ...cat.items.irregularities.filter(i => i.level === 5 || i.type === "HUGE"),
      ...cat.items.alerts.filter(a => a.type === 'ROAD_CLOSED')
    ];

    const sperrungenDetail = createDetail(`Sperrungen (${closures.length})`, closures,
      (item) => item.level === 5 ? buildJamContent(item) :
                item.type === 'ROAD_CLOSED' ? buildAlertContent(item) : buildIrregularityContent(item),
      'Sperrungen', 'bg-striped');
    if (sperrungenDetail) section.appendChild(sperrungenDetail);

    const otherIrr = cat.items.irregularities.filter(i => i.level !== 5 && i.type !== "HUGE");
    const irrDetail = createDetail(`Verkehrsstörungen (${otherIrr.length})`, otherIrr, buildIrregularityContent, 'Verkehrsstörungen');
    if (irrDetail) section.appendChild(irrDetail);

    fragment.appendChild(section);
  });

  container.innerHTML = '';
  container.appendChild(fragment);

  console.log(`✅ renderUI fertig – ${rendered} Kategorien angezeigt`);
}

// ================================================
// EINZIGER Export-Block
// ================================================
export {
  formatDate,
  getJamColorClass,
  getJamMapColor,
  formatCategoryName,
  buildAlertContent,
  buildJamContent,
  buildIrregularityContent,
  addZoomClickEvent,
  assignToCategory,
  renderUI,
  shouldTriggerNotification
};