# GGDP Implementation Plan for ChronoBoids

## What is Geometry-Guided Dynamic Programming?

**GGDP** is a design framework for optimizing real-time systems with combinatorial hot paths.

### Core Idea

Start from the *geometry of the domain* (space, time, influence, perception), then use DP-style precomputation and geometry-aligned indexed data structures so that expensive `n × m × k` loops become a small number of effective O(1) lookups.

### The GGDP Process

1. **Identify combinatorial hot paths**  
   Find the core loops of the form "for each A, for each B, for each C…" that dominate runtime.

2. **Extract latent geometry**  
   Ask what structure the domain already has:
   - **Spatial**: positions, distances, visibility
   - **Temporal**: ticks, turns, deadlines, urgency
   - **Influence**: fields, gradients, heatmaps
   - **Perception**: what the user can currently see or care about

3. **Design geometry-aligned indexes**  
   Choose data structures that match that geometry so queries become coordinate-like lookups instead of scans.

4. **Precompute using DP-style mechanics**  
   Build and maintain those structures in imperceptible windows. Use classic DP/memoization patterns.

5. **Route hot queries through the indexes**  
   Replace direct loops over raw state with constant-time lookups.

---

## The Boids Problem: A Perfect GGDP Case Study

### The Naive Algorithm

```javascript
// O(n²) - Every boid checks every other boid
for (const boid of allBoids) {           // n iterations
    for (const other of allBoids) {       // n iterations per boid
        if (distance(boid, other) < visionRadius) {
            // Apply flocking rules
        }
    }
}
```

**At 10,000 boids**: 100,000,000 distance checks per frame. Unplayable.

### The GGDP Solution

```javascript
// O(n) - Each boid only checks its spatial neighborhood
for (const boid of allBoids) {           // n iterations
    const neighbors = spatialGrid.query(boid.x, boid.y, visionRadius);  // O(1) lookup
    for (const other of neighbors) {      // ~10-50 neighbors, not n
        // Apply flocking rules
    }
}
```

**At 10,000 boids**: ~500,000 checks. 60 FPS.

---

## GGDP Concepts Applied to Boids

This implementation will demonstrate **six GGDP concepts**, each addressing a different geometric dimension of the boids simulation:

| Concept | Geometry Type | Problem Solved | Speedup |
|---------|---------------|----------------|---------|
| **Spatial Hash Grid** | Spatial | Neighbor queries | 10-100x |
| **Morton Codes** | Spatial (cache) | Memory access patterns | 1.2-2x |
| **Time Wheel** | Temporal | Update scheduling | 10-50x boid capacity |
| **Geodesic Perception** | Directional | Realistic awareness | Behavioral realism |
| **Visual Fiber** | Perceptual | Render batching | GPU efficiency |
| **Hyperbolic Distance** | Social/Influence | Flock cohesion | Emergent behavior |
| **Flow Fields** | Influence | Environmental forces | O(1) force lookup |

---

## Concept 1: Spatial Hash Grid

### The Geometry
Boids exist in 2D space. Neighbors are defined by Euclidean distance. Most boids are NOT neighbors.

### The Index
A grid of buckets where each cell contains boids within that region.

```
┌─────┬─────┬─────┬─────┐
│  ●  │     │ ● ● │     │
├─────┼─────┼─────┼─────┤
│     │ ●●● │  ●  │     │
├─────┼─────┼─────┼─────┤
│  ●  │  ●  │     │ ● ● │
└─────┴─────┴─────┴─────┘
```

### The Query
Instead of checking all n boids, check only the 9 cells around the query point.

### Implementation Status
✅ **Already implemented** in `flock.js` via `organize()` and `candidates()`.

### GGDP Enhancement
Add Morton-ordered iteration (see Concept 2) for cache-coherent processing.

---

## Concept 2: Morton Codes (Z-Order Curves)

### The Geometry
When processing boids in spatial buckets, memory access patterns matter. Random bucket access = cache misses.

### The Index
Morton codes interleave the bits of X and Y coordinates, creating a space-filling curve that preserves spatial locality.

