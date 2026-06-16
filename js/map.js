// map.js – Leaflet-Karteninitialisierung mit sicherer DOM-Prüfung

"use strict";

document.addEventListener('DOMContentLoaded', function initMap() {
    const container = document.getElementById('map-container');
    if (!container) {
        console.error("FEHLER: #map-container wurde nicht gefunden!");
        return;
    }

    const map = L.map('map-container', {
        zoomControl: true,
        attributionControl: true
    }).setView([49.83, 9.50], 12);

    // Tile Layers
    const lightLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd'
    });

    lightLayer.addTo(map);

    // Globale Referenzen für andere Skripte
    window.leafletMap = map;
    window.lightTileLayer = lightLayer;
    window.darkTileLayer = darkLayer;

    // Icons
    const iconConfig = {
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    };

    const icons = {
        'JAM': L.icon({ iconUrl: 'assets/stau.png', ...iconConfig }),
        'HAZARD': L.icon({ iconUrl: 'assets/hazard.png', ...iconConfig }),
        'ACCIDENT': L.icon({ iconUrl: 'assets/accident.png', ...iconConfig }),
        'ROAD_CLOSED': L.icon({ iconUrl: 'assets/sperrung.png', ...iconConfig })
    };

    const defaultAlertIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    window.alertIcons = icons;
    window.defaultAlertIcon = defaultAlertIcon;

    console.log("✅ Leaflet Map erfolgreich initialisiert");

    // WICHTIG: Starte main.js erst, wenn die Karte fertig ist
    if (typeof window.startMain === 'function') {
        window.startMain();
    }
});