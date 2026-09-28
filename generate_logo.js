import fs from 'fs';
import { execSync } from 'child_process';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bgGrad" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#fff8f5" />
      <stop offset="70%" stop-color="#fceae3" />
      <stop offset="100%" stop-color="#f5d6cc" />
    </radialGradient>
    
    <!-- Gold Rim Gradient -->
    <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e8bf65" />
      <stop offset="25%" stop-color="#fceec2" />
      <stop offset="50%" stop-color="#c99532" />
      <stop offset="75%" stop-color="#fceec2" />
      <stop offset="100%" stop-color="#b07d1e" />
    </linearGradient>

    <!-- Rose Text Gradient -->
    <linearGradient id="roseGrad" x1="0%" y1="0%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#e2336e" />
      <stop offset="100%" stop-color="#b81b50" />
    </linearGradient>

    <!-- Drop Shadow -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.18" />
    </filter>
  </defs>

  <!-- Outer Shadow Circle -->
  <circle cx="256" cy="256" r="248" fill="url(#goldRim)" filter="url(#shadow)" />
  <circle cx="256" cy="256" r="236" fill="#7a5518" />
  <circle cx="256" cy="256" r="232" fill="url(#goldRim)" />
  <circle cx="256" cy="256" r="222" fill="url(#bgGrad)" />

  <!-- Inner subtle ring -->
  <circle cx="256" cy="256" r="218" fill="none" stroke="#f1cb89" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6" />

  <!-- Lady with Hat Silhouette (Left) -->
  <g transform="translate(60, 60)" filter="url(#shadow)">
    <!-- Lady Hat -->
    <path d="M 50 120 C 65 60, 160 55, 185 105 C 205 110, 215 125, 210 135 C 190 150, 70 150, 45 135 Z" fill="#f79bb7" />
    <!-- Hat Ribbon & Bow -->
    <path d="M 68 115 C 100 100, 150 100, 180 115 C 170 122, 100 125, 68 115 Z" fill="#1e1e1e" />
    <!-- Bow -->
    <ellipse cx="85" cy="120" rx="14" ry="9" fill="#1e1e1e" transform="rotate(-15, 85, 120)" />
    <!-- Lady Profile -->
    <path d="M 125 125 C 145 145, 155 170, 140 195 C 132 195, 125 185, 125 175 C 120 170, 115 175, 112 185 C 105 180, 100 170, 102 160 C 105 150, 115 140, 125 125 Z" fill="#fdd8c7" />
    <!-- Golden Earring -->
    <circle cx="123" cy="180" r="4.5" fill="#f3be3a" stroke="#a2750e" stroke-width="1" />
    <!-- Flowing Hair -->
    <path d="M 70 125 C 90 140, 100 165, 85 195 C 75 215, 95 240, 110 245 C 90 240, 70 215, 65 190 C 60 170, 50 145, 70 125 Z" fill="#1e1e1e" />
  </g>

  <!-- Baby Dress & Hanger (Right Top) -->
  <g transform="translate(325, 75)" filter="url(#shadow)">
    <!-- Wooden Hanger -->
    <path d="M 28 35 C 20 15, 36 5, 46 15 C 50 22, 45 28, 43 35" fill="none" stroke="#ba8c46" stroke-width="3" stroke-linecap="round" />
    <path d="M 5 45 L 43 35 L 81 45 Z" fill="#cfa55e" stroke="#ba8c46" stroke-width="1.5" />
    <!-- Pink Dress with ruffled sleeves -->
    <path d="M 18 48 C 25 46, 61 46, 68 48 L 78 68 C 70 70, 65 65, 60 62 L 66 115 C 43 122, 33 122, 20 115 L 26 62 C 21 65, 16 70, 8 68 Z" fill="#f7a7bf" />
    <!-- Dress Ribbon Bow -->
    <rect x="36" y="65" width="14" height="9" rx="3" fill="#e885a3" />
    <circle cx="43" cy="69" r="3" fill="#ffffff" />
  </g>

  <!-- Cute Teddy Bear (Far Right) -->
  <g transform="translate(385, 160)" filter="url(#shadow)">
    <!-- Bear Body -->
    <circle cx="35" cy="50" r="22" fill="#d29e6c" />
    <!-- Bear Head -->
    <circle cx="35" cy="25" r="18" fill="#dfae7c" />
    <!-- Ears -->
    <circle cx="21" cy="12" r="7" fill="#dfae7c" />
    <circle cx="21" cy="12" r="4" fill="#f1c79a" />
    <circle cx="49" cy="12" r="7" fill="#dfae7c" />
    <circle cx="49" cy="12" r="4" fill="#f1c79a" />
    <!-- Muzzle & Nose -->
    <ellipse cx="35" cy="28" rx="8" ry="6" fill="#f7ddbe" />
    <ellipse cx="35" cy="26" rx="3" ry="2" fill="#3a2512" />
    <circle cx="29" cy="21" r="2" fill="#222" />
    <circle cx="41" cy="21" r="2" fill="#222" />
    <!-- Bow tie -->
    <path d="M 30 38 L 40 44 L 40 38 L 30 44 Z" fill="#f07297" />
  </g>

  <!-- Small Golden Crown above Dokan -->
  <g transform="translate(230, 205)">
    <path d="M 8 24 L 0 8 L 13 14 L 26 2 L 39 14 L 52 8 L 44 24 Z" fill="url(#goldRim)" filter="url(#shadow)" />
    <circle cx="0" cy="8" r="2.5" fill="#fceec2" />
    <circle cx="26" cy="2" r="3" fill="#fceec2" />
    <circle cx="52" cy="8" r="2.5" fill="#fceec2" />
  </g>

  <!-- Main Arabic Brand Name: دكان إيلين -->
  <g transform="translate(256, 315)" text-anchor="middle" filter="url(#shadow)">
    <!-- Main stylized typography -->
    <text x="0" y="0" font-family="'Tajawal', 'Cairo', 'Segoe UI', sans-serif" font-weight="900" font-size="62" letter-spacing="1">
      <tspan fill="#1e1e1e">دكان </tspan>
      <tspan fill="url(#roseGrad)">إيلين</tspan>
    </text>
  </g>

  <!-- Small Heart Divider -->
  <g transform="translate(256, 342)" filter="url(#shadow)">
    <path d="M 0 6 C -2 0, -10 -2, -10 4 C -10 10, 0 17, 0 17 C 0 17, 10 10, 10 4 C 10 -2, 2 0, 0 6 Z" fill="#e2336e" />
    <line x1="-130" y1="10" x2="-20" y2="10" stroke="#c99532" stroke-width="2" stroke-linecap="round" />
    <line x1="20" y1="10" x2="130" y2="10" stroke="#c99532" stroke-width="2" stroke-linecap="round" />
  </g>

  <!-- Subtitle: ملابس حريمي وأطفال -->
  <g transform="translate(256, 388)" text-anchor="middle">
    <text x="0" y="0" font-family="'Tajawal', 'Cairo', 'Segoe UI', sans-serif" font-weight="800" font-size="25" fill="#242424" letter-spacing="0.5">
      ملابس حريمي وأطفال
    </text>
  </g>

  <!-- Bottom Hanger Accent with Heart -->
  <g transform="translate(256, 420)">
    <line x1="-60" y1="18" x2="-25" y2="18" stroke="#ba8c46" stroke-width="2" stroke-linecap="round" />
    <line x1="25" y1="18" x2="60" y2="18" stroke="#ba8c46" stroke-width="2" stroke-linecap="round" />
    <!-- Mini Hanger -->
    <path d="M 0 0 C -4 -10, 4 -16, 8 -9 C 10 -4, 6 0, 0 5 L -20 18 L 20 18 Z" fill="none" stroke="#ba8c46" stroke-width="2.5" stroke-linejoin="round" />
    <path d="M 0 9 C -1 6, -5 5, -5 8 C -5 11, 0 15, 0 15 C 0 15, 5 11, 5 8 C 5 5, 1 6, 0 9 Z" fill="#e2336e" />
  </g>
</svg>`;

fs.writeFileSync('assets/logo.svg', svg);
try {
  execSync('convert -density 200 assets/logo.svg -background transparent assets/logo.png');
  execSync('cp assets/logo.png public/assets/logo.png 2>/dev/null || true');
  console.log('Successfully generated assets/logo.png');
} catch (e) {
  console.error('Error generating PNG:', e);
}
