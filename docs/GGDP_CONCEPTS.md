# Geometry-Guided Dynamic Programming (GGDP)

## A Framework for Optimizing Real-Time Systems

GGDP is a design philosophy for transforming expensive runtime computations into cheap lookups by exploiting the geometric structure inherent in your problem domain.

---

## The Core Insight

Most performance problems in real-time systems come from **combinatorial explosion**:

```
for each entity:           # n
    for each target:       # m
        for each ability:  # k
            evaluate()     # Total: O(n × m × k)
```

But these loops often have **hidden geometric structure**:
- Not all targets are nearby (spatial geometry)
- Not all abilities are available now (temporal geometry)  
- Not all entities are relevant (perceptual geometry)
- Not all combinations are meaningfully different (decision geometry)

**GGDP exploits this structure** to replace scans with lookups.

---

## The Five Steps of GGDP

### Step 1: Identify Combinatorial Hot Paths

Find the nested loops that dominate your runtime. Look for patterns like:

```javascript
// Spatial: "for each entity, check all other entities"
for (const unit of units) {
    for (const target of allTargets) {
        if (inRange(unit, target)) { ... }
    }
}

// Temporal: "for each tick, check all scheduled events"
for (const event of allEvents) {
    if (event.time <= currentTime) { ... }
}

// Decision: "for each situation, evaluate all options"
for (const option of allOptions) {
    const score = evaluate(situation, option);
}
```

### Step 2: Extract Latent Geometry

Ask: **What structure does this domain already have?**

| Geometry Type | Questions to Ask | Examples |
|---------------|------------------|----------|
| **Spatial** | Where are things? How far apart? What's visible? | Positions, distances, line of sight |
| **Temporal** | When do things happen? What's urgent? What's scheduled? | Ticks, cooldowns, deadlines |
| **Influence** | What affects what? How strongly? | Damage falloff, social networks, heat maps |
| **Perceptual** | What can be seen? What matters to the viewer? | Camera frustum, LOD, attention |
| **Decision** | What situations recur? What patterns repeat? | State hashes, decision trees |

### Step 3: Design Geometry-Aligned Indexes

Choose data structures that match your geometry:

| Geometry | Index Structure | Query Type |
|----------|-----------------|------------|
| Spatial (2D/3D) | Grid, Quadtree, Octree, Spatial Hash | "What's near point P?" |
| Spatial (sorted) | Morton/Hilbert curves | "Iterate in cache-friendly order" |
| Temporal | Time wheel, Priority queue, Bucket queue | "What happens in next N ticks?" |
| Influence | Field/grid of values, Gradient map | "What's the force at point P?" |
| Perceptual | Frustum, LOD levels, Attention buckets | "What's visible/important?" |
| Decision | Hash table, Transposition table | "Have I seen this situation?" |

### Step 4: Precompute Using DP-Style Mechanics

Build and maintain indexes during "free" time:
- **Load time**: Static geometry, navigation meshes
- **Turn boundaries**: Recalculate influence maps
- **Background tasks**: Incremental updates
- **On change**: Update only affected regions

Use classic DP patterns:
- **Memoization**: Cache expensive calculations
- **Incremental update**: Don't rebuild from scratch
- **Lazy evaluation**: Only compute when queried

### Step 5: Route Hot Queries Through Indexes

Replace direct iteration with indexed lookups:

```javascript
// BEFORE: O(n) scan
for (const target of allTargets) {
    if (distance(unit, target) < range) {
        nearbyTargets.push(target);
    }
}

// AFTER: O(1) lookup + O(k) for k results
const nearbyTargets = spatialGrid.queryRadius(unit.x, unit.y, range);
```

---

## Geometry Types in Detail

### Spatial Geometry

**The insight**: Most entities only interact with nearby entities.

**Structures**:
- **Uniform Grid**: O(1) insert/query, best for uniform distribution
- **Spatial Hash**: Like grid but handles infinite space
- **Quadtree/Octree**: Adaptive, good for clustered entities
- **R-tree**: Best for rectangles/complex shapes
- **Morton Codes**: Sort by space-filling curve for cache locality

**Example**: Collision detection
```javascript
// Instead of checking all n² pairs
for (const a of entities) {
    const nearby = grid.query(a.x, a.y, a.radius * 2);
    for (const b of nearby) {
        if (collides(a, b)) handleCollision(a, b);
    }
}
```

### Temporal Geometry

**The insight**: Most events don't happen every tick.

**Structures**:
- **Time Wheel**: Circular buffer of buckets, O(1) insert/advance
- **Bucket Queue**: Like time wheel but for priorities
- **Hierarchical Timing Wheels**: Multiple resolutions (ms, sec, min)

