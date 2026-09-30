/**
 * Small inline icons (20×20 viewBox). Used anywhere an emoji would otherwise
 * appear — powerup bar, mode buttons, event/chapter headers, wings pill, etc.
 * Palette follows the game's warm earthy tones so they integrate naturally.
 */
const smArtwork = {
  // ── nature / sky ───────────────────────────────────────────────────────────
  sun:        '<circle cx="10" cy="10" r="4" fill="#ffd86b"/><path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5.3 5.3l1.1 1.1M12.6 12.6l1.1 1.1M5.3 14.7l1.1-1.1M12.6 7.4l1.1-1.1" stroke="#f5a623" stroke-width="1.5" stroke-linecap="round"/>',
  moon:       '<path d="M14 10a5 5 0 1 1-5-5 3.5 3.5 0 0 0 5 5Z" fill="#fff0c9" stroke="#f5a623" stroke-width=".8"/>',
  star:       '<path d="M10 3l1.5 3.4H15l-2.7 2 1 3.6L10 10.5l-3.3 1.5 1-3.6L5 6.4h3.5Z" fill="#ffd86b"/>',
  cloud:      '<path d="M5.5 14a3 3 0 0 1 .5-6 3.5 3.5 0 0 1 6.5 1 2.5 2.5 0 0 1 .5 5Z" fill="#c8e8ff"/>',
  aurora:     '<path d="M2 13q3-7 8-3t8-6" fill="none" stroke="#a292cf" stroke-width="2.2" stroke-linecap="round"/><path d="M2 10.5q3-6 8-2t8-4" fill="none" stroke="#e2d5f4" stroke-width="1.5" stroke-linecap="round"/>',
  leaf:       '<path d="M16 4C5 4 3 14 3 17q3-2 5-5-1 4 4 7C11 9 16 4 16 4Z" fill="#72a28c"/>',
  snowflake:  '<path d="M10 3v14M4.1 6.5l11.8 7M4.1 13.5l11.8-7" stroke="#c8e8ff" stroke-width="1.6" stroke-linecap="round"/><path d="M7.5 4l2.5 1.5L12.5 4M4 9.5l1.5 2L4 13.5M16 9.5l-1.5 2L16 13.5M7.5 16l2.5-1.5L12.5 16" stroke="#c8e8ff" stroke-width="1.1" stroke-linecap="round"/>',
  half_day:   '<path d="M4.5 13a5.5 5.5 0 0 1 11 0Z" fill="#ffd86b"/><path d="M2 13h16" stroke="#f5a623" stroke-width="1.5" stroke-linecap="round"/>',
  fire:       '<path d="M10 18c-4 0-6.5-3.5-5-7 0 0 1 2 2 2C6 9 9 4 10 4c0 2 2.5 3.5 3 6 1-1 1-2 1-3 2 2 2 4.5 1 7 1 0 2-1 2-2 0 2.5-2 6-7 6Z" fill="#ed974a"/>',
  // ── objects / items ────────────────────────────────────────────────────────
  coin:       '<circle cx="10" cy="10" r="7" fill="#ffd86b"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="#f5a623" stroke-width="1.3"/>',
  gem:        '<path d="M10 3L4.5 8.5l5.5 8.5 5.5-8.5Z" fill="#8dbfb0"/><path d="M4.5 8.5h11" stroke="white" stroke-width=".9"/><path d="M7 8.5L10 3l3 5.5" fill="#a9d2aa"/>',
  crystal:    '<path d="M10 2L5.5 7l4.5 11 4.5-11Z" fill="#a292cf"/><path d="M5.5 7h9M7.5 7L10 2l2.5 5" stroke="#e2d5f4" stroke-width=".9"/>',
  crown:      '<path d="M3 14.5l1.5-8 3 4 2.5-7 2.5 7 3-4 1.5 8Z" fill="#ffd86b"/><rect x="3" y="14.5" width="14" height="2.5" rx=".5" fill="#f5a623"/>',
  shield:     '<path d="M10 2.5L3 6v5Q3 16.5 10 18 17 16.5 17 11V6Z" fill="#5ad8ff"/><path d="M6.5 8.5l3 3.5 4.5-5" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  feather:    '<path d="M5.5 17C4 8 15.5 2 17 4c-3.5 1-4.5 3.5-5.5 6.5l4-4.5-1.5 2L11 11.5l2-1.5L8.5 17" fill="none" stroke="#d2bd96" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  rocket:     '<path d="M10 2c-2 4-2 8-2 10l2 5 2-5c0-2 0-6-2-10Z" fill="#ed974a"/><path d="M7 12l-2 4h10l-2-4" fill="#e87853"/><circle cx="10" cy="8" r="1.3" fill="#fff0c9" stroke="none"/>',
  comet:      '<circle cx="13.5" cy="6.5" r="3" fill="#ffd86b"/><path d="M10.7 9.3l-7 7M9.3 11l-5 5.5" stroke="#f5a623" stroke-width="1.6" stroke-linecap="round"/>',
  magnet:     '<path d="M5 5.5h3v6a2 2 0 0 0 4 0v-6h3" fill="none" stroke="#a292cf" stroke-width="2.5" stroke-linecap="round"/><path d="M5 5.5v3.5M15 5.5v3.5" stroke="#7a70d0" stroke-width="2.5" stroke-linecap="round"/>',
  badge:      '<path d="M10 2l2 4h4.5l-3.7 2.7 1.4 4.3L10 10.5l-4.2 2.5 1.4-4.3L3.5 6H8Z" fill="#ffd86b"/><path d="M7 12l-1.5 5.5 4.5-2.5 4.5 2.5L13 12" fill="#f5a623"/>',
  dice:       '<rect x="2.5" y="2.5" width="15" height="15" rx="2.5" fill="#a4c7ac"/><circle cx="7" cy="7" r="1.3" fill="white"/><circle cx="13" cy="7" r="1.3" fill="white"/><circle cx="7" cy="13" r="1.3" fill="white"/><circle cx="13" cy="13" r="1.3" fill="white"/><circle cx="10" cy="10" r="1.3" fill="white"/>',
  trophy:     '<path d="M6.5 4h7v5.5Q13.5 14 10 14T6.5 9.5Z" fill="#ffd86b"/><path d="M5 4H3v3q0 4 3.5 4M15 4h2v3q0 4-3.5 4" fill="none" stroke="#f5a623" stroke-width="1.5"/><path d="M8.5 14h3v3h3.5v2H5V17h3.5Z" fill="#b9874b"/>',
  rainbow:    '<path d="M3.5 16.5a6.5 6.5 0 0 1 13 0" fill="none" stroke="#e87853" stroke-width="2.5"/><path d="M5.5 16.5a4.5 4.5 0 0 1 9 0" fill="none" stroke="#ffd86b" stroke-width="2"/><path d="M7.5 16.5a2.5 2.5 0 0 1 5 0" fill="none" stroke="#72a28c" stroke-width="1.5"/>',
  // ── navigation / symbols ───────────────────────────────────────────────────
  swords:     '<path d="M5 5l10 10M15 5L5 15" stroke="#9bb7b0" stroke-width="2.5" stroke-linecap="round"/><path d="M5 5l2.5.5-.5-2.5M15 5l-2.5.5.5-2.5M5 15l2.5-.5-.5 2.5M15 15l-2.5-.5.5 2.5" fill="#9bb7b0" stroke="none"/>',
  flag:       '<path d="M5 2.5v15" stroke="#695541" stroke-width="1.8" stroke-linecap="round"/><rect x="5" y="2.5" width="12" height="8" fill="#f1c285"/><rect x="5" y="2.5" width="4" height="4" fill="#695541" opacity=".65"/><rect x="9" y="6.5" width="4" height="4" fill="#695541" opacity=".65"/><rect x="13" y="2.5" width="4" height="4" fill="#695541" opacity=".65"/>',
  lightning:  '<path d="M13 2L7 10.5h5.5L6 18l10.5-9.5H11Z" fill="#ffd86b"/>',
  infinity:   '<path d="M13.5 8.5a1.5 1.5 0 0 1 0 3 4.5 4.5 0 0 1-3.5-1.5 4.5 4.5 0 0 1-3.5 1.5 1.5 1.5 0 0 1 0-3 4.5 4.5 0 0 1 3.5 1.5A4.5 4.5 0 0 1 13.5 8.5Z" fill="none" stroke="#a292cf" stroke-width="2.5" stroke-linecap="round"/>',
  target:     '<circle cx="10" cy="10" r="7.5" fill="none" stroke="#ed974a" stroke-width="1.5"/><circle cx="10" cy="10" r="4.5" fill="none" stroke="#ed974a" stroke-width="1.5"/><circle cx="10" cy="10" r="1.5" fill="#ed974a"/>',
  spiral:     '<path d="M10 10a2 2 0 0 0 0 3.5 4 4 0 0 0 0-6.5 6 6 0 0 0 0 9 8 8 0 1 1-2-15" fill="none" stroke="#a292cf" stroke-width="2" stroke-linecap="round"/>',
  // ── geography ──────────────────────────────────────────────────────────────
  mountain:   '<path d="M10 3L2.5 17h15Z" fill="#9bb7b0"/><path d="M10 3L7 11.5l3-2 3 2L10 3Z" fill="white" opacity=".3"/>',
  volcano:    '<path d="M10 3L2.5 17h15Z" fill="#b9874b"/><path d="M8 3.5C7 2 6 3.5 6 3.5s2-2.5 4 0c2-2.5 4 0 4 0s-1.5-1.5-2 0" fill="#ed974a"/>',
  island:     '<ellipse cx="10" cy="16" rx="7" ry="2" fill="#5ad8ff" opacity=".8"/><path d="M10 15.5V8.5" stroke="#b9874b" stroke-width="1.8" stroke-linecap="round"/><path d="M10 8.5C9 4.5 5.5 5.5 5.5 5.5s3 4 4.5 3" fill="#72a28c"/><path d="M10 8.5c1-4 4.5-3 4.5-3s-3 4-4.5 3" fill="#72a28c" opacity=".8"/>',
  dunes:      '<path d="M1.5 17q3-7.5 5-5t4-3.5 5.5 8.5Z" fill="#f1c285"/><path d="M5.5 17q2-6 4-3.5t4-1.5 5 5Z" fill="#e8b86d" opacity=".7"/>',
  buildings:  '<path d="M2.5 17V9h3.5v8M6 17V6h4v11M10 17V11h3v6M13 17V8h4v9" fill="#a4c7ac"/><path d="M2.5 17h15" stroke="#72a28c" stroke-width="1.2"/>',
  shell:      '<path d="M10 4.5a5.5 5.5 0 0 1 5.5 5.5 4.5 4.5 0 0 1-4.5 4.5 3.5 3.5 0 0 1-3.5-3.5 2.5 2.5 0 0 1 2.5-2.5 2 2 0 0 1 2 2" fill="none" stroke="#b9874b" stroke-width="2" stroke-linecap="round"/>',
  // ── creatures ──────────────────────────────────────────────────────────────
  bird:       '<path d="M3 10q3.5-7 7 0t7 0" fill="none" stroke="#ed974a" stroke-width="2.8" stroke-linecap="round"/><path d="M10 10q0 3.5 1 5" fill="none" stroke="#ed974a" stroke-width="1.5" stroke-linecap="round"/>',
  ghost:      '<path d="M10 3a5.5 5.5 0 0 0-5.5 5.5V17l2 1.5 1.8-1.5 1.7 1.5 1.8-1.5L13.5 18.5 15.5 17V8.5A5.5 5.5 0 0 0 10 3Z" fill="#eef2f5"/><circle cx="8" cy="8.5" r="1.1" fill="#3d4739"/><circle cx="12" cy="8.5" r="1.1" fill="#3d4739"/>',
  flock:      '<path d="M2 9q2-3.5 3.5 0t3.5 0M9 6.5q2.5-4 4 0t4 0M5 13q2-3.5 3.5 0t3.5 0" fill="none" stroke="#ed974a" stroke-width="1.8" stroke-linecap="round"/>',
  egg:        '<ellipse cx="10" cy="11" rx="5.5" ry="7" fill="#ffd86b"/><ellipse cx="10" cy="11" rx="3.5" ry="5" fill="none" stroke="#f5a623" stroke-width=".9" opacity=".5"/>',
  eagle:      '<path d="M2 10.5q4.5-5.5 8-2t8 2" fill="#9bb7b0"/><path d="M10 8.5v7M7.5 13l-5.5 4M12.5 13l5.5 4" stroke="#695541" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  // ── wing types ─────────────────────────────────────────────────────────────
  glide:      '<path d="M2 14q5.5-10 13-9-3 4.5-5.5 6l5.5-1.5q-2.5 4-6 5.5Q6 15.5 2 14Z" fill="#72a28c"/>',
  wing:       '<path d="M2.5 13q5-9.5 11.5-8.5-3 4.5-5 5.5l5-1q-2.5 3.5-5.5 5.5Q5.5 14.5 2.5 13Z" fill="#a4c7ac"/>',
  weight:     '<rect x="7" y="10" width="6" height="7" rx="1" fill="#9bb7b0"/><path d="M5.5 8.5h9l-1 1.5H6.5Z" fill="#a4c7ac"/><path d="M10 2.5v6M8.5 4l1.5-1.5L11.5 4" stroke="#9bb7b0" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  paper_wing: '<path d="M2 14.5L10 2.5l8 12-8-3Z" fill="#f1c285"/><path d="M10 2.5L2 14.5l8-3 8 3L10 2.5Z" fill="none" stroke="#d2bd96" stroke-width=".9"/><path d="M10 11.5v4.5" stroke="#d2bd96" stroke-width=".9"/>',
  // ── weather / air ──────────────────────────────────────────────────────────
  wind:       '<path d="M2 6.5h9a2.5 2.5 0 1 0-2.5-2.5" fill="none" stroke="#5ad8ff" stroke-width="1.8" stroke-linecap="round"/><path d="M2 10.5h13a2.5 2.5 0 1 1-2.5 2.5" fill="none" stroke="#8dbfb0" stroke-width="1.8" stroke-linecap="round"/><path d="M2 14.5h7" stroke="#c8e8ff" stroke-width="1.8" stroke-linecap="round"/>',
  thermal:    '<path d="M6 17.5c-1.5-2 0-3.5 0-5.5S4.5 8 4.5 6" stroke="#ed974a" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M10 17.5c-1.5-2 0-3.5 0-5.5S8.5 8 8.5 6" stroke="#ffd86b" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M14 17.5c-1.5-2 0-3.5 0-5.5S12.5 8 12.5 6" stroke="#f5a623" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  storm:      '<path d="M5.5 12.5a3 3 0 0 1 .5-6 3.5 3.5 0 0 1 6.5 1 2.5 2.5 0 0 1 .5 5Z" fill="#9bb7b0"/><path d="M10.8 11.5l-3 4h2.5l-1.5 3 4-4.5h-2.5Z" fill="#ffd86b"/>',
  ash_storm:  '<path d="M5.5 13a3 3 0 0 1 .5-6 3.5 3.5 0 0 1 6.5 1 2.5 2.5 0 0 1 .5 5Z" fill="#9bb7b0"/><path d="M6 15.5l-1 2M10 15.5l-1 2M14 15.5l-1 2" stroke="#695541" stroke-width="1.3" stroke-linecap="round"/>',
  sparkle:    '<path d="M9 2.5l1.7 4.3L15 8.5l-4.3 1.7L9 14.5l-1.7-4.3L3 8.5l4.3-1.7Z" fill="#ffd86b"/><path d="M15.2 12.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" fill="#fff0c9"/>',
  // ── rewards ────────────────────────────────────────────────────────────────
  gift:       '<rect x="2.5" y="8.5" width="15" height="9" rx="1.2" fill="#e87853"/><rect x="2" y="5.8" width="16" height="3.4" rx="1" fill="#f1c285"/><path d="M10 5.8v11.7" stroke="#ffd86b" stroke-width="1.8"/><path d="M10 5.8C8.4 2.2 5.4 2.8 6.4 4.7 7 5.8 9 5.8 10 5.8Zm0 0c1.6-3.6 4.6-3 3.6-1.1-.6 1.1-2.6 1.1-3.6 1.1Z" fill="#ffd86b" stroke="none"/>',
  hammer:     '<path d="M3.5 8.5l4-4 5.5 5.5-4 4Z" fill="#9bb7b0"/><path d="M9 13.5l4.5 4.5" stroke="#b9874b" stroke-width="2.6" stroke-linecap="round"/><path d="M3.5 8.5L2 10l5 5 1.5-1.5Z" fill="#d2bd96"/>',
  medal:      '<path d="M6 2l2.5 6M14 2l-2.5 6" stroke="#e87853" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="12.5" r="5.5" fill="#d8a458"/><circle cx="10" cy="12" r="5.5" fill="#ffdb86"/><path d="m10 8.5 1 2.2 2.4.3-1.8 1.7.5 2.4L10 14l-2.1 1.1.5-2.4-1.8-1.7 2.4-.3Z" fill="#fff4cd" stroke="none"/>',
  medal_1:    '<path d="M6 2l2.5 6M14 2l-2.5 6" stroke="#e87853" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="12.5" r="5.5" fill="#d8a458"/><circle cx="10" cy="12" r="5.5" fill="#ffd86b"/><path d="m10 8.5 1 2.2 2.4.3-1.8 1.7.5 2.4L10 14l-2.1 1.1.5-2.4-1.8-1.7 2.4-.3Z" fill="#fff4cd" stroke="none"/>',
  medal_2:    '<path d="M6 2l2.5 6M14 2l-2.5 6" stroke="#8dbfb0" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="12.5" r="5.5" fill="#93a3ab"/><circle cx="10" cy="12" r="5.5" fill="#dfe8ec"/><path d="m10 8.5 1 2.2 2.4.3-1.8 1.7.5 2.4L10 14l-2.1 1.1.5-2.4-1.8-1.7 2.4-.3Z" fill="#ffffff" stroke="none"/>',
  medal_3:    '<path d="M6 2l2.5 6M14 2l-2.5 6" stroke="#b9874b" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="12.5" r="5.5" fill="#96552a"/><circle cx="10" cy="12" r="5.5" fill="#d99b5c"/><path d="m10 8.5 1 2.2 2.4.3-1.8 1.7.5 2.4L10 14l-2.1 1.1.5-2.4-1.8-1.7 2.4-.3Z" fill="#ffe6c4" stroke="none"/>',
  calendar:   '<rect x="2.5" y="4" width="15" height="13.5" rx="1.8" fill="#f1c285"/><rect x="2.5" y="4" width="15" height="4" rx="1.6" fill="#e87853"/><path d="M6.5 2v3.5M13.5 2v3.5" stroke="#695541" stroke-width="1.7" stroke-linecap="round"/><path d="M6 12h2M9.5 12h2M13 12h1.5M6 15h2M9.5 15h2" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  // ── people & social ────────────────────────────────────────────────────────
  chat:       '<path d="M3 4.5h14a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H8l-4 3.5v-3.5H3A1.5 1.5 0 0 1 1.5 13V6A1.5 1.5 0 0 1 3 4.5Z" fill="#a292cf"/><circle cx="7" cy="9.5" r="1.1" fill="#fff"/><circle cx="10" cy="9.5" r="1.1" fill="#fff"/><circle cx="13" cy="9.5" r="1.1" fill="#fff"/>',
  handshake:  '<path d="M2.5 12l3-3.5 3 2.5-1.5 3-3-1Z" fill="#a4c7ac"/><path d="M17.5 12l-3-3.5-3 2.5 1.5 3 3-1Z" fill="#72a28c"/><path d="M8.5 11h3" stroke="#695541" stroke-width="1.5" stroke-linecap="round"/>',
  wave:       '<path d="M6.5 17.5V10.5L5 8.8a1.3 1.3 0 0 1 1.9-1.8L8 8V3.5a1.25 1.25 0 0 1 2.5 0V8l.8-.4a1.25 1.25 0 0 1 1.6 1.4l-1 3.6a5.3 5.3 0 0 1-5.4 4.9Z" fill="#ffd099"/><path d="M14.5 4q1.5 1.2 1.8 3" stroke="#f5a623" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
  laugh:      '<circle cx="10" cy="10" r="7.5" fill="#ffd86b"/><circle cx="7" cy="8.5" r="1.1" fill="#695541" stroke="none"/><circle cx="13" cy="8.5" r="1.1" fill="#695541" stroke="none"/><path d="M5.5 11.5h9a4.8 4.8 0 0 1-9 0Z" fill="#695541" stroke="none"/><path d="M2.2 6.6q1.5 1.7.5 3M17.8 6.6q-1.5 1.7-.5 3" stroke="#f5a623" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
  bravo:      '<path d="M2.5 17c0-2.6.9-4.4 1.8-5.8l1.6 2.1V5.6a1.1 1.1 0 0 1 2.2 0v5.2a1.1 1.1 0 0 0 2.2 0V6.4a1.1 1.1 0 0 1 2.2 0v6.8a3.8 3.8 0 0 1-3.8 3.8Z" fill="#ffd099"/><path d="M17.5 17c0-2.6-.9-4.4-1.8-5.8l-1.6 2.1V6.4a1.1 1.1 0 0 0-2.2 0" fill="none" stroke="#f5a623" stroke-width="1.1" opacity=".7" stroke-linecap="round"/>',
  hand:       '<path d="M7 17.5V10L5 7.8a1.4 1.4 0 0 1 2-2l2 2V3.5a1.3 1.3 0 0 1 2.6 0v4l.6-.4a1.3 1.3 0 0 1 1.8 1.4l-1 4.2A5.6 5.6 0 0 1 7 17.5Z" fill="#ed974a"/><path d="M7 12h6" stroke="#f5a623" stroke-width=".9" fill="none"/>',
  robot:      '<rect x="3.5" y="6.5" width="13" height="10" rx="2.5" fill="#c8e8ff"/><path d="M10 3v3.5M1.5 11.5H3M17 11.5h1.5" stroke="#5ad8ff" stroke-width="1.5" stroke-linecap="round"/><circle cx="7.5" cy="11" r="1.4" fill="#3d4739" stroke="none"/><circle cx="12.5" cy="11" r="1.4" fill="#3d4739" stroke="none"/><path d="M7.5 14.2h5" stroke="#5ad8ff" stroke-width="1.3" stroke-linecap="round"/>',
  // ── mail / data / storage ──────────────────────────────────────────────────
  mail_in:    '<rect x="2" y="4" width="16" height="12" rx="1.5" fill="#f1c285"/><path d="M2.5 5.6L10 11l7.5-5.4" fill="none" stroke="#b9874b" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
  mail_out:   '<rect x="2" y="7" width="12.5" height="10" rx="1.5" fill="#a4c7ac"/><path d="M12.5 3.5h4.5M15.5 1.5l2 2-2 2" fill="none" stroke="#72a28c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  save:       '<path d="M2.5 4.5h11l4 4V16a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" fill="#9bb7b0"/><rect x="6" y="4.5" width="7" height="4" fill="#eef2f5"/><rect x="5.5" y="11" width="9" height="5" rx="1" fill="#f7e6c6"/>',
  globe:      '<circle cx="10" cy="10" r="7.5" fill="#5ad8ff"/><ellipse cx="10" cy="10" rx="3.4" ry="7.5" fill="none" stroke="#fff" stroke-width="1.1"/><path d="M2.5 10h15" stroke="#fff" stroke-width="1.1"/>',
  // ── tools / measures ───────────────────────────────────────────────────────
  ruler:      '<path d="M3 3.5V15a1.5 1.5 0 0 0 1.5 1.5H16Z" fill="#c8e8ff" stroke="#5a9c83" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 13l2.5-3M10 13l2.5-3M13 13l2.5-3" stroke="#5a9c83" stroke-width="1.1" stroke-linecap="round"/>',
  search:     '<circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="#9bb7b0" stroke-width="2"/><path d="M12.5 12.5l4.5 4.5" stroke="#ed974a" stroke-width="2.4" stroke-linecap="round"/>',
  lock:       '<rect x="4" y="9" width="12" height="8.5" rx="1.8" fill="#ffd86b"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" fill="none" stroke="#b9874b" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.2" r="1.3" fill="#695541" stroke="none"/>',
  boxing:     '<path d="M4.5 12c0-2.5 1.2-4 3-5l2.5-1.5 1.3 1.3 3 1.5c1.6.8 2.2 2.2 1.7 3.8-.6 1.9-2.2 3.2-4.4 3.2H6.5c-1.3 0-2-1-2-3.3Z" fill="#e87853"/><path d="M4.5 12h2.2" stroke="#ffd86b" stroke-width="1.2" fill="none"/>',
  takeoff:    '<path d="M2.5 16.5h15" stroke="#9bb7b0" stroke-width="1.3" stroke-linecap="round"/><path d="M3 12.5l4-3 3.5 1 3-4 1.5 1-2 3.5 3 .5-2 2.5-3.5.5-2.5 2Z" fill="#c8e8ff"/><path d="M5.5 5l2.5 3.5M10 4l2.5 3" stroke="#5ad8ff" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/>',
  // ── social &amp; sharing ─────────────────────────────────────────────────────
  people:     '<circle cx="7" cy="7" r="2.6" fill="#ed974a"/><path d="M2.5 16.5c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2Z" fill="#ed974a"/><circle cx="14" cy="7.8" r="2.2" fill="#5ad8ff"/><path d="M11 16.5c0-2.1 1.7-3.5 3.6-3.5s3.6 1.4 3.6 3.5Z" fill="#5ad8ff"/>',
  link:       '<path d="M7 13l6-6" stroke="#8dbfb0" stroke-width="2.4" stroke-linecap="round"/><path d="M7.8 9.2 6 7.4a2.9 2.9 0 1 1 4.1-4.1l1.6 1.6" fill="none" stroke="#5ad8ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.2 10.8 14 12.6a2.9 2.9 0 1 1-4.1 4.1L8.3 15.1" fill="none" stroke="#5ad8ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  photo:      '<path d="M3 6.5h3l1.5-2h5L14 6.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" fill="#9bb7b0"/><circle cx="10" cy="11.5" r="3.2" fill="#5ad8ff"/><circle cx="10" cy="11.5" r="1.4" fill="#eef2f5"/>',
  clipboard:  '<path d="M7 4.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1H13" fill="#f1c285"/><rect x="7" y="2.5" width="6" height="4" rx="1.2" fill="#b9874b"/><path d="M7 10h6M7 13h4" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>',
  play:       '<circle cx="10" cy="10" r="7.5" fill="#5ad8ff"/><path d="M8 6.5l6 3.5-6 3.5Z" fill="#eef2f5"/>',
  download:   '<path d="M10 2.5v9M6 8l4 4 4-4" fill="none" stroke="#5ad8ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 13.5v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" fill="none" stroke="#8dbfb0" stroke-width="2.2" stroke-linecap="round"/>',
  tv:         '<rect x="2" y="5.5" width="16" height="11" rx="1.8" fill="#3d4739"/><path d="M8.5 8.5l4.5 2.5-4.5 2.5Z" fill="#5ad8ff"/><path d="M7 16.5l-1 2M13 16.5l1 2" stroke="#9bb7b0" stroke-width="1.3" stroke-linecap="round"/>',
  crate:      '<path d="M3 6.5h14v10.5H3Z" fill="#b9874b"/><path d="M3 6.5 5 3.5h10l2 3" fill="#d2bd96"/><path d="M10 3.5v13.5M3 6.5h14" stroke="#695541" stroke-width="1.2" fill="none"/>',
  // ── results &amp; impact ─────────────────────────────────────────────────────
  boom:       '<circle cx="10" cy="10" r="3.2" fill="#e87853"/><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3M4 4l2 2M14 14l2 2M16 4l-2 2M6 14l-2 2" stroke="#f5a623" stroke-width="2" stroke-linecap="round"/>',
  p1:         '<circle cx="10" cy="10" r="7" fill="#ed974a"/><circle cx="10" cy="10" r="3" fill="#fff0c9"/>',
  p2:         '<circle cx="10" cy="10" r="7" fill="#5ad8ff"/><circle cx="10" cy="10" r="3" fill="#eef2f5"/>',
  offline:    '<circle cx="10" cy="10" r="7.5" fill="#9bb7b0"/><path d="M4.2 15.8 15.8 4.2" stroke="#eef2f5" stroke-width="2.4" stroke-linecap="round"/>',
  cosmos:     '<circle cx="10" cy="10" r="7.5" fill="#a292cf"/><ellipse cx="10" cy="10" rx="8" ry="2.8" fill="none" stroke="#e2d5f4" stroke-width="1.5" transform="rotate(-25 10 10)"/><circle cx="14" cy="6.2" r="1.3" fill="#ffd86b" stroke="none"/>',
  tornado:    '<path d="M3 4.5h14M4.5 7.5h11M6 10.5h8M7.5 13.5h5M9 16.5h2" stroke="#c8e8ff" stroke-width="2" stroke-linecap="round" fill="none"/>',
  fullscreen:      '<path d="M7 2.5H4a1.5 1.5 0 0 0-1.5 1.5v3M13 2.5h3A1.5 1.5 0 0 1 17.5 4v3M7 17.5H4A1.5 1.5 0 0 1 2.5 16v-3M13 17.5h3a1.5 1.5 0 0 0 1.5-1.5v-3" fill="none" stroke="#799b91" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  fullscreen_exit: '<path d="M8 2.5v4M2.5 8h4M12 2.5v4M17.5 8h-4M8 17.5v-4M2.5 12h4M12 17.5v-4M17.5 12h-4" fill="none" stroke="#799b91" stroke-width="2" stroke-linecap="round"/>',
  // ── ui chrome ──────────────────────────────────────────────────────────────
  pause:      '<rect x="4.5" y="4" width="4" height="12" rx="1.2" fill="#a4c7ac"/><rect x="11.5" y="4" width="4" height="12" rx="1.2" fill="#a4c7ac"/>',
  check:      '<path d="M3 10l5 5.5 9-10.5" stroke="#72a28c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  question:   '<path d="M7.5 7.5a2.5 2.5 0 0 1 5 .5c0 2-2.5 2.5-2.5 4.5" stroke="#9bb7b0" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="10" cy="15.5" r="1.3" fill="#9bb7b0"/>',
  castle:     '<path d="M4.5 17V8.5h3V7h-3V5H3v3.5h1.5V17M11.5 17V8.5h3V7h-3V5H10v3.5h1.5V17M4.5 17h11M7.5 17v-4.5h5V17" fill="none" stroke="#9bb7b0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  hourglass:  '<path d="M5 3h10M5 17h10" stroke="#a4c7ac" stroke-width="1.5" stroke-linecap="round"/><path d="M5.5 3l4.5 6 4.5-6M5.5 17l4.5-6 4.5 6" fill="#a4c7ac"/>',
  spin:       '<path d="M10 3a7 7 0 1 1-5 2" fill="none" stroke="#ffd86b" stroke-width="2.5" stroke-linecap="round"/><path d="M5 2v3.5H1.5" fill="none" stroke="#ffd86b" stroke-width="2" stroke-linecap="round"/>',
  piggy:      '<ellipse cx="10.5" cy="10.5" rx="7" ry="6" fill="#ffa8e0"/><circle cx="8" cy="9" r="1.2" fill="#fff" opacity=".7"/><path d="M7 13q3 2 6 0" fill="none" stroke="#d07fb0" stroke-width="1.2" stroke-linecap="round"/><path d="M17 8.5l1.5-2" stroke="#d07fb0" stroke-width="1.5" stroke-linecap="round"/>',
} as const;

