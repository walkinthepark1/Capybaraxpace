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

Enemies get faster and more numerous as you go: asteroids that split apart, spinning satellite debris from level 2, and blazing comets from level 3. Chain kills to build a combo multiplier of up to x8.

There's a **Reduce flashing** toggle on the start screen. It turns on automatically if your device asks for reduced motion.

## Tech
Plain HTML5 Canvas + Web Audio (the music and sound effects are generated in code). No dependencies, no build step.
