# Choosing your web game engine — extracted reference

Source: <https://developers.poki.com/guide/web-game-engines>

The guide's largest page: how to choose an engine for a web game, and a
capability profile of every engine Poki tracks. It is kept here in full because
the decision framework — not the engine list — is what a build has to justify.

## Part 1 — The decision framework

| ID | Kind | Rule |
|---|---|---|
| `ENG-01` | recommendation | Engine selection should be based on the specific requirements of your game, particularly whether you need **2D or 3D** support and whether you need **multiplayer**. Use these as the primary filter to shortlist engines, then do deeper technical research. |
| `ENG-02` | requirement | **Mobile web fit is essential to reach a broad audience.** Prioritise engines that support touch controls and keep file sizes small — ideally an **initial download under 5 MB** and a **total size under 8 MB**. |
| `ENG-03` | requirement | **Team fit:** choose an engine that supports collaborative work on the *same project files*. Teams must also account for licensing fees, which can scale significantly with the number of team members. |
| `ENG-04` | recommendation | When developing for the web, engine selection is critical. HTML5 is robust, but some engines are purpose-built for web performance while others (Unity is the named example) require additional effort for web exports. |
| `ENG-05` | informational | Key factors for web success, in order: mobile web optimisation, engine capabilities, team workflow support. |

## Part 2 — Engine profiles (as documented)

Each profile lists what the guide documents under *What you need*
(capabilities), *Developer (team) fit*, and *Mobile web tech fit*.

### Unity

- **What you need** — robust 2D and 3D. 2D: sprites, bone animations, lights,
  shaders, physics. 3D: highly regarded — photo-realistic rendering, particle
  systems, advanced physics and animation tools. **Multiplayer**: primarily
  supported through the Asset Store, which offers plug-ins simplifying
  integration with common back-end services.
- **Team fit** — the Unity editor is highly customisable and includes a scene
  layout module that facilitates collaboration. Extensive online tutorials and
  documentation for new users. **Licensing**: free tier for developers earning
  under €100,000/year; above that, the Paid tier, with costs scaling by company
  size and project requirements.
- **Mobile web fit** — an unoptimised empty project build is **≈11 MB**. Built-in
  touch controls and both landscape and portrait orientations; proper
  optimisation significantly improves suitability.

### Godot

- **What you need** — versatile 2D/3D, popular since 4.0, growing community,
  frequently compared to Unity. 2D: specialised pipeline with advanced lighting,
  tilemaps, particle systems; the **Animation Player** is a standout (animate
  virtually any part of the engine). 3D: modern renderer with PBR materials, HDR,
  post-processing; built-in physics for both dimensions. **Multiplayer**: no
  native back-end integrations, but nodes for web connections and an Asset
  Library with community plug-ins (Nakama, Colyseus, Playfab).
- **Team fit** — separate 2D and 3D editor workspaces help artists and
  programmers collaborate; project data structure is highly compatible with Git;
  open-source and free, including commercialisation, with no licensing fees.
- **Mobile web fit** — responsive scaling (portrait and landscape) and touch
  controls, but a **10 MB compressed empty project** can mean long loads on weak
  connections. For web-exclusive exports the guide recommends **Godot 3.5**
  (mobile-optimised OpenGL); **Godot 4.3** improves compatibility by making
  `SharedBufferArray` optional.

### Construct 3

- **What you need** — 2D-focused with visual scripting (event sheets) *and*
  JavaScript/TypeScript; built-in animation editor, flowcharts, timelines, and a
  modular addon system that optimises export sizes. 2D: tilemaps, particle
  systems, mesh distortion, collision engine with Box2D physics. 3D: basic
  elements (3D cameras, mesh distortion); third-party extensions add gLTF and
  advanced 3D physics. **Multiplayer**: WebRTC-based peer-to-peer with a
  dedicated signalling server for matchmaking; third-party services (Colyseus,
  Firebase, Photon, PlayFab) also supported.
- **Team fit** — Git-friendly JSON project files, integration with external code
  editors, subscription licensing with **no royalty fees** for exported games.