export type SmIconName = keyof typeof smArtwork;

/** Small inline SVG icon (20×20). Safe to insert as innerHTML — no user data. */
/**
 * Small inline icon for a named icon.
 *
 * It used to return "" for anything it did not recognise, which is how the
 * UI ended up with bare words where an icon belongs. Two call patterns hit
 * that path constantly:
 *
 *  · fields named `emoji` (`w.emoji`, `s.biomeEmoji`, `activeWorld.emoji`)
 *    hold an actual character, not a name — so the lookup missed and the
 *    icon silently vanished, leaving the label alone on the row;
 *  · `s.wings.icon` is already a resolved GLYPH by the time it arrives (see
 *    GrowthLedger), so the same thing happened on the wings pill.
 *
 * An icon slot that renders nothing is worse than one that renders a dot:
 * the layout still reserves the gap, so the text sits adrift from where the
 * grid expects it. That is most of the reported "text overlaps" too.
 *
 * Now it degrades in order: authored artwork, then the text glyph for a
 * known name, then the value itself when it is already a short glyph, and
 * only then a neutral marker. It never returns empty and never emits a
 * bare identifier.
 */
/** Neutral stand-in for an unmapped icon name. A small filled dot reads as
 *  "a marker" in every font that has Geometric Shapes, which is all of them. */
