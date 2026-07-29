# Centerfield TRACON — browser ATC simulator

A radar approach-control simulation game that runs entirely in the browser.
No build step, no dependencies.

## Run it

Open `atc/index.html` directly in a browser, or serve the folder:

```bash
cd atc
python3 -m http.server 8000
# then open http://localhost:8000
```

## The game

- Arrivals appear at the edge of the radar scope; vector them (heading /
  altitude / speed) onto the ILS for runway 9 or 27 at the airport in the
  center of the map.
- Once an aircraft intercepts the approach it flies the ILS itself, and at
  7 NM the tower takes over and lands it.
- Keep 3 NM / 1,000 ft separation. Collisions and fuel exhaustion cost you
  the airplane — you *can* let planes crash, but it costs 200 points.
- Levels start at 5 aircraft with a time limit; each level adds traffic,
  tightens spacing and fuel, and mixes aircraft speeds. Land 70% to advance.
- Full manual: `instructions.html` (linked in-game).

Progress (unlocked levels, high score, sound preference) is stored in
`localStorage`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Game shell and UI |
| `instructions.html` | Controller's handbook |
| `css/style.css` | Radar-scope theme for both pages |
| `js/game.js` | Simulation, rendering, and input |