- **Mobile web fit** — empty project **730 KB unzipped / 342 KB zipped**;
  automatic viewport scaling and safe-area insets; games are built as PWAs and
  can be exported as native apps via Cordova; custom plugins extend native
  mobile functionality.

### GameMaker

- **What you need** — 2D-focused, GameMaker Language (GML); extensive editor with
  animation tooling (Spine and SWF imports, animation curves, timeline
  animations) and a custom physics system based on Box2D. 3D: basic features
  (shaders, matrices, vertex buffers) that allow unique visual styles; a
  fully-fledged 3D game requires significant technical expertise.
  **Multiplayer**: native options plus community-made extensions for third-party
  back-ends.
- **Team fit** — the IDE integrates Git, so teams collaborate effectively, and
  both coding and graphical asset management happen in one interface.
  **Licensing**: free to develop with; commercialising and accessing all export
  platforms requires a Professional licence or an Enterprise subscription.
- **Mobile web fit** — optimised for mobile and desktop web with touch controls
  and responsive scaling; an empty export is **450–550 KB compressed**.

### Defold

- **What you need** — web-focused, 2D and 3D; comprehensive editor with built-in
  Lua scripting, GUI design and animation tooling; extensive docs and an active
  community. Primarily 2D: tilemaps, sprites, particle effects, Spine and Rive
  skeleton animations. 3D: `.gLTF` model imports, custom shaders, Bullet physics,
  and **low file sizes by generating meshes at runtime**. **Multiplayer**:
  built-in integrations for Nakama, PlayFab, Colyseus and Web Sockets; more via
  the Defold Asset Portal.
- **Team fit** — native Git version control, merge-friendly text file formats,
  integration with popular IDEs, artist-friendly environment for characters and
  UI. **Licensing**: completely open source; free commercialisation with no fees
  or royalties.
- **Mobile web fit** — highly optimised: **empty project ≈1.03 MB**, native touch
  controls, responsive scaling for both orientations, works on older devices.

### PlayCanvas

- **What you need** — web-based engine for 2D and 3D with a robust editor and
  collaborative development tools; **empty project ≈300 KB**. 2D: tilemaps,
  sprites, text, particle effects, GUI scenes. 3D: `.gLTF` models with
  animations, dynamic mesh creation, customisable materials, GLSL shaders.
  **Multiplayer**: integration with various back-end systems, with documentation
  and tutorials.
- **Team fit** — Git version control integration, merge-friendly text format.
  **Licensing**: engine is open source; subscription plans add features and
  services, and free licences allow commercialisation without royalties.
- **Mobile web fit** — games are optimised for mobile devices with built-in
  responsive scaling for portrait and landscape plus a small initial file size.

### Wonderland Engine

- **What you need** — 3D web engine built with C++/WebAssembly; game logic in
  JavaScript or TypeScript; supports any browser API or npm library; optimised
  for fast loading and performance. 3D-specialised: physically based shading, GPU
  skinning, 3D animations, PhysX integration; **not recommended for 2D**; assets
  are automatically compressed into a fast-loading binary format.
  **Multiplayer**: standard web frameworks, or Wonderland Cloud — a WebRTC-based,
  server-authoritative solution with optional voice chat.
- **Team fit** — reusable components for designers and artists; compatible with
  Git and Perforce; CI/CD pipelines via a Docker image. **Licensing**: free up to
  **$120,000** annual revenue; beyond that a **10 % royalty on excess revenue** or
  a monthly seat-based subscription.
- **Mobile web fit** — base load **3.2 MB (1.6 MB gzipped)**; highly optimised
  for mobile browsers, with automatic scene optimisation to reduce draw calls and
  efficient GPU memory management for high-resolution textures.

### Three.js

- **What you need** — a JavaScript library for rendering 3D graphics in the
  browser via WebGL. **Not a full-scale game engine**: minimalistic, highly
  customisable, small file sizes, but more manual implementation for
  game-specific features. Excels at rendering (mesh, shader, lighting setup), but
  **no native physics engine** and **no built-in multiplayer frameworks** —
  bring your own solution or external examples.
