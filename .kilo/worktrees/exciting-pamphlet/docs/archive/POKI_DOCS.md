# Poki Developer Guide — Full Extract
> **Status:** archived — flat extract of the Poki developer guide saved 2026-09-22, with no rule IDs and nothing machine-checkable. Superseded by [`../poki/`](../poki/), which re-extracts the same corpus as 119 numbered rules plus `requirements.json`.

*Source: developers.poki.com · Saved: 2026-09-22*

---

## Developer Guide Overview

### The foundations for games on web
Web games share similarities with other platforms but require specific best practices to succeed. Developers should focus on selecting appropriate web game engines and understanding player hardware insights to ensure compatibility and performance.

### Development Tools
Poki provides a suite of development tools designed to assist creators throughout their web development journey and streamline the process of launching and improving games.

### Tips and tricks
Success on the web relies on fast onboarding flows, high engagement strategies, and localization to reach a global audience. Developers are encouraged to integrate monetization early in the development process to maintain a positive user experience and ensure game thumbnails are impactful to attract players.

---

## Easy Access & Onboarding

### Skip the menu
Optimize onboarding by allowing players to jump directly into gameplay. Avoid unnecessary splash screens, title screens, or level selection menus for first-time players to maintain momentum.

### A safe beginner environment
Create a safe beginner environment by starting with simpler levels that allow players to succeed early. Gradually increasing difficulty helps maintain engagement, and mechanics like preventing early player death can help users learn without frustration.

### Gradual introduction
Avoid overwhelming players by introducing mechanics and controls gradually over several levels. This approach reduces 'frontal load,' preventing players from feeling intimidated by too much information at once.

### Explain the game with visuals
Effective tutorials should feel natural and avoid blocking gameplay. Prioritize visual communication through images, animations, or gestures over text to accommodate non-English speakers and prevent overwhelming the player.

### Loading screens / Progressive loading
Loading screens should be visually engaging and include a progress bar to prevent players from assuming the game is broken. Progressive loading is a highly recommended technique that downloads only essential initial assets first, while remaining files load in the background to minimize drop-off rates.

### Keep it small
To ensure accessibility across various devices and internet speeds, aim for a game file size between 8 and 10MB. Keeping files small is critical for performance on older hardware and slower connections.

### Mobile first!
Because a significant portion of gameplay on the platform occurs on mobile devices, developers should prioritize mobile compatibility early in the development process.

### Portrait vs. Landscape
Poki supports games in Landscape, Portrait, or both orientations. Developing for Portrait is strongly recommended as it increases player engagement by 6% on average and enables eligibility for Gamebar Display ads, which appear in the title bar on mobile devices to provide additional revenue opportunities.

### Test it!
Poki Playtest recordings allow developers to observe how players navigate the early stages of a game. This data helps in fine-tuning the onboarding process to ensure a smooth and efficient user experience.

---

## Engagement

### Add touch and keyboard controls
Ensure games are accessible by supporting both mouse and keyboard navigation. Standardize controls by using WASD or arrow keys for movement and the space bar or return key for primary menu actions.

### Clear goals
In addition to short-term level goals, implement long-term objectives such as unlocking new items, weapons, or characters. Providing a clear progression path encourages players to continue playing to earn rewards.

### Congratulate the player
Boost player confidence and retention by celebrating milestones. Using visual effects like confetti and positive audio feedback at the end of levels or during achievements provides players with a sense of accomplishment.

### Tune the difficulty
Balance game difficulty by implementing an increasing scale. Start with accessible levels to avoid overwhelming new players, then gradually introduce new mechanics and challenges to maintain interest without causing frustration.

### Test it!
Use playtesting to validate game design choices and identify drop-off points. Analyzing where players stop playing helps determine if they are struggling with difficulty or losing interest, allowing for targeted improvements to rewards or challenges.

---

## Localization

### Why localize
Localization is essential for increasing player engagement, particularly for text-heavy games. Games that are not localized often struggle to gain traction in non-English speaking regions, making it a critical consideration for developers targeting a worldwide audience.

