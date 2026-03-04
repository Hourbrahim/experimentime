import { createSketch } from './sketch.js';
// p5 is loaded as a global via the CDN <script> tag in index.html
new p5(createSketch); // eslint-disable-line no-undef
