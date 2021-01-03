/* file: fract_main.js
 */
let renderer = null;
let state = null;

function ComplexPlane() {
	const PRECISION_MIN = 0;
	const PRECISION_MAX = 1000;
	const PRECISION_DEF = 100;
	const CPLANE_X = -2.0;
	const CPLANE_Y =  1.0;
	const CPLANE_W =  2.5;
	const CPLANE_H =  2.0;
	var _rect = { x: CPLANE_X, y: CPLANE_Y, w: CPLANE_W, h: CPLANE_H };
	var _precision = PRECISION_DEF;
	
	return {
		resize: function(area, basis_length) {
			/* The complex-plane dimensions are specified by the given circle area
			 * which uses pixel coordinates that must be transformed. */
			const f = _rect.w / basis_length;

			if (!area.r || !basis_length)
				return;
			
			_rect = { x: _rect.x + (area.x - area.r) * f, y: _rect.y - (area.y - area.r) * f, w: area.r * 2 * f, h: area.r * 2 * f };
		},
		
		reset: function() {
			_rect = { x: CPLANE_X, y: CPLANE_Y, w: CPLANE_W, h: CPLANE_H };
			_precision = PRECISION_DEF;
		},
		
		get rect() { return _rect; },
		get precision() { return _precision; },
		get PRECISION_MIN() { return PRECISION_MIN; },
		get PRECISION_MAX() { return PRECISION_MAX; },
		set precision(precision) { _precision = precision; },
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
			render_worker.postMessage({query: 'mandelbrot_init', param: [img.data, cplane.rect, cplane.precision]});
			render_worker.onmessage = function(msg) {
				if (msg.data.status == 'finished') {
					progress.hidden = true;
					img = { x: reset_pos ? 0 : img.x, y: reset_pos ? 0 : img.y, data: msg.data.img };
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
			if (state.zoom_rect) {
				ctx.beginPath();
				ctx.arc(state.zoom_rect.x, state.zoom_rect.y, state.zoom_rect.r, 0, 2 * Math.PI);
				ctx.stroke();
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

function State(state) {
	var _state = state;
	var _zoom_rect = null;
	
	return {
		get zoom_rect() { return _zoom_rect; },
		set zoom_rect(zoom_rect) { _zoom_rect = zoom_rect; },
		
		get state() { return _state; },
		set state(state) { _state = state; },
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
	document.getElementById('resolution_low').checked = true;
	
	canvas.width = canvas.height = document.getElementById('resolution_low').value;
	
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		alert('Unable to initialize 2D context.');
		return;
	} else {
		ctx.strokeStyle = '#ff0';
	}
	
	renderer = new Renderer(ctx, document.getElementById('resolution_low').value);
	state = new State('move');
	
	
	for (const element of document.getElementsByName('mouse_action'))
		element.addEventListener('click', (e) => { state.state = e.target.value; });
		
	for (const element of document.getElementsByName('img_resolution'))
		element.addEventListener('click', (e) => {
			renderer.resolution = e.target.value;
			renderer.update_img_data(cplane);
	});
	
	canvas.addEventListener('mousedown', (e) => {
		if (state.state == 'zoom')
			state.zoom_rect = { x: e.offsetX, y: e.offsetY, w: 0, h: 0, r: 0 };
	});
	
	canvas.addEventListener('mouseup', () => {
		if (state.state == 'zoom') {
			if (state.zoom_rect) {
				cplane.precision = precision_input.value;
				
				cplane.resize(
					{ x: state.zoom_rect.x - renderer.img.x, y: state.zoom_rect.y - renderer.img.y, r: state.zoom_rect.r },
					renderer.resolution
				);
				
				renderer.update_img_data(cplane);
				state.zoom_rect = null;
			}
		}
	});
	
	canvas.addEventListener('mousemove', (e) => {
		if (event.buttons) {
			if (state.state == 'zoom') {
				if (state.zoom_rect) {
					let max = Math.min(state.zoom_rect.x, state.zoom_rect.y, e.target.width - state.zoom_rect.x - 1, e.target.height - state.zoom_rect.y - 1);
					let r = Math.sqrt((e.offsetX - state.zoom_rect.x) ** 2 + (e.offsetY - state.zoom_rect.y) ** 2);
					state.zoom_rect.r = r > max ? max: r;
				}
			}
			else
				renderer.update_img_pos(e.movementX, e.movementY);
		}
	});
	
	canvas.addEventListener('mouseenter', (e) => { e.target.style.cursor = state.state == 'zoom' ? 'crosshair' : 'grab'; });
		
	precision_input.addEventListener('change', () => {
		cplane.precision = precision_input.value;
		renderer.update_img_data(cplane, false);
	});
	
	precision_input.addEventListener('input', () => { precision_number.innerHTML = `(${precision_input.value})`; });
	
	document.getElementById('reset').addEventListener('click', () => {
		cplane.reset();
		precision_input.value = cplane.precision;
		precision_number.innerHTML = `(${cplane.precision})`;
		renderer.update_img_data(cplane);
	});
	
	renderer.update_img_data(cplane);
	window.requestAnimationFrame(render_frame);
}

window.onload = init;
