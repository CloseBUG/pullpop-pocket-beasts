# PULLPOP: Pocket Beasts — Feel Prototype (Phase 0)

A playable implementation of the **Phase 0 "Feel Prototype"** from the *PULLPOP: Pocket Beasts Complete Game Blueprint* — a one-thumb, turn-based ricochet action roguelite.

> **Goal of Phase 0 (blueprint §30, §36):** prove that pulling and releasing a Popling is enjoyable *before* building progression, monetization, or content. "There is one small build in which a stranger can pull Pogo, understand the result, smile at an unexpected chain and voluntarily press **Again**."

This prototype is built in **pure HTML5 Canvas + JavaScript** (no build step, no dependencies) so it runs anywhere a browser does — double-click `index.html`, or wrap it in Capacitor/Cordova for iOS.

---

## ▶ How to run

**Option A — double-click (zero setup):**
Open `index.html` in any modern browser (Chrome, Safari, Firefox, Edge).

**Option B — local server (recommended for audio autoplay):**
```bash
# from the project root
python -m http.server 8080
# then open http://localhost:8080
```

Audio unlocks on the first tap (mobile autoplay policy).

---

## 🎮 How to play

1. **Drag back** from a glowing (Ready) Popling — like a slingshot. The Popling stretches toward your finger; its eyes track the projected path.
2. A **dotted yellow line** previews your first ricochet. A **charge ring** fills around the Popling (75% → 90% → 100% with haptic ticks).
3. **Release** to launch. The Popling ricochets off walls, enemies, allies and bumpers, building a combo.
4. **Tap** while it's flying to trigger its **POP** ability (when charged — "POP" appears above the Popling).
5. Drag back into the **cancel circle** to safely cancel without losing your turn.
6. After your shot ends, enemies perform their **telegraphed** intents (red zones, arrows, lines, countdowns). Position your Poplings out of danger.
7. Clear all enemies to clear the room. Pick a boost. Repeat through 5 rooms.

**One finger. Endless angles.**

---

## ✅ What's implemented (mapped to the blueprint)

| Blueprint section | Feature | Status |
|---|---|---|
| §1 Ten-second promise | Pull → preview → release → ≥3 impacts → chain, with juice | ✅ |
| §5.1 Arena | Portrait arena ~78% of screen, rectangular walls | ✅ |
| §5.2 Squad | 3 Poplings, Ready/Resting, shared Courage (100), shield | ✅ |
| §5.3 Player turn | Pull, drag charge 75–100%, dotted preview, cancel circle, release, tap-to-POP, shot termination | ✅ |
| §5.4 Enemy intents | Locked zone, tracking, charge, countdown, guard — all telegraphed with shapes/patterns (not color alone) | ✅ |
| §5.5 Damage model | `Power × velocityFactor × comboFactor × armorFactor`, velocity clamp 0.65–1.30, combo cap, repeated-hit 0.14s cooldown + 40% floor after 4 hits | ✅ |
| §6 Juice | Squash-and-stretch, hit-stop (35–65ms), camera shake (capped), particles aligned to normals, slow-mo on final enemy, combo typography at milestones (5/10/20/35/50), bassy procedural pops, haptics | ✅ |
| §7 Poplings | Pogo (springy passive + Second Wind POP), Cinder (Burn), Mosslug (Buddy heal) — the vertical-slice trio | ✅ |
| §8 Statuses | Burn, Chill, Shock, Bloom, Break, Mark (6) | ✅ |
| §9 Augments | 12 across Bounce / Buddy / Precision, 3-choice offers, reroll | ✅ |
| §10 Enemies | Dumpling, Pinprick, Braceface, Shoveler, Mumbler + elite mods (Armored/Restless/Unstable) | ✅ |
| §12 Expedition | 5-node run, augment choices between rooms, Buttons (run-only currency) | ✅ |
| §18 HUD | Courage/shield, room/enemy count, combo, squad portraits, pause | ✅ |
| §18 Settings | Volume (master/music/sfx), haptics, shake, reduced flashes, reduced motion, aim assist, left-handed, battery saver | ✅ |
| §21 Accessibility | No aim timer, extended preview, reduced motion/flashes, color-blind intent patterns, persisted settings | ✅ |
| §20 Audio | Procedural WebAudio: bassy pops, pentatonic combo climb, distinct timbres per contact type, ambient music | ✅ |
| §20 Haptics | Charge tick / release / normal / buddy / crit / cancel / POP — globally rate-limited | ✅ |
| §24 Replay | Rolling ~11s buffer at 30fps, playback reconstruction | ✅ |
| §26 Physics rule | Game-owned collision event queue, substepped, deterministic seed, hard speed/duration/collision caps | ✅ |
| §26 Data-driven | Poplings, enemies, augments, statuses are data in `content.js` | ✅ |

---

## 🗂 Project structure

```
APP/
├── index.html              # Entry — loads all scripts (classic, file://-safe)
├── css/style.css           # Portrait phone UI styling
├── js/
│   ├── util.js             # Math helpers + seeded RNG (mulberry32)
│   ├── config.js           # All tuning values (blueprint §5.3/§5.5 mapping in comments)
│   ├── audio.js            # Procedural WebAudio (§20)
│   ├── haptics.js          # Vibration patterns (§20)
│   ├── effects.js          # Particles, hit-stop, slow-mo, shake, flash (§6)
│   ├── content.js          # Data: Poplings, enemies, augments, statuses (§7–10)
│   ├── physics.js          # Motion + collision queue + damage formula (§5.5, §26)
│   ├── replay.js           # Rolling replay buffer (§24)
│   ├── input.js            # One-finger pull/aim/release/cancel/POP (§5.3)
│   ├── render.js           # Canvas drawing: arena, poplings, intents, HUD (§19)
│   ├── game.js             # Core loop: state machine, squad, shot, enemy turn (§5)
│   ├── ui.js               # DOM screens: title/howto/pause/settings/augment/end (§18)
│   └── main.js             # Wiring + game loop
└── test/
    └── headless.cjs        # Node simulation: 25 checks (damage, collisions, win, no-NaN)
```

