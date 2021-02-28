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
			let skip = false;

			if (c !== undefined) {
				m = mandelbrot_calc({re: x, im: y}, c, n);
			} else {
				/* Main cardioid
				 * http://abel.math.harvard.edu/~ctm/programs/index.html
				 */
				if (x > -0.75 && x < 0.5) {
					let w = { re: 1 - 4 * x, im: -4 * y};
					if (w.re > Math.abs(w.im)) {
						w.re = Math.sqrt((w.re + Math.sqrt(w.re**2 + w.im**2)) / 2);
						w.im = w.im / (2 * w.re);
					} else {
						w.im = Math.sqrt((-w.re + Math.sqrt(w.re**2 + w.im**2)) / 2);
						w.re = (-4 * y) / (2 * w.im);
					}
					w.im = w.im**2;
					if ((w.re - 1)**2 + w.im < 1 || (w.re + 1)**2 + w.im < 1)
						skip = true;
				}

				/* Period 2 bulb (center = -1) */
				else if (x > -1.25 && x < -0.75) {
					if ((x + 1)**2 + y**2 < 0.0625)
						skip = true;
				}

				/* Period 4 bulb (center = -1.3107) */
				if ((x + 1.3107)**2 + y**2 < 0.0032)
					skip = true;

				/* Period 3 bulb (center = -0.1226 +/- 0.7449i) */
				else if ((x + 0.1226)**2 + (y-0.7449)**2 < 0.008)
					skip = true;

				else if ((x + 0.1226)**2 + (y+0.7449)**2 < 0.008)
					skip = true;
				
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
		// let t0 = performance.now();
		mandelbrot_init(msg.data.param);
		// console.log('Calculation time: ' + (performance.now() - t0) + ' ms');
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
