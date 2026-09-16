const sharp = require('sharp');
const fs = require('fs');

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="25%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#0ea5e9" />
      <stop offset="75%" stop-color="#7dd3fc" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#ffffff" />
  <text x="256" y="240" font-family="-apple-system, system-ui, sans-serif" font-weight="800" font-size="90" fill="url(#blueGradient)" text-anchor="middle" dominant-baseline="middle">Our</text>
  <text x="256" y="340" font-family="-apple-system, system-ui, sans-serif" font-weight="800" font-size="90" fill="url(#blueGradient)" text-anchor="middle" dominant-baseline="middle">Tracker</text>
</svg>
`;

sharp(Buffer.from(svg))
  .png()
  .toFile('public/apple-touch-icon.png')
  .then(() => console.log('Successfully generated apple-touch-icon.png'))
  .catch(err => console.error(err));
