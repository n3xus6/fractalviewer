/* file: fract_compute.js
 *
 * The functions in this file are executed by a web worker.
 * Otherwise the heavy calculations done here would freeze
 * the main web page.
 */
function mandelbrot_calc(c, n) {
	/*
	 * z = z^2+c, with 'z' and 'c' complex numbers.
	 * If abs(z) <= 2 after 'n' iterations, 'c' belongs to the Mandelbrot set.
	 */
	let z = { re: 0, im: 0 };
	let i = 0;	
	for ( ; i < n; i++) {
		let re = z.re**2 - z.im**2 + c.re;
		let im = 2*z.re*z.im + c.im;
		z.re = re;
		z.im = im;

		if (z.re**2 + z.im**2 > 4) // Faster than 'Math.sqrt(z.re**2 + z.im**2) > 2'
			break;
			
		/* Even faster but only an approximation.
		   (https://plus.maths.org/issue9/features/mandelbrot/pas/mbrot1.pas) */
//		if (Math.abs(z.re) + Math.abs(z.im) > 2)
//			break;
		
	}
	return i;
}

/* Numbers within these regions belong to M. Skipping the test for them largely
   decreases the computation time. */
const M_skip_regions = [
	{ x0: -1.350, y0:  0.035, x1: -1.270, y1: -0.035 }, // small bulb center
	{ x0: -1.175, y0:  0.175, x1: -0.825, y1: -0.175 }, // middle bulb center
	{ x0: -0.567, y0:  0.442, x1:  0.245, y1: -0.442 }, // large bulb center
	{ x0: -0.180, y0: -0.690, x1: -0.060, y1: -0.810 }, // lower small bulb center
	{ x0: -0.180, y0:  0.810, x1: -0.060, y1:  0.690 }, // upper small bulb center
	{ x0: -0.445, y0: -0.442, x1:  0.195, y1: -0.542 }, // large bulb lower region
	{ x0: -0.445, y0:  0.542, x1:  0.195, y1:  0.442 }, // large bulb upper region
	{ x0: -0.670, y0:  0.300, x1: -0.568, y1: -0.300 }, // large bulb left region
	{ x0:  0.245, y0: -0.100, x1:  0.345, y1: -0.300 }, // large bulb lower right region
	{ x0:  0.245, y0:  0.300, x1:  0.345, y1:  0.100 }, // large bulb upper right region
];

/* Initialize the image data 'img'. The complex plane area is specified
   by 'c1' and 'c2'. */
function mandelbrot_init([img, cplane, n]) {
	const num_px = img.height * img.width;
	const r = cplane.w / img.width;
	let cur_px = 0;
	let progress = 0;
	
	for (let y = 0, b = cplane.y; y < img.height; y++, b -= r) {
		let cur_progress = 0;
		for (let x = 0, a = cplane.x; x < img.width; x++, a += r) {
			
			let skip = false;
			for (const e of M_skip_regions) {
				if (a > e.x0 && a < e.x1 && b < e.y0 && b > e.y1) {
					skip = true;
					break;
				}
			}
			
			let m = skip ? n : mandelbrot_calc({re: a, im: b}, n);
			let i = 4 * (cur_px = (y * img.width + x));
			
			if (m < n) {
				img.data[i]   = img.data[i+1] = (m+1)*0xFF/n;
				img.data[i+2] = img.data[i+3] = 0xFF;
			} else {
				img.data[i] = img.data[i+1] = img.data[i+2] = 0;
				img.data[i+3] = 0xFF;
			}
		}

		if ((cur_progress = cur_px / num_px) - progress > .05) {
			postMessage({status: 'busy', progress: cur_progress});
			progress = cur_progress;
		}
	}
	
	postMessage({status: 'finished', img: img});
}

onmessage = function(msg) {
	if (msg.data.query == 'mandelbrot_init') {
//		let t0 = performance.now();
		mandelbrot_init(msg.data.param);
//		console.log('Calculation time: ' + (performance.now() - t0) + ' ms');
	}
}
