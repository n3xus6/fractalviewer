/* file: fract_main.js
 */
let renderer = null;
let state = null;

function ComplexPlane() {
	const PRECISION_MIN = 0;
	const PRECISION_MAX = 1000;
	const PRECISION_DEF = 100;
	const CPLANE_X = -2.5;
	const CPLANE_Y =  2.5;
	const CPLANE_SIZE = 5;
	var _rect = { x: CPLANE_X, y: CPLANE_Y, w: CPLANE_SIZE, h: CPLANE_SIZE };
	var _precision = PRECISION_DEF;
	var _iter_start = 0;
	
	return {
		resize: function(section, basis_length) {
			/* The complex-plane dimensions are specified by the given rectangle
			 * which uses pixel coordinates that must be transformed. */
			const f = _rect.w / basis_length;

			if (!section.w || !section.h || !basis_length)
				return;

			let sidelength = section.w > section.h ? section.w : section.h;
			
			_rect = { x: _rect.x + section.x * f, y: _rect.y - section.y * f, w: sidelength * f, h: sidelength * f };
		},
		
		reset: function() {
			_rect = { x: CPLANE_X, y: CPLANE_Y, w: CPLANE_SIZE, h: CPLANE_SIZE };
			_precision = PRECISION_DEF;
			_iter_start = 0;
		},
		
		get rect() { return _rect; },
		get precision() { return _precision; },
		get PRECISION_MIN() { return PRECISION_MIN; },
		get PRECISION_MAX() { return PRECISION_MAX; },
		get iter_start() { return _iter_start; },
		set precision(precision) { _precision = precision; },
		set iter_start(iter_start) { _iter_start = iter_start},
	};
}

function Renderer(ctx, resolution) {
	var ctx = ctx;
	var _resolution = resolution;
	var img = { x: 0, y: 0, data: ctx.createImageData(resolution, resolution) };
	var render_worker = null;
	
	return {
		update_img_data: function(cplane, reset_pos=true) {
			const progress = document.getElementById('progress_bar');
			progress.value = 0;
			progress.hidden = false;
			
			/* Delegate computation of fractal to worker thread. */
			if (render_worker)
				render_worker.terminate();
			
			render_worker = new Worker('fract_compute.js');
			render_worker.postMessage({query: 'mandelbrot_init', param: [img.data, cplane.rect, cplane.precision, cplane.iter_start, state.fractal_type == 'julia' ? state.c : undefined]});
			render_worker.onmessage = function(msg) {
				if (msg.data.status == 'finished') {
					progress.hidden = true;
					cplane.iter_start = msg.data.iter_min;
					img = { x: reset_pos ? 0 : img.x, y: reset_pos ? 0 : img.y, data: msg.data.img };
					// console.log(cplane.iter_start);
				} else {
					progress.value = msg.data.progress;	
				}
			}
		},
		
		update_img_pos: function(movex, movey) {
			/* Make sure that the canvas is always completely filled with a part of the image. */
			img.y = img.y + movey > 0 ? 0 :
			        img.y + movey < ctx.canvas.height - img.data.height ? ctx.canvas.height - img.data.height :
			        img.y + movey;
			
			img.x = img.x + movex > 0 ? 0 :
			        img.x + movex < ctx.canvas.width - img.data.width ? ctx.canvas.width - img.data.width :
			        img.x + movex;
		},
		
		draw: function() {
			ctx.putImageData(img.data, img.x, img.y);
			if (state.zoom_rect && state.zoom_rect.w > 0) {
				/* Draw Zoom tool */
				ctx.fillStyle = '#0004';
				ctx.fillRect(state.zoom_rect.x, state.zoom_rect.y, state.zoom_rect.w, state.zoom_rect.h);
				ctx.lineWidth = 2;
				ctx.setLineDash([4, 2]);
				ctx.strokeStyle = 'white';
				ctx.strokeRect(state.zoom_rect.x, state.zoom_rect.y, state.zoom_rect.w, state.zoom_rect.h);
				let text = '[Zoom]';
				let textMetrics = ctx.measureText(text);
				if (state.zoom_rect.w > textMetrics.width && state.zoom_rect.h > textMetrics.actualBoundingBoxAscent) {
					ctx.fillStyle = 'black';
					ctx.fillRect(state.zoom_rect.x + (state.zoom_rect.w - textMetrics.width) / 2,
					             state.zoom_rect.y + (state.zoom_rect.h - textMetrics.actualBoundingBoxAscent) / 2,
					             textMetrics.width,  textMetrics.actualBoundingBoxAscent);
					ctx.font = '18px serif';
					ctx.fillStyle = 'white';
					ctx.fillText(text, state.zoom_rect.x + (state.zoom_rect.w - textMetrics.width) / 2,
					             state.zoom_rect.y + (textMetrics.actualBoundingBoxAscent + state.zoom_rect.h) / 2);
				}
			}
		},
		
		get img() { return img; },
		
		get resolution() { return _resolution; },
		set resolution(resolution) {
			_resolution = resolution;
			img = { x: 0, y: 0, data: ctx.createImageData(resolution, resolution) };
		},
	};
}

