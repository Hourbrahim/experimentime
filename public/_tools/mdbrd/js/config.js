export const PANEL_W    = 200;
export const TOOLBAR_H  = 0;   // legacy – kept so imports don't break
export const PAGEBAR_H  = 44;
export const MIN_ZOOM  = 0.2;
export const MAX_ZOOM  = 3.0;
export const SNAP_GRID = 50;
export const SNAP_THR  = 20;
export const UNDO_MAX  = 20;
// Base presets — always defined in their natural orientation.
// Orientation buttons swap w/h independently; no mirrored entries needed.
export const ARTBOARD_PRESETS = {
  '16:9':   {w:1920, h:1080},  // landscape native
  '1:1':    {w:1080, h:1080},  // square
  '4:5':    {w:1080, h:1350},  // portrait  (Instagram)
  '3:4':    {w:1080, h:1440},  // portrait
  '1:2':    {w:1080, h:2160},  // portrait  (tall / phone)
  'A4':     {w:2480, h:3508},  // portrait  (210×297 mm @ 300 dpi)
  'Letter': {w:2550, h:3300},  // portrait  (8.5×11 in @ 300 dpi)
};