---

## 🧪 Tests

```bash
node test/headless.cjs
```

Runs a headless simulation (no DOM) that verifies the damage formula, repeated-hit protection, room-clear win condition, full 5-room expedition without NaN or infinite loops, aim preview, and content counts. **25 checks.**

---

## 📱 iOS app project (Capacitor)

This repo is **already a native iOS app project**, not just a web page. Capacitor wraps the web game (`www/`) in a native iOS WKWebView shell with a full Xcode project, signed bundle, and portrait-locked orientation.

### What's in the iOS layer

| Artifact | Purpose |
|---|---|
| `capacitor.config.json` | App ID `studio.tumble.pullpop`, name `PULLPOP`, `webDir: www` |
| `ios/App/App.xcodeproj` / `.xcworkspace` | Native Xcode project (open this on a Mac) |
| `ios/App/App/Info.plist` | **Portrait-only** orientation (§2), hidden status bar, ProMotion 120Hz enabled, no-tracking declaration (§17/§34), background-audio capability (§6/§20), non-exempt-encryption=false (§34) |
| `ios/App/App/AppDelegate.swift` | Hard portrait-orientation lock + lifecycle bridge that dispatches `appbackground`/`appforeground` events into the WebView (triggers run-save per §12) |
| `ios/App/Podfile` | Capacitor CocoaPods dependencies (iOS 13.0+) |
| `ios/App/App/Assets.xcassets` | App icon + splash screen assets |

### Build it on a Mac → TestFlight (blueprint §30 Phase 0 deliverable)

> The native project was generated with `npx cap add ios` and validated (38/38 checks, `node test/validate-ios.cjs`). It cannot be *compiled* into an `.ipa` on this Windows machine (no Xcode/CocoaPods) — compilation requires macOS. The project itself is complete and ready. Two build paths below.

#### Path A — Cloud build via GitHub Actions (no Mac needed)

Push to GitHub, then add repository Secrets (Settings → Secrets → Actions): `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`, `KEYCHAIN_PASSWORD` (and optionally `APP_STORE_CONNECT_API_KEY` + `APP_STORE_CONNECT_ISSUER_ID` for auto-upload). The workflow `.github/workflows/ios-build.yml` runs on GitHub's **macos-14** runner, builds a signed `.ipa`, uploads it as an artifact, and optionally pushes it to TestFlight.

```bash
git push   # triggers the iOS Build (TestFlight) workflow → .ipa artifact
```

#### Path B — Build on your own Mac

```bash
# 1. On a Mac, install prerequisites:
#    - Xcode 15+ from the Mac App Store
#    - CocoaPods:  sudo gem install cocoapods
#    - Node 20+

# 2. One command (from project root) — installs, syncs, validates, archives:
./scripts/build-ios.sh              # unsigned archive (proves it compiles)
./scripts/build-ios.sh --sign       # signed .ipa for TestFlight (needs build/ExportOptions.plist)

# OR step by step:
npm install
npx cap sync ios      # copies www/ -> ios/App/App/public, runs pod install
npx cap open ios      # opens Xcode
# In Xcode: Signing & Capabilities → your Team → Product → Archive → Distribute App → TestFlight
```

Either path produces the blueprint's **Phase 0 deliverable: "a TestFlight build proving that one shot feels excellent."**

### Validate the native project (runs anywhere)

```bash
node test/validate-ios.cjs   # 38 checks: pbxproj refs, Info.plist, Podfile, AppDelegate, web sync
```

### iOS-specific behavior implemented

- **Portrait lock** — enforced in both `Info.plist` (`UISupportedInterfaceOrientations`) and `AppDelegate` (`supportedInterfaceOrientationsFor`), matching blueprint §2.
- **Safe-area insets** — viewport `viewport-fit=cover` + `env(safe-area-inset-*)` CSS so the HUD/band clear the notch and home indicator.
- **Save on background** — `AppDelegate` → WebView event → `game.saveRun()` persists run state to `localStorage` (blueprint §12).
- **No tracking on first launch** — `NSUserTrackingUsageDescription` present but never requested during tutorial (blueprint §17).
- **Background audio capability** — declared for future music (blueprint §6/§20).

### Or port the mechanic to Unity (blueprint §26 recommendation)

The blueprint recommends Unity + C# for the *shipping* client. The damage formula, collision queue, and tuning values in `www/js/config.js` / `www/js/content.js` are engine-agnostic and translate directly to C# ScriptableObjects. The Capacitor path ships the verified mechanic to iOS fastest; Unity is the long-term home if the prototype passes Gate A.


---

## ⚠ Scope notes (per blueprint §30, §35)

This is the **feel prototype**, not the full game. Deliberately excluded (as the blueprint mandates for Phase 0): account, store, story, season, backend, multiple worlds, boss fight, polished art. The *only* question it answers: **is pulling and releasing a Popling so enjoyable that people voluntarily do it again?**
