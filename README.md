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
| **R** Rapid Fire | Bullet stream (8s) |
| **S** Spread Gun | 5-way fan shot (8s) |
| **L** Mega Laser | Continuous beam that shreds everything (8s) |
| **M** Missiles | +8 homing missiles with splash damage |
| **+** Health | +25 HP |
| **◆** Shield | Refills the shield |
| **✸** Nova Bomb | Clears the whole screen |

## Progression (a new level every 25 seconds)
| Level | Unlock |
|---|---|
| 2 | Shields online (recharge after 2.5s without a hit) |
| 3 | Health regen (after 4s without a hit) |
| 4 | Auto missile pod |
| 5 | Twin blasters |
| 6 | Shield boost |
| 7 | Turbo regen |
| 8+ | +10 max HP every other level |

From level 2 on, every level is harder than the last:
- Asteroids fall about 12% faster each level, arrive about 13% more often, get tougher, and hit about 10% harder
- A growing share of rocks and debris is **aimed at where you are**
- From level 3, rocks also fly in **from the sides**, where your gun can't reach
- From level 4, red **homing space mines** chase you until you shoot them or they fizzle out
- **No camping:** stay in one spot for a few seconds and a **LOCK-ON** reticle targets you, followed by a meteor strike. From level 3, strikes also arrive on a timer
- **Meteor showers** strike halfway through every level from level 3

Perks are deliberately tight: regen only starts after 4 seconds without a hit, shields are smaller and recharge slowly, power-ups last 8 seconds, and pickups get rarer the further you go.

Chain kills to build a combo multiplier of up to x8.

## Gamertag & leaderboard
Type a gamertag on the start screen, or tap 🎲 for a random one. No account or sign-up is needed. Your tag and a top-10 leaderboard are saved on your device.

## Boss fights
Every 5th level a boss shows up and the music goes dark and fast. The level clock pauses until it's beaten. Bosses alternate and get tougher each time:

- **Rock Golem**: a magma-cracked asteroid with glowing eyes and orbiting boulders. It throws fans of rocks, hurls giant boulders at you, and calls down meteor showers.
- **Alien Mothership**: a saucer with chasing rim lights. It fires plasma bursts and aimed volleys, chains lock-on strikes, and drops homing mines.

Below half health a boss becomes **ENRAGED** and attacks faster. Beating one sets off a chain of explosions, gives a big score bonus, heals you a little, and drops health, a gun and missiles.

## Mega Laser soundtrack
While the Mega Laser fires, the music switches to an original reggaeton track: a dembow beat, a sub bass, a plucky synth riff, and a DJ air horn.

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