```
Standard order:          Morton order (Z-curve):
0  1  2  3               0  1  4  5
4  5  6  7      →        2  3  6  7
8  9  10 11              8  9  12 13
12 13 14 15              10 11 14 15
```

### The Benefit
Boids that are spatially close are also close in memory, improving L1/L2 cache hit rates.

### Implementation

```javascript
// js/morton.js
function mortonCode(x, y) {
    // Interleave bits of x and y
    x = (x | (x << 8)) & 0x00FF00FF;
    x = (x | (x << 4)) & 0x0F0F0F0F;
    x = (x | (x << 2)) & 0x33333333;
    x = (x | (x << 1)) & 0x55555555;
    
    y = (y | (y << 8)) & 0x00FF00FF;
    y = (y | (y << 4)) & 0x0F0F0F0F;
    y = (y | (y << 2)) & 0x33333333;
    y = (y | (y << 1)) & 0x55555555;
    
    return x | (y << 1);
}

// Sort buckets by Morton code for cache-coherent iteration
const sortedBuckets = buckets.sort((a, b) => 
    mortonCode(a.col, a.row) - mortonCode(b.col, b.row)
);
```

### Files to Modify
- `js/flock.js`: Add Morton-sorted bucket iteration
- `js/morton.js`: New file for Morton code utilities

---

## Concept 3: Time Wheel (Staggered Updates)

### The Geometry
Not all boids need to update every frame. Temporal locality means we can amortize work across frames.

### The Index
A circular buffer of "slots" where each slot contains boids scheduled for that frame.

```
Frame 0: Update slots [0]
Frame 1: Update slots [1]
...
Frame 15: Update slots [15]
Frame 16: Update slots [0] again (wraps around)

┌───┬───┬───┬───┬───┬───┬───┬───┐
│ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │...│15 │
├───┼───┼───┼───┼───┼───┼───┼───┤
│●●●│●●●│●●●│●●●│●●●│●●●│...│●●●│  ← Boids distributed across slots
└───┴───┴───┴───┴───┴───┴───┴───┘
      ↑
   Current slot
```

### The Benefit
With 16 slots, only 1/16th of boids run full physics each frame. The rest interpolate.

**Result**: 16x more boids at the same CPU cost.

### Implementation

```javascript
// js/timewheel.js
class TimeWheel {
    constructor(slots = 16) {
        this.slots = new Array(slots).fill(null).map(() => []);
        this.current = 0;
        this.slotCount = slots;
    }
    
    insert(boid) {
        // Distribute evenly
        const slot = boid.index % this.slotCount;
        this.slots[slot].push(boid);
    }
    
    tick() {
        const active = this.slots[this.current];
        this.current = (this.current + 1) % this.slotCount;
        return active;
    }
    
    // Priority promotion: move important boids to current slot
    promote(boid) {
        // Remove from current slot
        const oldSlot = boid.index % this.slotCount;
        const idx = this.slots[oldSlot].indexOf(boid);
        if (idx >= 0) this.slots[oldSlot].splice(idx, 1);
        
        // Add to current slot (will update this frame)
        this.slots[this.current].push(boid);
    }
}
```

### Interpolation for Non-Updated Boids

```javascript
// In boid.js
interpolate(dt) {
    // Simple linear extrapolation for boids not updated this frame
    this.x += this.vel.x * dt;
    this.y += this.vel.y * dt;
}
```

### Files to Create
- `js/timewheel.js`: Time wheel implementation

### Files to Modify
- `js/flock.js`: Use time wheel for update scheduling
- `js/boid.js`: Add interpolation method

---

## Concept 4: Geodesic Perception (Directional Awareness)

### The Geometry
Real birds have limited fields of view. They can't see directly behind them. This is directional geometry.

### The Index
A geodesic dome (simplified to 12 sectors in 2D) around each boid, binning neighbors by relative direction.

```
         Front
           ↑
    ╱‾‾‾‾‾‾‾‾‾‾‾╲
   ╱  ●    ●    ╲
  │ ●   BOID →   │   ← Heading
   ╲      ●     ╱
    ╲___________╱
     ↓ Blind Spot ↓
       (ignored)
```