### Prepare your game for localization
To avoid tedious translation processes, developers should prepare their games by centralizing all text into a single file format. Prioritizing localization is especially recommended for story-driven, clicker, idle, and quiz games, or any title that relies on text to explain mechanics, items, or power-ups.

### Language groups to translate into
A recommended strategy for global reach:
1. Start with **EFIGS** (English, French, Italian, German, Spanish) + Turkish
2. Secondary: **CJK** (Simplified Chinese, Japanese, Korean) — higher cost/complexity
3. Final: Brazilian-Portuguese and Russian

### How to display languages
For optimal user experience, games should ideally detect the player's browser language and serve the content accordingly. While a manual language toggle in the game menu is a simple and effective solution, automating the language selection process is highly recommended to better serve Poki's diverse global player base.

---

## Game Thumbnail

### The thumbnail impacts your game's success
A high-quality thumbnail is essential for attracting players on the web. It should accurately reflect the game's content, acting as a store window that sets clear expectations for the player. Misleading visuals can negatively impact conversion rates and gameplay time.

### Embrace simplicity / Keep it together
Effective thumbnails prioritize simplicity by focusing on a single clear foreground object, such as a main character or key gameplay element. For games that are part of a series, maintaining visual consistency across thumbnails helps players recognize related titles.

### Poki requirements for thumbnails

