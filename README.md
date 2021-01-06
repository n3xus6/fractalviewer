# fractalviewer
A Fractal Viewer implemented in JavaScript for running in web browsers.

[Directly open it](https://n3xus6.github.io/fractalviewer/fract_viewer.html)


### Running it locally

The App performs the more heavy calculations within a Web Worker thread.\
It's possible to run it without a Web Server but that requires to lower the security settings.\
This is dangerous. So never ever forget to reset these settings before continue with surfing. 

- Firefox: under `about:config` set `security.fileuri.strict_origin_policy` to `false`.

- Chrome: close all Chrome windows before then start Chrome with the option `--allow-file-access-from-files`.