### The Benefit
1. **Realism**: Boids behave more like real birds
2. **Emergent behavior**: Predators can "sneak up" from behind
3. **Reduced computation**: Ignore ~25% of neighbors (rear cone)

### Implementation

```javascript
// In boid.js
neighborsWithPerception(flock) {
    const candidates = flock.candidates(this);
    const neighbors = [];
    const heading = this.vel.angle();
    
    for (const bucket of candidates) {
        for (const other of bucket) {
            if (other === this) continue;
            
            // Check distance
            const d = this.sqrDist(other);
            if (d >= g.sqVis) continue;
            
            // Check if in field of view (not in blind spot)
            const angleToOther = Math.atan2(other.y - this.y, other.x - this.x);
            let relativeAngle = angleToOther - heading;
            
            // Normalize to [-π, π]
            while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;
            while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
            
            // Blind spot: rear 90° (±135° to ±180°)
            if (Math.abs(relativeAngle) > Math.PI * 0.75) continue;
            
            // Weight by direction (front = 1.0, sides = 0.5)
            const weight = 1.0 - Math.abs(relativeAngle) / Math.PI;
            neighbors.push({ boid: other, dist: d, weight });
        }
    }
    
    return neighbors;
}
```

### Geodesic Cells for Advanced Queries

```javascript
// js/geodesic.js
class GeodesicPerception {
    constructor(sectors = 12) {
        this.sectors = sectors;
        this.sectorAngle = (2 * Math.PI) / sectors;
        this.cells = new Array(sectors).fill(null).map(() => []);
    }
    
    clear() {
        for (const cell of this.cells) cell.length = 0;
    }
    
    insert(boid, neighbor, relativeAngle) {
        const sector = Math.floor((relativeAngle + Math.PI) / this.sectorAngle) % this.sectors;
        this.cells[sector].push(neighbor);
    }
    
    getVisibleSectors(blindSpotStart = 5, blindSpotEnd = 7) {
        // Return sectors outside the blind spot
        return this.cells.filter((_, i) => i < blindSpotStart || i > blindSpotEnd);
    }
}
```

### Files to Create
- `js/geodesic.js`: Geodesic perception utilities

### Files to Modify
- `js/boid.js`: Add directional neighbor filtering
- `js/opt.js`: Add `blindSpot` toggle

---

## Concept 5: Visual Fiber (State-Based Rendering)

### The Geometry
Boids have visual state (stress level, velocity, flock membership). Grouping by visual state enables batch rendering.

### The Index
A hash of visual properties that groups boids for efficient GPU draw calls.

```
Visual Hash = (stress_level << 8) | (velocity_bucket << 4) | flock_id

Buckets:
  Hash 0x00: [calm, slow boids] → Draw with blue tint
  Hash 0x10: [calm, fast boids] → Draw with cyan tint
  Hash 0x80: [stressed boids]   → Draw with red tint
```

### The Benefit
1. **Beautiful visualization**: See stress propagate through the flock
2. **GPU efficiency**: Fewer state changes between draw calls
3. **Debugging**: Instantly see which boids are in which state

### Implementation

```javascript
// js/visualfiber.js
class VisualFiber {
    constructor() {
        this.buckets = new Map();
    }
    
    clear() {
        this.buckets.clear();
    }
    
    computeHash(boid) {
        // Stress: 0-15 based on proximity to threats or edges
        const stress = Math.min(15, Math.floor(boid.stress * 16));
        
        // Velocity: 0-15 based on speed relative to max
        const speed = Math.min(15, Math.floor(boid.vel.mag() / opt.maxSpeed * 16));
        
        // Combine into 8-bit hash
        return (stress << 4) | speed;
    }
    
    insert(boid) {
        const hash = this.computeHash(boid);
        if (!this.buckets.has(hash)) {
            this.buckets.set(hash, []);
        }
        this.buckets.get(hash).push(boid);
        return hash;
    }
    
    getColor(hash) {
        const stress = (hash >> 4) & 0xF;
        const speed = hash & 0xF;
        
        // Stress: blue (0) → red (15)
        // Speed: dark (0) → bright (15)
        const r = Math.floor(stress / 15 * 255);
        const b = Math.floor((15 - stress) / 15 * 255);
        const brightness = 0.5 + (speed / 15) * 0.5;
        
        return (Math.floor(r * brightness) << 16) | 
               (Math.floor(128 * brightness) << 8) | 
               Math.floor(b * brightness);
    }
}
```