function State(state, fractal_type) {
	const DEFAULT_C_RE = 0.27334;
	const DEFAULT_C_IM = 0.00742;
	var _state = state;
	var _fractal_type = fractal_type;
	var _zoom_rect = null;
	var _c = { re: DEFAULT_C_RE, im: DEFAULT_C_IM };
	
	return {
		get zoom_rect() { return _zoom_rect; },
		set zoom_rect(zoom_rect) { _zoom_rect = zoom_rect; },
		
		get fractal_type() { return _fractal_type; },
		set fractal_type(fractal_type) { _fractal_type = fractal_type; },

		get state() { return _state; },
		set state(state) { _state = state; },

		get c() { return _c; },
		set c(c) { _c = c; },

		reset: function() {
			_c.re = DEFAULT_C_RE;
			_c.im = DEFAULT_C_IM;
		}
	};
}

function render_frame() {
	renderer.draw();
	window.requestAnimationFrame(render_frame);
}

function init() {
	const precision_input = document.getElementById('precision');
	const precision_number = document.getElementById('precision_number');
	const canvas = document.getElementById('id_canvas');
	const cplane = new ComplexPlane();

	[precision_input.min, precision_input.max, precision_input.value] = [cplane.PRECISION_MIN, cplane.PRECISION_MAX, cplane.precision];
	precision_number.innerHTML = `(${cplane.precision})`;
	
	document.getElementById('mouse_move').checked = true;
	document.getElementById('fractal_mandelbrot').checked = true;
	document.getElementById('resolution_low').checked = true;
	
	canvas.width = canvas.height = document.getElementById('resolution_low').value;
	
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		alert('Unable to initialize 2D context.');
		return;
	}
	
	renderer = new Renderer(ctx, canvas.width);
	state = new State('move', 'mandelbrot');
	
	
	for (const element of document.getElementsByName('mouse_action'))
		element.addEventListener('click', (e) => { state.state = e.target.value; });
	
	for (const element of document.getElementsByName('fractal_selection'))
		element.addEventListener('click', (e) => {
			state.fractal_type = e.target.value;
			renderer.update_img_data(cplane);
	});
		
	for (const element of document.getElementsByName('img_resolution'))
		element.addEventListener('click', (e) => {
			renderer.resolution = e.target.value;
			renderer.update_img_data(cplane);
	});

	canvas.addEventListener('click', (e) => {
		if (state.state == 'pick_c')
		{
			state.c = { re: Number(document.getElementById('c1').value), im: Number(document.getElementById('c2').value) };
			if (state.fractal_type == 'julia')
				renderer.update_img_data(cplane);
		}
	});
	
	canvas.addEventListener('mousedown', (e) => {
		if (state.state == 'zoom')
			state.zoom_rect = { x: e.offsetX, y: e.offsetY, w: 0, h: 0 };
	});
	
	canvas.addEventListener('mouseup', (e) => {
		if (state.state == 'zoom') {
			if (state.zoom_rect && state.zoom_rect.w && state.zoom_rect.h) {
				cplane.precision = precision_input.value;
				
				cplane.resize(
					{ x: state.zoom_rect.x - renderer.img.x, y: state.zoom_rect.y - renderer.img.y, w: state.zoom_rect.w, h: state.zoom_rect.h },
					renderer.resolution
				);
				
				renderer.update_img_data(cplane);
				state.zoom_rect = null;
			}
		}
	});
	
	canvas.addEventListener('mousemove', (e) => {

		document.getElementById('c1').value = cplane.rect.x + (e.offsetX - renderer.img.x) * (cplane.rect.w / renderer.resolution);
		document.getElementById('c2').value = cplane.rect.y - (e.offsetY - renderer.img.y) * (cplane.rect.h / renderer.resolution);

		if (e.buttons) {
			if (state.state == 'zoom') {
				if (state.zoom_rect) {
					if (e.offsetX > state.zoom_rect.x && e.offsetY > state.zoom_rect.y) {
						state.zoom_rect.w = e.offsetX - state.zoom_rect.x;
						state.zoom_rect.h = e.offsetY - state.zoom_rect.y;
					}
				}
			}
			else if (state.state == 'move') {
				renderer.update_img_pos(e.movementX, e.movementY);
			}
		}
	});
	
	canvas.addEventListener('mouseenter', (e) => { e.target.style.cursor = state.state == 'zoom' ? 'zoom-in' : state.state == 'pick_c' ? 'crosshair' : 'grab'; });
		
	precision_input.addEventListener('change', () => {
		cplane.precision = precision_input.value;
		renderer.update_img_data(cplane, false);
	});
	
	precision_input.addEventListener('input', () => { precision_number.innerHTML = `(${precision_input.value})`; });
	
	document.getElementById('reset').addEventListener('click', () => {
		cplane.reset();
		state.reset();
		precision_input.value = cplane.precision;
		precision_number.innerHTML = `(${cplane.precision})`;
		renderer.update_img_data(cplane);
	});
	
	renderer.update_img_data(cplane);
	window.requestAnimationFrame(render_frame);
}

window.onload = init;
