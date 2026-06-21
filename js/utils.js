// JavaScript Document
// utils.js – allgemeine Hilfsfunktionen

"use strict";

export function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error("JSON-Parsing fehlgeschlagen:", e);
    return null;
  }
}

export function isValidLatLng(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
         lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function throttle(fn, delay = 300) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

export function debounce(fn, delay = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