const FALLBACK_GLYPH = "\u25aa";

export function menuIconSm(name: string): string {
  const art = smArtwork[name as SmIconName];
  if (art) {
    return `<svg class="icon-sm" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${art}</svg>`;
  }
  return `<span class="icon-sm icon-sm-glyph" aria-hidden="true">${iconMarkText(name)}</span>`;
}

/**
 * The plain-text mark for a value that may be an icon name, an already
 * resolved glyph, or junk. Shared by menuIconSm and the toast path so both
 * degrade the same way.
 */
export function iconMarkText(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return FALLBACK_GLYPH;
  if (hasIconGlyph(v)) return smGlyph[v as SmIconName];
  // Already a glyph (one or two code points, no ASCII letters) — pass it
  // through rather than replacing a perfectly good symbol with a dot.
  if (![...v].some((c) => /[A-Za-z0-9_]/.test(c)) && [...v].length <= 3) return v;
  return FALLBACK_GLYPH;
}

/** One-character text glyph for a named icon — used in plain-text contexts
 *  (toasts rendered via textContent, aria-label fragments). Glyphs are chosen
 *  from text-presentation code points only (★ ● ◆ ▲ ↯); emoji-presentation
 *  characters are never used here so toasts read identically on every device. */
const smGlyph: Record<SmIconName, string> = {
  sun: "☀︎", moon: "☽", star: "★", cloud: "◌", aurora: "≋", leaf: "✿",
  snowflake: "✻", half_day: "◑", fire: "◉",
  coin: "●", gem: "◆", crystal: "✦", crown: "♛", shield: "◈",
  feather: "❧", rocket: "▲", comet: "☄︎", magnet: "⊕", badge: "⊛",
  dice: "⚄", trophy: "◎", rainbow: "〜",
  swords: "✕", flag: "⚑", lightning: "↯", infinity: "∞", target: "⊚", spiral: "◎",
  mountain: "△", volcano: "▲", island: "◬", dunes: "≈", buildings: "⊞", shell: "◐",
  bird: "◇", ghost: "◍", flock: "◈", egg: "○", eagle: "◆",
  glide: "⟿", wing: "≫", weight: "▼", paper_wing: "△",
  pause: "‖", check: "✓", question: "?", castle: "⛫︎", hourglass: "⧖", spin: "◷", piggy: "○",
  wind: "⇝", thermal: "♨", storm: "☈", ash_storm: "☁", sparkle: "✳",
  gift: "❁", hammer: "⚒︎", calendar: "▦",
  medal: "✪", medal_1: "✫", medal_2: "✬", medal_3: "✭",
  chat: "❝", handshake: "⇄", wave: "〰", laugh: "☻", bravo: "✧", hand: "☞", robot: "⌬",
  mail_in: "✉", mail_out: "↗", save: "▣", globe: "⊙",
  ruler: "◺", search: "⌕", lock: "⊗", boxing: "❋", takeoff: "⇗",
  people: "∷", link: "↔", photo: "▤", clipboard: "▥", play: "▷", download: "⇩",
  tv: "▭", crate: "▢", boom: "✸", p1: "❍", p2: "❒",
  offline: "⊘", cosmos: "✶", tornado: "☴",
  fullscreen: "⛶", fullscreen_exit: "⧉",
};


