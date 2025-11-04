// App Entry Point
import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider } from './shared/context/AuthContext';
import { router } from './app/router';
import './shared/config/i18n'; // Initialize i18n
import './index.css';
import './ios-pwa-fixes.css';

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);
        
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, reload page
              console.log('🔄 New version available, reloading...');
              window.location.reload();
            }
          });
        });
      })
      .catch((error) => {
        console.log('❌ Service Worker registration failed:', error);
      });
  });
}

// iOS PWA: Prevent pull-to-refresh while keeping normal scrolling
let touchStartY = null;

document.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    touchStartY = e.touches[0].clientY;
  } else {
    touchStartY = null;
  }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) {
    // Allow pinch zoom
    touchStartY = null;
    return;
  }

  if (touchStartY === null) {
    touchStartY = e.touches[0].clientY;
  }

  const scrollContainer = document.scrollingElement || document.documentElement;
  const scrollTop = window.scrollY ?? (scrollContainer ? scrollContainer.scrollTop : 0);
  const currentY = e.touches[0].clientY;

  if (scrollTop <= 0 && currentY > touchStartY) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('touchend', () => {
  touchStartY = null;
}, { passive: true });

// iOS PWA: Prevent double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>
  // </StrictMode>
);
