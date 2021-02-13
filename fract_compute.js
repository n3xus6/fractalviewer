/* file: fract_compute.js
 *
 * The functions in this file are executed by a web worker.
 * Otherwise the heavy calculations done here would freeze
 * the main web page.
 */
function mandelbrot_calc(z, c, n) {
	/*
	 * z = z^2+c, with 'z' and 'c' complex numbers.
	 * If abs(z) <= 2 after 'n' iterations, 'c' belongs to the Mandelbrot set.
	 */
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

/* Numbers within these regions belong to M (only an approximation).
   Skipping the test for them largely decreases the computation time. However,
   it would be also possible, and nicer, to quickly calculate if c is in the
   main cardioid or the period 2 component to avoid the function interation. */
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
function mandelbrot_init([img, cplane, n, iter_start, c]) {
	const num_px = img.height * img.width;
	let progress = 0;
	let iter_min = n;
	
	for (let y_px = 0, y = cplane.y; y_px < img.height; y_px++, y -= cplane.w / img.width) {
		let cur_px = 0;
		let cur_progress = 0;
		for (let x_px = 0, x = cplane.x; x_px < img.width; x_px++, x += cplane.w / img.width) {
			let m = 0;

			if (c !== undefined) {
				m = mandelbrot_calc({re: x, im: y}, c, n);
			} else {
				let skip = false;
				for (const e of M_skip_regions) {
					if (x > e.x0 && x < e.x1 && y < e.y0 && y > e.y1) {
						skip = true;
						break;
					}
				}
				
				/* If m == n, we consider c = x + iy as an element of M. */
				m = skip ? n : mandelbrot_calc({re: 0, im: 0}, {re: x, im: y}, n);
			}

			if (m < iter_min)
				iter_min = m;

			/* Pixels are colored depending on the iteration count.
			   Different color gradients represent small, moderate and large
			   iteration counts. Black pixels represent the c values in M.
			   Considering the smallest iteration count from the previous
			   calculation when doing the color mapping offers more details
			   in the picture. */
			let i = 4 * (cur_px = (y_px * img.width + x_px));
			const f = ((n - iter_start) / 5);
			
			if (m - iter_start < f) // Red -> Yellow
				[ img.data[i++], img.data[i++], img.data[i++] ] = [255, 255 * (m - iter_start) / f, 0];
			else if (m - iter_start < 2*f) // Yellow -> Green
				[ img.data[i++], img.data[i++], img.data[i++] ] = [255 * (2 - ((m - iter_start)/f)), 255, 0];
			else if (m - iter_start < 3*f) // Green -> Cyan
				[ img.data[i++], img.data[i++], img.data[i++] ] = [0, 255, 255 * ((m - iter_start)/f - 2)];
			else if (m - iter_start < 4*f) // Cyan -> Blue
				[ img.data[i++], img.data[i++], img.data[i++] ] = [0, 255 * (4 - ((m - iter_start)/f)), 255];
			else if (m - iter_start < 5*f) // Blue -> Purple
				[ img.data[i++], img.data[i++], img.data[i++] ] = [255 * ((m - iter_start)/f - 4), 0, 255];
			else // Black
				[ img.data[i++], img.data[i++], img.data[i++] ] = [0, 0, 0];
			img.data[i] = 0xff;
		}

		if ((cur_progress = cur_px / num_px) - progress > .05) {
			postMessage({status: 'busy', progress: cur_progress});
			progress = cur_progress;
		}
	}
	
	postMessage({status: 'finished', img: img, iter_min: iter_min});
}

onmessage = function(msg) {
	if (msg.data.query == 'mandelbrot_init') {
//		let t0 = performance.now();
		mandelbrot_init(msg.data.param);
//		console.log('Calculation time: ' + (performance.now() - t0) + ' ms');
	}
}


/* From the book "The Beauty of Fractals", Springer-Verlag
 *
 * Julia set example c values:
 * 
 *  { re: -0.12375,  im:  0.56508  }
 *  { re: -0.12,     im:  0.74     }
 *  { re: -0.481762, im: -0.531657 }
 *  { re: -0.39054,  im: -0.58679  }
 *  { re:  0.27334,  im:  0.00742  }
 *  { re: -1.25,     im:  0        }
 *  { re: -0.11,     im:  0.6557   }
 *  { re:  0.11031,  im: -0.67037  }
 *  { re:  0,        im:  1        }
 *  { re: -0.194,    im:  0.6557   }
 *  { re: -0.15652 , im:  1.03225  }
 *  { re: -0.74543,  im:  0.11301  }
 *  { re:  0.32,     im:  0.043    }
 */
