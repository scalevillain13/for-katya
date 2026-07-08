(function () {
  "use strict";

  /** Minimal line icons — warm palette via currentColor in CSS */
  const RITUAL_ICONS = {
    sweets: `<svg class="ritual-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 3c-3.5 0-6 2.2-6 5.5 0 1.8.8 3.4 2 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M12 3c3.5 0 6 2.2 6 5.5 0 1.8-.8 3.4-2 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <ellipse cx="12" cy="15.5" rx="7.5" ry="4" stroke="currentColor" stroke-width="1.4"/>
      <path d="M9 15.5c0-1.2 1.3-2.2 3-2.2s3 1 3 2.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      <circle cx="10" cy="8" r="0.8" fill="currentColor" opacity="0.45"/>
      <circle cx="14" cy="7" r="0.6" fill="currentColor" opacity="0.35"/>
    </svg>`,

    series: `<svg class="ritual-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="13" rx="2.2" stroke="currentColor" stroke-width="1.4"/>
      <path d="M8 21h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M12 18v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M10 10.5l5 2.5-5 2.5v-5z" fill="currentColor" opacity="0.85"/>
      <path d="M6 8.5h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.4"/>
    </svg>`,

    chat: `<svg class="ritual-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.5 6.5A3 3 0 017.5 3.5h9a3 3 0 013 3v5.5a3 3 0 01-3 3h-5.5L7 17.5v-2.5H7.5a3 3 0 01-3-3V6.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M8.5 9h7M8.5 12h4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.75"/>
      <path d="M16.5 8.5c.8.4 1.3 1 1.3 1.8 0 1.2-1.2 2.2-2.7 2.2-.5 0-1-.1-1.4-.3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.5"/>
    </svg>`,
  };

  const CANDY_ICON = `<svg class="candy-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M8 12c-2-1.5-2.5-4-.5-5.5S11 4.5 12 6s1 4.5-.5 6-3.5 1.5-3.5 0z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M16 12c2-1.5 2.5-4 .5-5.5S13 4.5 12 6s-1 4.5.5 6 3.5 1.5 3.5 0z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <ellipse cx="12" cy="12" rx="2.2" ry="3" fill="currentColor" opacity="0.35"/>
  </svg>`;

  window.RITUAL_ICONS = RITUAL_ICONS;
  window.CANDY_ICON = CANDY_ICON;
})();
