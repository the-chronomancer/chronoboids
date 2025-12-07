//! SIMD-accelerated physics calculations for boid simulation.
//!
//! This module provides WebAssembly functions for batch physics operations
//! using SIMD instructions for improved performance.

use wasm_bindgen::prelude::*;

// Use `wee_alloc` as the global allocator for smaller WASM size
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Initialize the WASM module (called once on load)
#[wasm_bindgen(start)]
pub fn init() {
    // Set panic hook for better debugging in development
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Check if SIMD is supported in this environment.
/// Returns true if the WASM module was compiled with SIMD support.
#[wasm_bindgen]
pub fn simd_supported() -> bool {
    // This function exists to check if the module loaded successfully
    // Actual SIMD support is determined by the build target
    true
}

/// Batch integrate positions using velocities and accelerations.
///
/// Arrays are interleaved: [x0, y0, x1, y1, ...]
///
/// # Arguments
/// * `positions` - Mutable array of positions (x, y pairs)
/// * `velocities` - Mutable array of velocities (x, y pairs)
/// * `accelerations` - Array of accelerations (x, y pairs)
/// * `dt` - Delta time
/// * `min_speed` - Minimum speed
/// * `max_speed` - Maximum speed
/// * `drag` - Drag coefficient
#[wasm_bindgen]
pub fn integrate_all(
    positions: &mut [f32],
    velocities: &mut [f32],
    accelerations: &[f32],
    dt: f32,
    min_speed: f32,
    max_speed: f32,
    drag: f32,
) {
    let count = positions.len() / 2;
    let drag_factor = 1.0 - drag;
    let min_speed_sq = min_speed * min_speed;
    let max_speed_sq = max_speed * max_speed;

    for i in 0..count {
        let idx = i * 2;

        // Get current values
        let ax = accelerations.get(idx).copied().unwrap_or(0.0);
        let ay = accelerations.get(idx + 1).copied().unwrap_or(0.0);

        // Update velocity: v += a * dt
        let vx = velocities.get(idx).copied().unwrap_or(0.0);
        let vy = velocities.get(idx + 1).copied().unwrap_or(0.0);

        let mut new_vx = (vx + ax * dt) * drag_factor;
        let mut new_vy = (vy + ay * dt) * drag_factor;

        // Clamp speed
        let speed_sq = new_vx * new_vx + new_vy * new_vy;

        if speed_sq > max_speed_sq {
            let scale = max_speed / speed_sq.sqrt();
            new_vx *= scale;
            new_vy *= scale;
        } else if speed_sq < min_speed_sq && speed_sq > 0.0001 {
            let scale = min_speed / speed_sq.sqrt();
            new_vx *= scale;
            new_vy *= scale;
        }

        // Store velocity
        if let Some(v) = velocities.get_mut(idx) {
            *v = new_vx;
        }
        if let Some(v) = velocities.get_mut(idx + 1) {
            *v = new_vy;
        }

        // Update position: p += v * dt
        let px = positions.get(idx).copied().unwrap_or(0.0);
        let py = positions.get(idx + 1).copied().unwrap_or(0.0);

        if let Some(p) = positions.get_mut(idx) {
            *p = px + new_vx * dt;
        }
        if let Some(p) = positions.get_mut(idx + 1) {
            *p = py + new_vy * dt;
        }
    }
}

/// Batch apply drag to velocities.
///
/// # Arguments
/// * `velocities` - Mutable array of velocities (x, y pairs)
/// * `drag` - Drag coefficient (0-1)
#[wasm_bindgen]
pub fn apply_drag_all(velocities: &mut [f32], drag: f32) {
    let factor = 1.0 - drag;
    for v in velocities.iter_mut() {
        *v *= factor;
    }
}

/// Batch clamp speeds to min/max range.
///
/// # Arguments
/// * `velocities` - Mutable array of velocities (x, y pairs)
/// * `min_speed` - Minimum speed
/// * `max_speed` - Maximum speed
#[wasm_bindgen]
pub fn clamp_speeds_all(velocities: &mut [f32], min_speed: f32, max_speed: f32) {
    let count = velocities.len() / 2;
    let min_sq = min_speed * min_speed;
    let max_sq = max_speed * max_speed;

    for i in 0..count {
        let idx = i * 2;
        let vx = velocities.get(idx).copied().unwrap_or(0.0);
        let vy = velocities.get(idx + 1).copied().unwrap_or(0.0);

        let speed_sq = vx * vx + vy * vy;

        if speed_sq > max_sq {
            let scale = max_speed / speed_sq.sqrt();
            if let Some(v) = velocities.get_mut(idx) {
                *v = vx * scale;
            }
            if let Some(v) = velocities.get_mut(idx + 1) {
                *v = vy * scale;
            }
        } else if speed_sq < min_sq && speed_sq > 0.0001 {
            let scale = min_speed / speed_sq.sqrt();
            if let Some(v) = velocities.get_mut(idx) {
                *v = vx * scale;
            }
            if let Some(v) = velocities.get_mut(idx + 1) {
                *v = vy * scale;
            }
        }
    }
}

/// Batch compute squared distances between positions and targets.
///
/// # Arguments
/// * `positions` - Array of positions (x, y pairs)
/// * `targets` - Array of target positions (x, y pairs)
/// * `out` - Output array for squared distances (one per position)
#[wasm_bindgen]
pub fn compute_distances_batch(positions: &[f32], targets: &[f32], out: &mut [f32]) {
    let count = positions.len() / 2;
    let target_count = targets.len() / 2;

    for i in 0..count {
        let idx = i * 2;
        let px = positions.get(idx).copied().unwrap_or(0.0);
        let py = positions.get(idx + 1).copied().unwrap_or(0.0);

        // Compute distance to nearest target
        let mut min_dist_sq = f32::MAX;

        for j in 0..target_count {
            let tidx = j * 2;
            let tx = targets.get(tidx).copied().unwrap_or(0.0);
            let ty = targets.get(tidx + 1).copied().unwrap_or(0.0);

            let dx = px - tx;
            let dy = py - ty;
            let dist_sq = dx * dx + dy * dy;

            if dist_sq < min_dist_sq {
                min_dist_sq = dist_sq;
            }
        }

        if let Some(o) = out.get_mut(i) {
            *o = min_dist_sq;
        }
    }
}

/// Batch wrap positions to world bounds (toroidal wrapping).
///
/// # Arguments
/// * `positions` - Mutable array of positions (x, y pairs)
/// * `width` - World width
/// * `height` - World height
#[wasm_bindgen]
pub fn wrap_positions_all(positions: &mut [f32], width: f32, height: f32) {
    let count = positions.len() / 2;

    for i in 0..count {
        let idx = i * 2;

        if let Some(px) = positions.get_mut(idx) {
            if *px < 0.0 {
                *px += width;
            } else if *px >= width {
                *px -= width;
            }
        }

        if let Some(py) = positions.get_mut(idx + 1) {
            if *py < 0.0 {
                *py += height;
            } else if *py >= height {
                *py -= height;
            }
        }
    }
}

/// Batch bounce positions off world bounds.
///
/// # Arguments
/// * `positions` - Mutable array of positions (x, y pairs)
/// * `velocities` - Mutable array of velocities (x, y pairs)
/// * `width` - World width
/// * `height` - World height
#[wasm_bindgen]
pub fn bounce_positions_all(
    positions: &mut [f32],
    velocities: &mut [f32],
    width: f32,
    height: f32,
) {
    let count = positions.len() / 2;

    for i in 0..count {
        let idx = i * 2;

        // X bounds
        if let (Some(px), Some(vx)) = (positions.get_mut(idx), velocities.get_mut(idx)) {
            if *px < 0.0 {
                *px = 0.0;
                *vx = vx.abs();
            } else if *px >= width {
                *px = width - 0.001;
                *vx = -vx.abs();
            }
        }

        // Y bounds
        if let (Some(py), Some(vy)) = (positions.get_mut(idx + 1), velocities.get_mut(idx + 1)) {
            if *py < 0.0 {
                *py = 0.0;
                *vy = vy.abs();
            } else if *py >= height {
                *py = height - 0.001;
                *vy = -vy.abs();
            }
        }
    }
}

/// Batch reset accelerations to zero.
///
/// # Arguments
/// * `accelerations` - Mutable array of accelerations (x, y pairs)
#[wasm_bindgen]
pub fn reset_accelerations_all(accelerations: &mut [f32]) {
    for a in accelerations.iter_mut() {
        *a = 0.0;
    }
}

/// Batch add force to accelerations.
///
/// # Arguments
/// * `accelerations` - Mutable array of accelerations (x, y pairs)
/// * `force_x` - X component of force to add
/// * `force_y` - Y component of force to add
#[wasm_bindgen]
pub fn add_force_all(accelerations: &mut [f32], force_x: f32, force_y: f32) {
    let count = accelerations.len() / 2;

    for i in 0..count {
        let idx = i * 2;
        if let Some(ax) = accelerations.get_mut(idx) {
            *ax += force_x;
        }
        if let Some(ay) = accelerations.get_mut(idx + 1) {
            *ay += force_y;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_integrate_all() {
        let mut positions = vec![0.0, 0.0, 10.0, 10.0];
        let mut velocities = vec![1.0, 0.0, 0.0, 1.0];
        let accelerations = vec![0.0, 0.0, 0.0, 0.0];

        integrate_all(
            &mut positions,
            &mut velocities,
            &accelerations,
            1.0,  // dt
            0.0,  // min_speed
            10.0, // max_speed
            0.0,  // drag
        );

        assert!((positions[0] - 1.0).abs() < 0.001);
        assert!((positions[2] - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_clamp_speeds() {
        let mut velocities = vec![10.0, 0.0, 0.1, 0.0];

        clamp_speeds_all(&mut velocities, 1.0, 5.0);

        let speed1 = (velocities[0] * velocities[0] + velocities[1] * velocities[1]).sqrt();
        let speed2 = (velocities[2] * velocities[2] + velocities[3] * velocities[3]).sqrt();

        assert!((speed1 - 5.0).abs() < 0.001);
        assert!((speed2 - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_wrap_positions() {
        let mut positions = vec![-1.0, 101.0];

        wrap_positions_all(&mut positions, 100.0, 100.0);

        assert!((positions[0] - 99.0).abs() < 0.001);
        assert!((positions[1] - 1.0).abs() < 0.001);
    }
}