### Stress Computation

```javascript
// In boid.js
computeStress() {
    let stress = 0;
    
    // Edge stress: approaching boundaries
    const edgeDist = Math.min(this.x, this.y, g.width - this.x, g.height - this.y);
    stress += Math.max(0, 1 - edgeDist / 50);
    
    // Predator stress: if predator mode is enabled
    if (g.predator) {
        const predatorDist = this.dist(g.predator);
        stress += Math.max(0, 1 - predatorDist / 200);
    }
    
    // Crowd stress: too many neighbors
    stress += Math.max(0, (this.neighborCount - 10) / 20);
    
    return Math.min(1, stress);
}
```

### Files to Create
- `js/visualfiber.js`: Visual state batching

### Files to Modify
- `js/boid.js`: Add stress computation and visual hash
- `js/flock.js`: Group boids by visual hash for rendering

---

## Concept 6: Hyperbolic Distance (Social LOD)

### The Geometry
In social systems, influence doesn't fall off linearly. Nearby neighbors matter a lot; distant ones barely matter at all. This is hyperbolic geometry.

### The Index
Replace Euclidean distance falloff with hyperbolic distance for influence calculations.

```
Euclidean falloff:     Hyperbolic falloff:
influence              influence
    │                      │
1.0 ├──╲                1.0 ├──────╲
    │   ╲                   │       ╲
0.5 ├────╲──            0.5 ├────────╲──
    │     ╲                 │          ╲
  0 ├──────╲────          0 ├───────────╲───
    0    vision             0    vision
         distance                distance
```

### The Benefit
1. **Natural flocking**: Boids strongly follow immediate neighbors, weakly follow distant ones
2. **Sub-flock emergence**: Tight clusters form within larger flocks
3. **Infinite flock illusion**: Edge boids perceive center as infinitely dense

### Implementation

```javascript
// js/hyperbolic.js
class HyperbolicSpace {
    // Convert Euclidean distance to hyperbolic influence
    static influence(euclideanDist, maxDist) {
        const normalized = euclideanDist / maxDist;
        // Sigmoid-like falloff: sharp transition at ~0.5
        return 1 / (1 + Math.exp(8 * (normalized - 0.5)));
    }
    
    // Hyperbolic distance in Poincaré disk model
    static hyperbolicDistance(x1, y1, x2, y2, diskRadius) {
        // Normalize to unit disk
        const ax = x1 / diskRadius, ay = y1 / diskRadius;
        const bx = x2 / diskRadius, by = y2 / diskRadius;
        
        // Euclidean distance between points
        const dx = bx - ax, dy = by - ay;
        const euclidean = Math.sqrt(dx * dx + dy * dy);
        
        // Poincaré disk metric
        const denom = (1 - ax*ax - ay*ay) * (1 - bx*bx - by*by);
        if (denom <= 0) return Infinity;
        
        const delta = 2 * euclidean * euclidean / denom;
        return Math.acosh(1 + delta);
    }
    
    // Render scale based on hyperbolic distance from center
    static renderScale(x, y, centerX, centerY, maxDist) {
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const normalized = dist / maxDist;
        // Boids at edge appear smaller (receding into infinity)
        return 1 / (1 + normalized * normalized);
    }
}
```

### Application in Flocking

```javascript
// In boid.js flock() method
for (const other of neighbors) {
    const euclidean = Math.sqrt(this.sqrDist(other));
    const influence = HyperbolicSpace.influence(euclidean, opt.vision);
    
    // Weight flocking forces by hyperbolic influence
    aln.sclAdd(other.vel, influence);
    csn.sclAdd(other, influence);
    sep.sclAdd(this.separationFrom(other), influence / euclidean);
}
```

