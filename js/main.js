import { V2D, v2dPool } from './v2d.js';
import { max } from './util.js';
import { opt, select, setGlobals } from './opt.js';
import { Flock, setFlockGlobals } from './flock.js';
import { setBoidGlobals } from './boid.js';

// useful global variables
const g = {
	mouseForce: 0,

	sqVis: opt.vision * opt.vision,

	mouse: {
		x: 0,
		y: 0,
		down: false,
		over: true,
		button: 0
	},

	explode: 0,
	explodePos: new V2D(),

	nextFrame: false,

	width: window.innerWidth,
	height: window.innerHeight,

	sprites: {
		explode: (() => {
			let shape = new PIXI.Graphics();

			shape.clear();
			shape.beginFill(0x000000);
			shape.drawCircle(0, 0, 100);
			shape.endFill();

			return shape;
		})()
	},

	delta: 1,
	shapeMode: 1,

	noiseRange: (Math.PI / 80) * opt.noise,

	fps: 60
};

// PIXI app
const app = new PIXI.Application({
	width: g.width,
	height: g.height,
	antialias: true,
	transparent: false,
	resolution: window.devicePixelRatio || 1,
	autoDensity: true,
	backgroundColor: 0x161616
});

document.body.prepend(app.view);

// Inject dependencies into modules
setBoidGlobals(g, app);
setFlockGlobals(g, app);

const flock = new Flock(opt.boids);

// Now inject flock into opt for restart functionality
setGlobals(g, flock);

function loop(delta) {
	// Reset vector pool at start of each frame to reuse allocations
	v2dPool.reset();

	g.delta = delta;

	g.mouseForce = max(
		(opt.maxSpeed *
			opt.maxForce *
			(opt.alignment + opt.cohesion + opt.separation + 1)) /
			16,
		0
	);
	g.sqVis = opt.vision * opt.vision;

	if (!opt.paused) {
		flock.update();
	} else if (g.nextFrame) {
		flock.update();
		g.nextFrame = false;
	}

	flock.draw();

	if (g.explode === 1) {
		app.stage.addChild(g.sprites.explode);
	}
	if (g.explode > 0.001) {
		let s = Math.sqrt(g.explode);
		g.sprites.explode.alpha = s;
		g.sprites.explode.scale.x = s;
		g.sprites.explode.scale.y = s;

		g.explode *= 0.9;
	} else if (g.explode !== 0) {
		app.stage.removeChild(g.sprites.explode);
		g.explode = 0;
	}

	if (opt.debug) {
		// O(1) exponential moving average instead of O(n) array reduce
		g.fps = g.fps * 0.9 + (60 / delta) * 0.1;
		select("#fps").textContent = g.fps.toFixed(2);
	}

	app.render();
}

app.ticker.add(loop);

// Export for events.js
export { g, app, flock };
