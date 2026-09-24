/** Original Sunbird miniature illustrations. Local SVG, no icon font, remote
 * asset request, filter graph or duplicated gradient IDs. Labels remain HTML. */
const artwork = {
  bird: '<path d="M10 38q0-22 25-22 20 0 21 19-2 18-25 18Q9 53 10 38Z" fill="#ec955e"/><path d="M18 32q18-5 21 14-16 7-21-14Z" fill="#ffd099"/><path d="m52 29 10 5-10 4" fill="#ffd169"/><circle cx="47" cy="27" r="2.5" fill="#3d4739" stroke="none"/><path d="m13 37-10-7 4 17 9-2" fill="#dc7a4e"/><path d="m25 53-3 6m15-6 2 6" fill="none"/>',
  trail: '<path d="M6 43q9-24 26-12t26-13" fill="none" stroke="#96bba5" stroke-width="10"/><path d="M6 51q9-24 26-12t26-13" fill="none" stroke="#dbad78" stroke-width="5"/><path d="m45 7 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#ffdc83"/>',
  boost: '<path d="M19 6h26v9l-4 4v7l10 17q6 13-9 14H22Q8 56 14 43l10-17v-7l-5-4Z" fill="#dae5cd"/><path d="M18 39h29l4 8q2 7-10 7H23q-12 0-8-7Z" fill="#8cb99a"/><path d="m35 24-11 15h8l-3 12 12-18h-9Z" fill="#ffda7a"/><path d="M20 6h24v8H20Z" fill="#bd9670"/>',
  share: '<path d="M11 29v24h42V29" fill="#dce8d3"/><path d="M32 39V8m-12 12L32 8l12 12" fill="none" stroke="#bf794c" stroke-width="5"/><path d="M17 47h30" fill="none" stroke="#afc7ae"/>',
  flight: '<path d="M9 39 52 13 38 55l-9-18Z" fill="#ffe4a3"/><path d="m9 39 20-2 9 18 3-27Z" fill="#ed974a"/><path d="m29 37 23-24" fill="none"/><path d="m10 51 7-7m1 12 6-6" stroke="#eaaa5d"/>',
  online: '<path d="M10 48h44l-6-13H17Z" fill="#479583"/><path d="M17 35h31l-7-8-9 4-8-4Z" fill="#a9d2aa"/><path d="M32 31V10m1 0h16l-4 7 4 7H33" fill="#fcb766"/><path d="M13 19a8 8 0 0 1 8-8M8 18A13 13 0 0 1 20 5" fill="none" stroke="#68afa1"/><path d="m20 46 10-6 7 5" fill="none" stroke="#d1eac5"/>',
  versus: '<path d="m11 13 24 26-7 7L5 19Z" fill="#ffb372"/><path d="m53 13-24 26 7 7 23-27Z" fill="#8fbce3"/><path d="m12 48 8-8m-7-6 14 14m25 0-8-8m7-6L37 48" fill="none" stroke-width="5"/><path d="m32 7 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#ffda75"/>',
  compass: '<circle cx="32" cy="34" r="23" fill="#dfbb8f"/><circle cx="32" cy="31" r="23" fill="#fff0c9"/><circle cx="32" cy="31" r="17" fill="#deead9"/><path d="m41 20-5 16-15 6 5-16Z" fill="#e87853"/><path d="m26 26 10 10-15 6Z" fill="#fff9e5"/><path d="M32 10v3m0 36v3M11 31h3m36 0h3" fill="none"/><circle cx="32" cy="31" r="3" fill="#fff9e5"/>',
  endless: '<path d="M5 43c9-9 14-8 25 1s18 5 29-2" fill="none" stroke="#a9c7b2" stroke-width="5"/><path d="M31 23C14 2-3 26 12 36c14 10 26-30 39-20 16 13-3 35-20 7Z" fill="none" stroke="#a292cf" stroke-width="11"/><path d="M31 23C14 2-3 26 12 36c14 10 26-30 39-20 16 13-3 35-20 7Z" fill="none" stroke="#e2d5f4" stroke-width="5"/>',
  shop: '<path d="M14 26h36v29H14Z" fill="#f1c285"/><path d="M12 11h40l7 17H5Z" fill="#fc9571"/><path d="m22 11-3 17m23-17 3 17" stroke="#fff1d1" stroke-width="6"/><path d="M5 28q7 9 14 0 7 9 13 0 7 9 13 0 7 9 14 0" fill="#ffe0a3"/><path d="M29 55V38h12v17" fill="#589587"/><path d="M19 36h6v8h-6Z" fill="#fff2d0"/>',
  squad: '<path d="M6 47c0-12 9-18 16-13 9 5 7 18-1 20S6 55 6 47Z" fill="#efac6b"/><path d="M37 44c0-12 9-18 16-13 9 5 7 18-1 20s-15 1-15-7Z" fill="#8dbfb0"/><path d="m25 39 7 3-7 3m30-9 6 3-6 3" fill="#e79f49"/><circle cx="20" cy="40" r="1.6" fill="#3c4438" stroke="none"/><circle cx="50" cy="37" r="1.6" fill="#3c4438" stroke="none"/><path d="M21 6h25a7 7 0 0 1 7 7v5a7 7 0 0 1-7 7H33l-8 6v-6h-4a7 7 0 0 1-7-7v-5a7 7 0 0 1 7-7Z" fill="#fff1cc"/><path d="m25 15 5 5 10-10" fill="none" stroke="#549682"/>',
  settings: '<path d="m27 6 10 0 2 8 8 5 8-2 5 9-6 6v9l5 6-5 9-9-3-8 5-2 6H25l-2-7-8-5-8 2-5-9 6-6v-9l-5-6 5-9 8 2 8-5Z" transform="translate(3 -2) scale(.9)" fill="#9bb7b0"/><circle cx="32" cy="31" r="13" fill="#f7e6c6"/><circle cx="32" cy="31" r="6" fill="#d8b386"/>',
  challenge: '<path d="M15 12h34v43H15Z" fill="#edc18d"/><path d="M11 8h34v43H11Z" fill="#fff2d3"/><path d="M23 6h13v7H23Z" fill="#a6beb0"/><path d="m18 24 3 3 5-6m-8 15 3 3 5-6" fill="none" stroke="#5a9c83"/><path d="M31 24h7m-7 12h7" fill="none" stroke="#bba88a"/><path d="m47 36 4 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z" fill="#ffcb63"/>',
  progress: '<path d="M12 43v12h13V43m-1-11v23h14V32m-1-13v36h14V19" fill="#a4c7ac"/><path d="m9 30 16-14 10 5L52 6m-11 0h11v11" fill="none" stroke="#d39b43" stroke-width="4"/>',
  trophy: '<path d="M17 13H7v8q0 13 15 13m25-21h10v8q0 13-15 13" fill="none" stroke="#c89346" stroke-width="4"/><path d="M17 8h30v17q0 16-15 16T17 25Z" fill="#ffd072"/><path d="M24 11v14q0 6 4 8" fill="none" stroke="#fff1bd" stroke-width="4"/><path d="M29 41h6v10h11v7H18v-7h11Z" fill="#b9874b"/><path d="m32 15 3 6 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z" fill="#fff1bd" stroke-width="1.5"/>',
  story: '<path d="m7 13 16-5 18 6 16-5v42l-16 5-18-6-16 5Z" fill="#fff0cb"/><path d="m23 8 0 42m18-36v42" fill="none" stroke="#d2bd96"/><path d="m12 42 9-14 9 9 12-16 9 8" fill="none" stroke="#79aa93" stroke-width="3"/><path d="M44 17a7 7 0 1 0-14 0c0 6 7 12 7 12s7-6 7-12Z" fill="#e98964"/><circle cx="37" cy="16" r="2" fill="#ffeac0" stroke="none"/>',
  rank: '<path d="m12 20 10 9 10-15 10 15 10-9-4 25H16Z" fill="#ffd17e"/><path d="M16 45h32v9H16Z" fill="#c59a5a"/><circle cx="12" cy="17" r="4" fill="#e99467"/><circle cx="32" cy="10" r="4" fill="#e99467"/><circle cx="52" cy="17" r="4" fill="#e99467"/><path d="m32 29 5 7-5 7-5-7Z" fill="#83b7a7"/>',
  pass: '<path d="M8 15h48v11a6 6 0 0 0 0 12v11H8V38a6 6 0 0 0 0-12Z" fill="#b9abcf"/><path d="M42 17v29" fill="none" stroke="#f3e8d7" stroke-dasharray="3 4"/><path d="m25 21 4 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z" fill="#ffdc8c"/>',
  medal: '<path d="m15 6 5 24 13 3-5-27Z" fill="#e69071"/><path d="m49 6-5 24-13 3 5-27Z" fill="#83b5b1"/><circle cx="32" cy="41" r="18" fill="#d8a458"/><circle cx="32" cy="39" r="18" fill="#ffdb86"/><circle cx="32" cy="39" r="12" fill="none" stroke="#e7b55d"/><path d="m32 29 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#fff4cd" stroke-width="1.5"/>',
  atlas: '<path d="M5 48h54L46 21 34 39 23 14Z" fill="#72a28c"/><path d="m23 14-8 16 8-3 7 7Z" fill="#f5ead0"/><path d="m46 21-6 11 6-3 7 8Z" fill="#d2e4cd"/><path d="M4 49q13-6 28 0t28 0v8H4Z" fill="#9bbec1"/><circle cx="44" cy="12" r="7" fill="#ffd583" stroke="none"/>',
  scores: '<path d="M14 8h31l9 10v39H14Z" fill="#ead3a4"/><path d="M9 5h30l10 10v38H9Z" fill="#fff1cf"/><path d="M39 5v11h10" fill="#d5c4a0"/><path d="M17 43V32h6v11m4 0V24h6v19m4 0V30h6v13" fill="#87b59f" stroke-width="1.5"/><path d="M17 16h13" fill="none" stroke="#b39c7b"/>',
  board: '<path d="M5 33h18v23H5Zm18-15h18v38H23Zm18 23h18v15H41Z" fill="#a1bdb5"/><path d="M23 18h18v38H23Z" fill="#efc278"/><path d="m32 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#ffdf90"/><path d="M30 30h3v13" fill="none" stroke="#9b743c" stroke-width="3"/>',
  account: '<rect x="7" y="12" width="50" height="41" rx="8" fill="#f2d7a9"/><path d="M10 17h44" fill="none" stroke="#fff2d2"/><circle cx="25" cy="28" r="7" fill="#a2bfa8"/><path d="M13 45q1-11 12-11t12 11" fill="#78a992"/><path d="M41 28h8m-8 7h8m-8 7h5" fill="none" stroke="#b4966e"/>',
  daily: '<circle cx="32" cy="32" r="13" fill="#ffd86b"/><path d="M32 8v7m0 34v7M8 32h7m34 0h7m-10-17-5 5M19 45l-5 5m0-34 5 5m17 17 5 5" fill="none" stroke="#f5a623" stroke-width="4" stroke-linecap="round"/><path d="M5 52h54" fill="none" stroke="#ed974a" stroke-width="3" stroke-linecap="round"/>',
  sound: '<path d="M9 27h12l15-12v34L21 37H9Z" fill="#a8c8bc"/><path d="M43 24q7 8 0 16m5-23q13 15 0 30" fill="none" stroke="#d18d4d" stroke-width="4"/>',
  soundOff: '<path d="M9 27h12l15-12v34L21 37H9Z" fill="#a8c8bc"/><path d="m43 25 12 12m0-12-12 12" fill="none" stroke="#d46f55" stroke-width="4"/>',
  fullscreen: '<path d="M8 25V10h15M41 10h15v15M56 39v15H41M23 54H8V39" fill="none" stroke="#799b91" stroke-width="5"/><path d="M15 17 6 8m43 0-9 9M6 56l9-9m34 9-9-9" fill="none" stroke="#d59a4c" stroke-width="3"/>',
} as const;