### Files to Create
- `js/hyperbolic.js`: Hyperbolic geometry utilities

### Files to Modify
- `js/boid.js`: Use hyperbolic influence in flocking calculations

---

## Concept 7: Flow Fields (Environmental Forces)

### The Geometry
Environmental forces (wind, currents, thermals) exist as vector fields in space. Sampling a field is O(1).

### The Index
A 2D grid of force vectors that boids sample based on their position.

```
┌─────┬─────┬─────┬─────┐
│  ↑  │  ↗  │  →  │  ↘  │
├─────┼─────┼─────┼─────┤
│  ↑  │  ↑  │  ↗  │  →  │  ← Wind field
├─────┼─────┼─────┼─────┤
│  ↖  │  ↑  │  ↑  │  ↗  │
└─────┴─────┴─────┴─────┘

     ╭───╮
     │ ↑ │
    ╭┴───┴╮
    │  ↑  │     ← Thermal (circular upward)
    │← ● →│
    │  ↓  │
    ╰─────╯
```

### The Benefit
1. **O(1) force lookup**: No iteration over force sources
2. **Realistic behavior**: Boids ride thermals, fight wind
3. **Visual interest**: Environmental storytelling

### Implementation

```javascript
// js/flowfield.js
class FlowField {
    constructor(cellSize = 50) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(g.width / cellSize);
        this.rows = Math.ceil(g.height / cellSize);
        this.field = new Array(this.rows).fill(null)
            .map(() => new Array(this.cols).fill(null)
                .map(() => new V2D(0, 0)));
    }
    
    // Sample the field at a position
    sample(x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
            return new V2D(0, 0);
        }
        return this.field[row][col];
    }
    
    // Add uniform wind
    addWind(direction, strength) {
        const wind = V2D.random(1).mult(strength);
        wind.x = Math.cos(direction) * strength;
        wind.y = Math.sin(direction) * strength;
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.field[row][col].add(wind);
            }
        }
    }
    
    // Add a thermal (circular upward flow)
    addThermal(centerX, centerY, radius, strength) {
        const centerCol = Math.floor(centerX / this.cellSize);
        const centerRow = Math.floor(centerY / this.cellSize);
        const cellRadius = Math.ceil(radius / this.cellSize);
        
        for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
            for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
                if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) continue;
                
                const dx = (col - centerCol) * this.cellSize;
                const dy = (row - centerRow) * this.cellSize;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < radius) {
                    const factor = 1 - dist / radius;
                    // Upward force + slight inward spiral
                    this.field[row][col].y -= strength * factor;
                    this.field[row][col].x += (dy / radius) * strength * factor * 0.3;
                }
            }
        }
    }
    
    // Add Perlin noise turbulence
    addTurbulence(strength, scale = 0.01) {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                // Simple noise approximation (replace with real Perlin if available)
                const angle = Math.sin(col * scale * 10) * Math.cos(row * scale * 10) * Math.PI * 2;
                this.field[row][col].x += Math.cos(angle) * strength;
                this.field[row][col].y += Math.sin(angle) * strength;
            }
        }
    }
    
    // Visualize the field
    draw(graphics) {
        graphics.clear();
        graphics.lineStyle(1, 0x444444, 0.5);
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = col * this.cellSize + this.cellSize / 2;
                const y = row * this.cellSize + this.cellSize / 2;
                const v = this.field[row][col];
                const mag = Math.min(v.mag() * 5, this.cellSize * 0.4);
                
                if (mag > 1) {
                    const angle = v.angle();
                    graphics.moveTo(x, y);
                    graphics.lineTo(
                        x + Math.cos(angle) * mag,
                        y + Math.sin(angle) * mag
                    );
                }
            }
        }
    }
}
```

### Application in Boid Update

```javascript
// In boid.js update() method
if (g.flowField) {
    const flow = g.flowField.sample(this.x, this.y);
    this.acc.sclAdd(flow, opt.flowStrength || 0.1);
}
```