- **Team fit** — MIT licensed: free creation and distribution, no royalties.
  A basic online editor exists but lacks robust collaboration, so teams manage
  version control manually (e.g. GitHub).
- **Mobile web fit** — base size **151 KB compressed, 122 KB with Brotli**, which
  makes it highly suitable for older devices and limited connectivity. It has
  **no native touch controls and no built-in responsive scaling** — implement
  them manually for greater control at the cost of development time.

### Phaser

- **What you need** — high-performance HTML5 game framework for JavaScript and
  TypeScript, optimised for web deployment and scalable across screen sizes.
  2D: scene graphs, mesh and text rendering, multitouch, accessibility (screen
  reader compatibility); animation: sprite-based systems, tweens, Spine 3 and 4.
  3D: **not natively supported** (third-party plug-ins only). **Multiplayer**:
  integrates with Colyseus, Firebase, Socket.io and Nakama.
- **Team fit** — no custom editor, so developers use their preferred IDE; no
  integrated graphical environment and no built-in version control; MIT licensed
  for free commercial use.
- **Mobile web fit** — responsive scaling, touch control support and
  mobile-specific rendering pipelines; **empty project 290 KB**.

### PixiJS

- **What you need** — lightweight 2D rendering engine using WebGL and **WebGPU**
  with automatic fallback to HTML5 canvas; designed for high-performance graphics
  and widely used for responsive web games. 2D: scene graphs, mesh and text
  rendering, accessibility tools, compressed texture support; **no built-in
  physics or animation systems** (third-party or custom). 3D via the Pixi3D
  plug-in; multiplayer via third-party services such as Colyseus.
- **Team fit** — MIT licensed, royalty-free; no built-in version control but
  compatible with GitHub; third-party visual editors; extensive community docs.
- **Mobile web fit** — **≈130 KB** compressed empty project; native touch
  controls and responsive scaling; layout must be managed manually.

### LayaAir

- **What you need** — web-oriented engine supporting TypeScript, JavaScript and
  ActionScript, with an efficient renderer optimised for performance across
  devices; suited to 2D and 3D multimedia. 2D: sprite rendering, tilemaps, UI
  components, Box2D physics. 3D: scene editor, camera system, mesh rendering,
  animation systems, with Bullet, Cannon.js and PhysX physics. **Multiplayer**:
  built-in networking for HTTP and WebSocket requests.
- **Team fit** — visual editor lets programmers and artists collaborate in the
  same environment; version control (e.g. Git) supported; MIT licensed and
  royalty-free.
- **Mobile web fit** — empty web export **2.1 MB**, plus native touch controls
  and screen adaptation — well suited to mobile web.

### Cocos Creator

- **What you need** — cross-platform 2D/3D engine with a visual editor,
  JavaScript/TypeScript scripting, and integrated animation, physics and UI
  tools. 2D: UI components, tilemaps, particle systems, Box2D physics. 3D: PBR
  rendering, glTF 2.0 and FBX formats, multiple render pipelines, Bullet and
  PhysX physics. **Multiplayer**: third-party back-ends — Colyseus, WebSockets,
  Nakama, PlayFab.
- **Team fit** — extendable editor with built-in animation and terrain tools;
  Git-based collaboration; free to use with no licence fees or royalties.
- **Mobile web fit** — empty project **709 KB**, native touch controls and
  responsive scaling.

### Stencyl

- **What you need** — Haxe-based 2D engine and editor with a visual coding
  interface and a graphical Scene Designer (drag-and-drop rather than scripting).
  Sidescrolling and isometric layouts, Box2D physics by default (replaceable with
  simpler systems), tweens and frame-based animations. **No 3D**, **no online
  multiplayer**.
- **Team fit** — visual editor and Photoshop-like Scene Designer let team members
  collaborate without writing code; version control is possible but **not
  natively integrated**. **Licensing**: publishing to web is free; other
  platforms require one of two yearly subscription tiers.
- **Mobile web fit** — **500 KB** compressed empty project, built-in touch
  controls and landscape scaling; **portrait orientation support is limited**.

## Part 3 — Cross-engine matrix (as documented)

