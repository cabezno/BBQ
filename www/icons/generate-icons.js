/**
 * Generate BBQ PWA icons as PNG using Canvas
 * Run: node icons/generate-icons.js
 */
const fs = require('fs');
const path = require('path');

// Generate SVG icon and save
function generateSvgIcon(size, filename) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffe01b"/>
      <stop offset="60%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#f97316"/>
    </linearGradient>
    <linearGradient id="flame" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffe01b"/>
      <stop offset="60%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#f97316"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#bg)"/>
  <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="${Math.round(size * 0.21)}" fill="none" stroke="#ef4444" stroke-width="3"/>
  <g transform="translate(${size / 2}, ${size * 0.42})">
    <text font-family="Arial, sans-serif" font-weight="900" font-size="${Math.round(size * 0.3)}" fill="#0b141a" text-anchor="middle" dominant-baseline="central">🔥</text>
  </g>
  <g transform="translate(${size / 2}, ${size * 0.75})">
    <text font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${Math.round(size * 0.16)}" fill="#0b141a" text-anchor="middle" dominant-baseline="central">BBQ</text>
  </g>
</svg>`;

    const filePath = path.join(__dirname, filename);
    fs.writeFileSync(filePath, svg);
    console.log(`Generated: ${filePath} (${size}x${size})`);
}

generateSvgIcon(192, 'icon-192.svg');
generateSvgIcon(512, 'icon-512.svg');

console.log('\nDone! SVG icons generated in /icons/');