### Files to Create
- `js/flowfield.js`: Flow field implementation

### Files to Modify
- `js/boid.js`: Sample flow field in update
- `js/main.js`: Create and manage flow fields
- `js/opt.js`: Add flow field controls

---

## Implementation Phases

### Phase 1: Foundation (Already Done)
- [x] Basic boids simulation
- [x] Spatial hash grid
- [x] Canvas/PixiJS rendering
- [x] Settings UI

### Phase 2: Core GGDP (High Impact)
- [ ] Morton-ordered iteration
- [ ] Time wheel for staggered updates
- [ ] Comparison toggle (naive vs GGDP)
- [ ] FPS/stats display

### Phase 3: Behavioral GGDP
- [ ] Geodesic perception (blind spots)
- [ ] Hyperbolic distance (social LOD)
- [ ] Flow fields (wind/thermals)

### Phase 4: Visual GGDP
- [ ] Visual fiber (stress coloring)
- [ ] Stress wave visualization
- [ ] Flow field visualization

### Phase 5: Demo Scenarios
- [ ] "Murmuration" preset (100K boids, time wheel)
- [ ] "Predator Hunt" preset (geodesic blind spots)
- [ ] "Thermal Riding" preset (flow fields)
- [ ] "Stress Wave" preset (visual fiber)

---

## File Structure After Implementation

```
chronoboids/
├── index.html
├── style.css
├── js/
│   ├── boid.js          # Modified: perception, stress, hyperbolic
│   ├── events.js
│   ├── flock.js         # Modified: Morton order, time wheel
│   ├── main.js          # Modified: GGDP initialization
│   ├── opt.js           # Modified: GGDP toggles
│   ├── settings.js
│   ├── util.js
│   ├── v2d.js
│   │
│   ├── ggdp/            # NEW: GGDP modules
│   │   ├── morton.js        # Morton codes
│   │   ├── timewheel.js     # Staggered updates
│   │   ├── geodesic.js      # Directional perception
│   │   ├── visualfiber.js   # State-based rendering
│   │   ├── hyperbolic.js    # Social distance
│   │   └── flowfield.js     # Environmental forces
│   │
│   └── scenarios/       # NEW: Demo presets
│       ├── murmuration.js
│       ├── predator.js
│       ├── thermal.js
│       └── stress.js
│
├── lib/
│   └── pixi.min.js
│
└── docs/
    ├── GGDP_IMPLEMENTATION_PLAN.md  # This file
    └── GGDP_CONCEPTS.md             # Detailed concept explanations
```

---

## Success Metrics

| Metric | Before GGDP | After GGDP | Improvement |
|--------|-------------|------------|-------------|
| Max boids @ 60 FPS | ~3,000 | 20,000+ | 6-7x |
| Max boids @ 30 FPS | ~8,000 | 100,000+ | 12x |
| Neighbor queries/frame | O(n²) | O(n) | Orders of magnitude |
| Behavioral realism | Basic | Blind spots, social hierarchy | Qualitative |
| Visual richness | Uniform | Dynamic stress/velocity | Qualitative |

---

## Testing Instructions

1. **Baseline**: Run with 5,000 boids, note FPS
2. **Enable Morton**: Toggle Morton ordering, compare FPS
3. **Enable Time Wheel**: Set to 16 slots, increase to 50,000 boids
4. **Enable Geodesic**: Add predator, watch boids get "snuck up on"
5. **Enable Visual Fiber**: Watch stress waves propagate
6. **Enable Flow Fields**: Add thermal, watch boids spiral upward

---

## References

- [Original Boids Paper (Reynolds, 1987)](http://www.cs.toronto.edu/~dt/siggraph97-course/cwr87/)
- [Morton Codes Explained](https://en.wikipedia.org/wiki/Z-order_curve)
- [Hyperbolic Geometry Visualization](https://en.wikipedia.org/wiki/Poincar%C3%A9_disk_model)
- [Flow Fields for Steering](https://gamedevelopment.tutsplus.com/tutorials/understanding-steering-behaviors-flow-field-pathfinding--gamedev-10778)