**Example**: Ability cooldowns
```javascript
// Instead of checking all abilities every frame
class TimeWheel {
    advance() {
        const expired = this.buckets[this.current];
        this.current = (this.current + 1) % this.size;
        return expired; // Only abilities ready NOW
    }
}
```

### Influence Geometry

**The insight**: Influence can be precomputed into fields.

**Structures**:
- **Scalar Field**: 2D grid of values (danger, heat, flow)
- **Vector Field**: 2D grid of directions (wind, currents)
- **Gradient Map**: Precomputed pathfinding directions

**Example**: Danger avoidance
```javascript
// Instead of summing danger from all enemies
const danger = dangerField.sample(unit.x, unit.y);  // O(1)
if (danger > threshold) flee();
```

### Perceptual Geometry

**The insight**: Only process what matters to the viewer.

**Structures**:
- **Frustum**: Camera's visible volume
- **LOD Buckets**: Group by distance from camera
- **Attention Hierarchy**: Important things update more often

**Example**: Rendering
```javascript
// Instead of rendering all entities
const visible = frustum.query(allEntities);
for (const entity of visible) {
    const lod = lodBucket(entity.distanceToCamera);
    render(entity, lod);
}
```

### Decision Geometry

**The insight**: Similar situations have similar solutions.

**Structures**:
- **Transposition Table**: Hash of game state → best move
- **Situation Cache**: Hash of local context → cached decision
- **Pattern Database**: Precomputed heuristics for common patterns

**Example**: AI decisions
```javascript
const situationHash = hashLocalState(unit);
if (decisionCache.has(situationHash)) {
    return decisionCache.get(situationHash);
}
const decision = expensiveAICalculation(unit);
decisionCache.set(situationHash, decision);
return decision;
```

---

## GGDP vs Traditional Optimization

| Traditional | GGDP |
|-------------|------|
| Profile → find slow function → optimize it | Find hot path → identify geometry → design index |
| Micro-optimize inner loops | Eliminate loops entirely |
| Cache individual results | Cache structural relationships |
| Optimize what you have | Redesign around geometry |

**GGDP is architectural**, not just algorithmic. It changes how you structure data, not just how you process it.

---

## When to Use GGDP

✅ **Good candidates**:
- Spatial simulations (games, physics)
- Scheduling systems (events, tasks)
- AI with many entities
- Real-time data processing
- Any O(n²) or worse algorithm

❌ **Poor candidates**:
- Already O(n) or O(n log n)
- Truly random access patterns
- Small fixed-size problems
- One-time computations

---

## Common GGDP Patterns

### Pattern 1: Spatial Partitioning
```
Problem: O(n²) collision/neighbor checks
Solution: Grid/tree → O(n) with small constant
```

### Pattern 2: Temporal Bucketing
```
Problem: Check all events every tick
Solution: Time wheel → Only check current bucket
```

### Pattern 3: Influence Baking
```
Problem: Sum influences from all sources
Solution: Precompute influence field → O(1) sample
```

### Pattern 4: LOD by Importance
```
Problem: Process all entities equally
Solution: Update important things more often
```

### Pattern 5: Decision Caching
```
Problem: Recalculate same decisions
Solution: Hash situation → lookup cached result
```

---

## Implementation Checklist

When applying GGDP to a system:

- [ ] **Identify the hot path**: What loop dominates runtime?
- [ ] **Measure baseline**: How slow is it? At what scale?
- [ ] **Find the geometry**: Spatial? Temporal? Influence? Perceptual?
- [ ] **Choose index structure**: Grid? Tree? Wheel? Field?
- [ ] **Determine update strategy**: When to rebuild? Incremental?
- [ ] **Implement query interface**: What questions does the hot path ask?
- [ ] **Route queries through index**: Replace loops with lookups
- [ ] **Measure improvement**: How much faster? At what scale?
- [ ] **Add toggle**: Allow A/B comparison for validation

---

## Further Reading

- **Computational Geometry**: Foundations of spatial data structures
- **Game Programming Patterns**: Spatial partition, update method, dirty flag
- **Real-Time Collision Detection**: Comprehensive spatial indexing
- **Dynamic Programming**: The "DP" in GGDP - memoization, optimal substructure
- **Database Indexing**: B-trees, hash indexes, query optimization

---

## Summary

GGDP transforms performance problems by:

1. **Recognizing** that most data has geometric structure
2. **Building** indexes that match that structure
3. **Precomputing** during idle time
4. **Querying** instead of scanning

The result: Algorithms that were O(n²) become O(n) or O(1), enabling real-time systems to scale to orders of magnitude more entities.

---

*"The fastest code is code that doesn't run. GGDP helps you not run most of your code."*

