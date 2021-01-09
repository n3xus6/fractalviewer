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

/* Values inside these areas are known to belong to the Mandelbrot set.
   The data is used to speed-up calculation.
   TODO: optimize. */
const mbrot_known = [
	{ x: -1.35,  y:  0.03,  w: 0.087, h: 0.056  },
	{ x: -1.17,  y:  0.16,  w: 0.35,  h: 0.33   },
	{ x: -0.186, y:  0.806, w: 0.124, h: 0.128  },
	{ x: -0.183, y: -0.678, w: 0.120, h: 0.125  },
	{ x: -0.534, y:  0.46,  w: 0.77,  h: 0.9    },
	{ x: -0.310, y:  0.608, w: 0.380, h: 0.072  },
	{ x:  0.255, y:  0.381, w: 0.072, h: 0.307  },
	{ x: -0.409, y: -0.529, w: 0.566, h: 0.0378 },
	{ x:  0.258, y: -0.045, w: 0.048, h: 0.373  }
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
			for (const e of mbrot_known) {
				if (a > e.x && a < e.x + e.w && b < e.y && b > e.y - e.h) {
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
