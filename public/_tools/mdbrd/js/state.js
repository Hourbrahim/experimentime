const page0 = {
  title: 'Page 1',
  imgs: [],
  artboard: { x: 0, y: 0, w: 1920, h: 1080 },
  currentRatio: '16:9',
  bgColor: '#ffffff',
  layoutMode: 'masonry',
  orientation: 'landscape',
  numCols: 0,
  numRows: 0,
  layoutGap: 0,
  shapeRadius: 400,
  shapeScale: 100,
  undoStack: [],
};

export const state = {
  // Pages
  pages: [page0],
  currentPageIdx: 0,

  // Per-page fields (shared refs with pages[0] initially)
  imgs:        page0.imgs,
  artboard:    page0.artboard,
  currentRatio: page0.currentRatio,
  bgColor:     page0.bgColor,
  layoutMode:  page0.layoutMode,
  orientation: page0.orientation,
  numCols:     page0.numCols,
  numRows:     page0.numRows,
  layoutGap:   page0.layoutGap,
  shapeRadius: page0.shapeRadius,
  shapeScale:  page0.shapeScale,
  undoStack:   page0.undoStack,

  // Global fields (not per-page)
  snapEnabled: false,
  selIdx:      -1,
  selectedIds: new Set(),
  panX: 0, panY: 0,
  zoomLevel: 1,
  uid: 0,
  // drag
  dragMode:   null,
  dragRef:    null,
  dragCorner: null,
  didDrag:    false,
  // rubber-band
  rbStart: null,
  rbEnd:   null,
  // crop mode
  cropTarget: null,   // id of image currently being cropped
  cropRect:   null,   // { x, y, w, h } normalized 0-1 within image
};