export type MenuIconName = keyof typeof artwork;
export function menuIcon(name: MenuIconName): string {
  return `<svg class="menu-illustration" viewBox="0 0 64 64" fill="none" stroke="#695541" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${artwork[name]}</svg>`;
}

/** Crisp vector arrows for menu chrome.
 *
 * Text arrows (→, ↗) render from the device font, which on phones means
 * emoji-styled glyphs or missing-glyph boxes depending on the installed
 * font set — the menu's "arrows" read as emoji. An inline SVG stroke draws
 * identically everywhere and inherits `currentColor` from the CSS. */
export function arrowUpRightSvg(): string {
  return '<svg class="arrow-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 17 17 7"/><path d="M9 7h8v8"/></svg>';
}
export function arrowRightSvg(): string {
  return '<svg class="arrow-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></svg>';
}

/** A quiet illustrated horizon, not another animated particle layer. */
export function menuHorizon(): string {
  return '<svg class="menu-horizon" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 141Q65 83 145 125T300 117T456 115T600 85V200H0Z" fill="#ced8ba"/><path d="M0 163Q85 108 180 153T366 143T600 138V200H0Z" fill="#a2be9f"/><path d="M0 184Q90 160 190 181T400 171T600 180V200H0Z" fill="#749d87"/><path d="M0 179Q96 155 195 177T400 167T600 176" fill="none" stroke="#eaf0d2" stroke-width="2" opacity=".65"/></svg>';
}
