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
		if (Math.sqrt(z.re**2 + z.im**2) > 2)
			break;
	}
	return i;
}

/* Initialize the image data 'img'. The complex plane area is specified
   by 'c1' and 'c2'. */
function mandelbrot_init([img, cplane, n]) {
	const num_px = img.height * img.width;
	const r = cplane.w / img.width;
	let progress = { new: 0, old: 0};
	
	for (let y = 0, b = cplane.y; y < img.height; y++, b -= r) {
		for (let x = 0, a = cplane.x; x < img.width; x++, a += r) {
			let m = mandelbrot_calc({re: a, im: b}, n);
			let cur_px = (y * img.width + x);
			let i = 4 * cur_px;
			
			if (m < n) {
				img.data[i]   = img.data[i+1] = (m+1)*0xFF/n;
				img.data[i+2] = img.data[i+3] = 0xFF;
			} else {
				img.data[i] = img.data[i+1] = img.data[i+2] = 0;
				img.data[i+3] = 0xFF;
			}
			
			if ((progress.new = cur_px / num_px) - progress.old > .05) {
				postMessage({status: 'busy', progress: progress.new});
				progress.old = progress.new;
			}
		}
	}
	
	postMessage({status: 'finished', progress: progress.new, img: img});
}

onmessage = function(msg) {
	if (msg.data.query == 'mandelbrot_init')
		mandelbrot_init(msg.data.param);
}