**Size matters / Color and contrast**
When designing thumbnails, ensure that details and typography remain legible even when scaled down to smaller tile sizes. High contrast is vital to make the image stand out, and designers should avoid using colors similar to the Poki Playground background (#83FFE7) to prevent the thumbnail from blending in.

**Don't cut corners**
Thumbnails must be delivered as full-bleed square images with a minimum resolution of **628px × 628px**. Rounded corners are applied automatically by the platform via an image mask.

---

## Monetization

### Overview
Integrating monetization early in the development process allows for more natural implementation of rewarded videos, ensuring they provide relevant rewards at optimal times. This approach improves revenue potential without negatively impacting the user experience. Developers should prioritize game engagement, as higher engagement levels correlate with increased interaction with rewarded video content.

### Requirements
Rewarded videos must be optional and never block core gameplay. Any interface element triggering a video must be clearly labeled with text or icons, accessible, and transparent about the nature of the reward.

### Types of Rewarded Videos

**A Helping Hand**
Rewarded videos can be used to balance game difficulty and reduce player drop-offs. Common implementations include offering revives, level skips, hints, stat boosts, speed enhancements, or granting special abilities to help players overcome challenges.

**Customization**
Offering customization options through rewarded videos fosters player ownership and increases replayability. Players can unlock cosmetic items for characters or weapons, or access new features like environment changes and UI color schemes.

**In-Game Economy**
Rewarded videos can integrate with in-game economies by allowing players to choose between spending earned currency or watching an ad to receive rewards. This strategy helps maintain a balance between different game mechanics, such as multiplying earned points or directly unlocking currency.

### Best Practices / Tips

1. **Use dynamic rewarded video opportunities** — time-limited offers or context-specific triggers, rather than static buttons.
2. **Seasonal/temporary content** — boosts long-term player retention.
3. **Clear feedback** — provide animations or sounds immediately after watching an ad to confirm reward.
4. **Automatic reward activation** — when possible, automatically equip or activate rewards to reduce navigation steps.
5. **Infinite ad views are permitted** — but monitor game balance; consider implementing limits or dynamic opportunities to control progression speed.
6. **Natural game flow** — place non-ad options in primary positions. Avoid making rewarded video buttons overly insistent or invasive.
7. **Standard 🎬 icon** — use it to clearly identify rewarded video opportunities.

---

## Poki Game Development Tools

### Poki Inspector
The Poki Inspector is a quality assurance tool that allows developers to evaluate their web games against key success factors. It enables testing for mobile compatibility and technical optimization by uploading a web build.

### Poki Networking Library (Netlib)
The Poki Networking Library (Netlib) is a peer-to-peer library utilizing WebRTC datachannels to facilitate direct UDP connections between players. It is designed to simplify WebRTC implementation for web games, similar to the Steam Networking Library, and is available for use regardless of whether the game is hosted on Poki.

### Arbitrary User Data Store (AUDS)
The Arbitrary User Data Store (AUDS) is a prototype backend service that allows developers to store user-generated content, such as levels or leaderboard data. It generates shareable codes for stored data, enabling features like non-real-time multiplayer. **Currently, this service is exclusive to games hosted on the Poki platform.**

---

## Player Device Report

### Overview
The Poki Player Device Report provides daily updated insights into the hardware and software environments used by players. The data is derived from a random sampling of 100 million players and adheres to Poki's privacy policies.

### Technical metrics tracked
- Operating systems, browser usage, CPU core counts, screen aspect ratios, device pixel ratios
- Audio format support
- Essential web APIs: WASM, WebRTC, WebP, WakeLock
- Advanced capabilities: AI features (translator, language model, summarizer, detector), WebGPU, WebGL versions and extensions

---

## Web Game Engines

### Choosing your engine

**Key selection criteria:**
- 2D vs 3D support
- Multiplayer capabilities
- Mobile web optimization (ideally under 5MB initial, under 8MB total)
- Team workflow support (version control, licensing)

### Engine Comparison

| Engine | Best for | Empty project size | Mobile |
|--------|----------|--------------------|--------|
| Three.js | 3D, custom | 151KB (122KB Brotli) | Manual touch/scaling |
| PixiJS | 2D, lightweight | ~130KB | Native touch |
| Phaser | 2D HTML5 | 290KB | Responsive scaling |
| Defold | 2D/3D, small | ~1.03MB | Native touch |
| Construct 3 | 2D, no-code | 342KB zipped | Native PWA |
| Cocos Creator | 2D/3D | 709KB | Native |
| PlayCanvas | 2D/3D | 300KB | Responsive |
| LayaAir | 2D/3D | 2.1MB | Native |
| GameMaker | 2D | 450–550KB | Native |
| Stencyl | 2D visual | 500KB | Landscape |
| Godot | 2D/3D | ~10MB | Responsive |
| Unity | 2D/3D | ~11MB | Native |
| Wonderland | 3D only | 3.2MB / 1.6MB gz | High-perf |

### Three.js (used by Sunbird)
Three.js is a JavaScript library designed for rendering 3D graphics in the browser via WebGL. Unlike full-scale game engines, it is a minimalistic library that offers high customizability and small file sizes, though it requires more manual implementation for game-specific features.

- **2D**: Not native  
- **3D**: Mesh, shader, and lighting — excellent  
- **Physics**: Not built-in; requires third-party  
- **Multiplayer**: Not built-in; requires third-party  
- **Mobile**: Must implement touch controls and responsive scaling manually  
- **License**: MIT — royalty-free  
- **File size**: 151KB uncompressed, 122KB Brotli  

---

## Sunbird: Golden Flight — Compliance Notes

### ✅ Already passing
- SDK lifecycle: `gameLoadingStart` → `gameLoadingFinished` → `gameplayStart`/`gameplayStop`
- `commercialBreak()` on pause-exit → gameplay
- `rewardedBreak()` with clear non-ad alternative
- No double SDK events (GameplayEvents state machine)
- Incognito-safe localStorage (try/catch everywhere)
- CUSTOM_PILOT_NAMES=false (no unmoderated text)
- SQUAD_CHAT=false (emotes only in multiplayer)
- PvP profanity: auto-generated names

### ✅ Fixed this session
- IAP (Gold/VIP) purchase buttons fully hidden when `SELL_AD_REMOVAL=false`
- `open-paywall` action returns early on Poki build
- Challenges screen-head pill no longer clips title
- Long Light added as first play destination

### ⚠️ Action required
- Confirm AUDS game ID matches Poki dashboard
- Upload static + animated thumbnail (628×628px min, avoid #83FFE7)
- Walk Poki Inspector on `dist-poki/` build
- Set `VITE_POKI_NETLIB_GAME_ID` from Poki dashboard
- Any external links (Discord, etc.) must call `PokiSDK.openExternalLink(url)` not direct `location.href`
- Consider portrait mode support (+6% engagement)