/**
 * Resolve an icon NAME to its glyph.
 *
 * This used to `?? name`, returning the key itself when the lookup missed.
 * That is indistinguishable from a successful lookup at the call site, and it
 * is exactly how the results card shipped reading "egg Nest upgraded!" and
 * "trophy Trophy: Cloud Nine" — `beatIcon` hands back names by design, the
 * renderer forgot to resolve them, and the fallback made the mistake look
 * like content. An unknown name now yields a neutral marker, so a miss
 * degrades to a dot instead of leaking an internal identifier into the UI.
 */
export function iconGlyph(name: string): string {
  return smGlyph[name as SmIconName] ?? FALLBACK_GLYPH;
}

/** Does this name resolve to a real glyph? For guards and tests. */
export function hasIconGlyph(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(smGlyph, name);
}

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

/** Functional chrome controls — pause, dismiss, back.
 *
 * These were text glyphs (`❙❙` U+2759, `✕` U+2715, `‹` U+2039). The arrows
 * above were already converted for exactly this reason and these are the same
 * bug with higher stakes: U+2759 and U+2715 are absent from the base font set
 * of lean Android WebViews, several Linux distributions and stripped
 * Chromebook images, and an in-browser capture reproduced the **pause button
 * rendering as two empty boxes**. A player who cannot find pause cannot stop
 * playing, and Poki's quality bar calls out pause handling by name.
 *
 * Drawn as strokes on a 24-unit grid with `currentColor`, so they inherit the
 * button's colour and hover state, scale without hinting artefacts, and are
 * pixel-aligned at the 44 px control size the HUD uses. */