| Engine | Primary dim. | Multiplayer | Licence reality | Empty web build | Mobile-web stance per guide |
|---|---|---|---|---|---|
| Unity | 2D + 3D | Asset Store plug-ins | Free < €100 k/yr, then Paid tier | ≈11 MB unoptimised | Effort required; optimise hard |
| Godot | 2D + 3D | Nodes + Asset Library (Nakama, Colyseus, Playfab) | Open source, free | ≈10 MB compressed | Capable but heavy; 3.5 for GL, 4.3 optional SAB |
| Construct 3 | 2D (+basic 3D) | Built-in WebRTC P2P + third parties | Subscription, no royalties | 730 KB / 342 KB zipped | Strong: PWA, safe-area, Cordova |
| GameMaker | 2D (+basic 3D) | Native + community extensions | Free dev, Pro/Enterprise to ship | 450–550 KB compressed | Strong |
| Defold | 2D-first (+3D) | Nakama, PlayFab, Colyseus, WebSockets | Open source, free | ≈1.03 MB | Strong, older-device friendly |
| PlayCanvas | 2D + 3D | Multiple back-ends | Open source + paid plans, free licence | ≈300 KB | Strong |
| Wonderland | 3D only | Web frameworks / Wonderland Cloud | Free ≤ $120 k/yr, then 10 % royalty | 3.2 MB (1.6 MB gz) | Highly optimised (3D only) |
| Three.js | 3D library | None built-in | MIT, free | 151 KB (122 KB Brotli) | Manual touch + scaling |
| Phaser | 2D | Colyseus, Firebase, Socket.io, Nakama | MIT, free | 290 KB | Strong |
| PixiJS | 2D renderer | Third-party (Colyseus) | MIT, free | ≈130 KB | Small; manual layout |
| LayaAir | 2D + 3D | HTTP + WebSocket | MIT, free | 2.1 MB | Suited |
| Cocos Creator | 2D + 3D | Colyseus, WebSockets, Nakama, PlayFab | Free, no royalties | 709 KB | Suited |
| Stencyl | 2D | None online | Free for web; subscriptions elsewhere | 500 KB | Landscape-focused, portrait limited |

## Part 4 — Why Sunbird is built this way

Sunbird applies `ENG-01`–`ENG-05` rather than defaulting to the biggest engine:

- **`ENG-01` (requirements filter).** Sunbird is a 2D-style arcade flight game
  rendered in 3D perspective; portal builds ship **single-player first**, with
  multiplayer behind an explicitly separate transport, so the primary filter
  points at "light renderer, optional networking" rather than "engine with a
  built-in netcode suite".
- **`ENG-02` (mobile web fit is a requirement).** A full game engine's empty build
  (450 KB – 11 MB depending on the table above) is a *floor* the game cannot go
  under. Sunbird instead ships **hand-rolled systems on Three.js — the smallest
  documented 3D base at 151 KB / 122 KB Brotli — with a fully procedural asset
  pipeline**, so the initial download is the code itself. The Poki zip is gated at
  **< 8 MB** by `scripts/verify-portal.mjs` and currently lands near 700 KB, i.e.
  inside the guide's *initial download < 5 MB* target with the total well under
  8 MB.
- **`ENG-03` (team fit).** Engine choice here is "MIT-licensed library + plain
  TypeScript modules + git", which is exactly the guide's Three.js team-fit
  profile: no integrated editor, standard GitHub workflow, no per-seat cost.
- **`ENG-04`/`ENG-05`.** Because there is no engine runtime, there is also no
  engine runtime cost on mobile: no scene loader, no scripting VM, no heavy
  editor-generated bootstrap. Mobile-first decisions (tiered AI fidelity, DPR
  caps, shadows off on coarse-pointer devices, portrait camera pull-back) are
  implemented directly and pinned by tests.
- **Where engines would win.** The trade is explicit: no built-in physics,
  animation or netcode means Sunbird owns `Bird.step()` (fixed-step,
  determinism-tested), its tween/FX systems, and its own wire protocol. That cost
  is paid once and buys the file-size and control budget the guide's web-fit
  rules demand.
