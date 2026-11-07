# 🦫🚀 Capybara Xpace

A neon space-survival game built for phones. Fly a capybara in a bubble helmet through an asteroid field, dodge the debris, and grab guns and missiles to blast your way through.

## Play
Open `index.html` in a browser, or serve the folder from any static host such as GitHub Pages:

```bash
python3 -m http.server 8000   # then open http://localhost:8000 (or your computer's IP from your phone)
```

On a phone, use **Add to Home Screen** to play it fullscreen like an app. It also works offline after the first load.

## Controls
- **Drag anywhere** to fly. The capybara follows your finger's motion, so your thumb never covers it.
- The blaster **fires automatically**.
- Desktop: arrow keys / WASD to move, `P` or `Esc` to pause.

## Pickups
| Crate | Effect |
|---|---|
| **R** Rapid Fire | Bullet stream (12s) |
| **S** Spread Gun | 5-way fan shot (12s) |
| **L** Mega Laser | Continuous beam that shreds everything (12s) |
| **M** Missiles | +12 homing missiles with splash damage |
| **+** Health | +35 HP |
| **◆** Shield | Refills the shield |
| **✸** Nova Bomb | Clears the whole screen |

## Progression (a new level every 25 seconds)
| Level | Unlock |
|---|---|
| 2 | Shields online (recharge after 2.5s without a hit) |
| 3 | Health regen |
| 4 | Auto missile pod |
| 5 | Twin blasters |
| 6 | Shield boost |
| 7 | Turbo regen |
| 8+ | +20 max HP each level |

From level 2 on, every level is harder than the last:
- Asteroids fall about 12% faster each level, and new ones arrive about 13% more often
- Asteroids get tougher and hit harder, and more of them arrive in pairs and triples
- Spinning satellite debris starts at level 2; from level 4 more and more of it is aimed straight at you
- Blazing comets start at level 3
- **Meteor showers** strike halfway through every level from level 3, longer and denser each time

Chain kills to build a combo multiplier of up to x8.

## Gamertag & leaderboard
Type a gamertag on the start screen, or tap 🎲 for a random one. No account or sign-up is needed. Your tag and a top-10 leaderboard are saved on your device.

## Capy Closet
Tap **👕 CUSTOMIZE CAPY** on the start screen to dress up your capybara. Your look is saved on your device.

| Category | Gear (unlock level) |
|---|---|
| Outfits | Fur Only, 80s Tracksuit, Aloha Shirt, Disco Suit (3), Biker Jacket (5), Tuxedo (7) |
| Shades | Aviators, Pixel Shades, Heart Specs (2), Star Specs (4), 3D Glasses (6) |
| Bling | Gold Chain, Bow Tie, Bandana (2), Pearls (4), Flower Lei (6) |
| Hair & Hats | Sweatband, Retro Cap (2), Afro (3), Neon Mohawk (5), Crown (8) |
| Jetpack | Blue, Hot Pink, Lime, Stealth (4), Solid Gold (6), Rainbow (8) |

Gear marked with a level unlocks the first time you reach that level in any run.

## Look out for...
Every now and then a friendly spaceship cruises by. Its pilot is a capybara vibing to music on headphones under a clear glass dome, with LED lights changing colors inside the cockpit. It's just passing through, so don't shoot it.

There's a **Reduce flashing** toggle on the start screen. It turns on automatically if your device asks for reduced motion.

## Tech
Plain HTML5 Canvas + Web Audio (the music and sound effects are generated in code). No dependencies, no build step.