export function pauseSvg(): string {
  return '<svg class="chrome-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><rect x="7" y="5" width="3.6" height="14" rx="1.6"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.6"/></svg>';
}
export function closeSvg(): string {
  return '<svg class="chrome-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>';
}
export function backSvg(): string {
  return '<svg class="chrome-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m14.5 5-7 7 7 7"/></svg>';
}

/** Countdown / duration marker.
 *
 * Every timer in the game was bare text ("Continues in 7", "Second wind
 * closes in 9s") or, worse, `⏳` U+23F3 — an emoji-presentation code point
 * from the same family as the glyphs that were already caught rendering as
 * tofu. A number with no icon also reads as a label rather than as something
 * counting: the player has to re-read it to notice it changed.
 *
 * One vector clock, `currentColor`, used everywhere a value counts down, so
 * "there is time on this" is a shape the eye learns once. The hands sit at
 * 10-past so the glyph is legible at 14 px, where a vertical minute hand
 * disappears into the face's stroke. */
export function clockSvg(): string {
  return '<svg class="chrome-glyph timer-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12.5" r="8"/><path d="M12 8v4.5l3 1.8"/><path d="M9 2.6h6"/></svg>';
}

/** A quiet illustrated horizon, not another animated particle layer. */
export function menuHorizon(): string {
  return '<svg class="menu-horizon" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 141Q65 83 145 125T300 117T456 115T600 85V200H0Z" fill="#ced8ba"/><path d="M0 163Q85 108 180 153T366 143T600 138V200H0Z" fill="#a2be9f"/><path d="M0 184Q90 160 190 181T400 171T600 180V200H0Z" fill="#749d87"/><path d="M0 179Q96 155 195 177T400 167T600 176" fill="none" stroke="#eaf0d2" stroke-width="2" opacity=".65"/></svg>';
}
