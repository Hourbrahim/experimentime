import { state }                              from './state.js';
import { fitScreen }                          from './viewport.js';
import { syncPageUI }                         from './ui.js';
import { scheduleSave, deleteBlobForImage }   from './persist.js';

function makePageData(n) {
  return {
    title: `Page ${n}`,
    imgs: [],
    artboard: { x: 0, y: 0, w: 1920, h: 1080 },
    currentRatio: '16:9',
    bgColor: '#ffffff',
    layoutMode: 'masonry',
    orientation: 'landscape',
    numCols: 0,
    numRows: 0,
    layoutGap: 0,
    undoStack: [],
  };
}

function flushPage() {
  const p = state.pages[state.currentPageIdx];
  p.imgs        = state.imgs;
  p.artboard    = state.artboard;
  p.currentRatio = state.currentRatio;
  p.bgColor     = state.bgColor;
  p.layoutMode  = state.layoutMode;
  p.orientation = state.orientation;
  p.numCols     = state.numCols;
  p.numRows     = state.numRows;
  p.layoutGap   = state.layoutGap;
  p.undoStack   = state.undoStack;
}

function applyPage(idx) {
  const p = state.pages[idx];
  state.currentPageIdx = idx;
  state.imgs        = p.imgs;
  state.artboard    = p.artboard;
  state.currentRatio = p.currentRatio;
  state.bgColor     = p.bgColor;
  state.layoutMode  = p.layoutMode;
  state.orientation = p.orientation;
  state.numCols     = p.numCols;
  state.numRows     = p.numRows   || 0;
  state.layoutGap   = p.layoutGap ?? 0;
  state.undoStack   = p.undoStack;
  state.selectedIds.clear();
  state.selIdx = -1;
}

export function switchPage(idx) {
  if (idx === state.currentPageIdx) return;
  flushPage();
  applyPage(idx);
  renderPageBar();
  syncPageUI();
  fitScreen();
  scheduleSave();
}

export function addPage() {
  flushPage();
  const n = state.pages.length + 1;
  state.pages.push(makePageData(n));
  applyPage(state.pages.length - 1);
  renderPageBar();
  syncPageUI();
  fitScreen();
  scheduleSave();
}

export function deletePage(idx) {
  if (state.pages.length <= 1) return;
  const cur = state.currentPageIdx;

  // Grab the images to clean up before modifying the array
  const deletedImgs = idx === cur ? state.imgs : state.pages[idx].imgs;

  if (idx === cur) {
    const target = idx > 0 ? idx - 1 : 1;
    applyPage(target);
    state.pages.splice(idx, 1);
    state.currentPageIdx = target < idx ? target : target - 1;
  } else if (idx < cur) {
    state.pages.splice(idx, 1);
    state.currentPageIdx = cur - 1;
  } else {
    state.pages.splice(idx, 1);
  }

  // Revoke blob URLs and clean up from IDB
  for (const im of deletedImgs) {
    if (im.url) URL.revokeObjectURL(im.url);
    deleteBlobForImage(im.id);
  }

  renderPageBar();
  syncPageUI();
  scheduleSave();
}

export function renderPageBar() {
  const tabs = document.getElementById('page-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';

  const showDel = state.pages.length > 1;

  state.pages.forEach((page, i) => {
    const tab = document.createElement('div');
    tab.className = 'page-tab' + (i === state.currentPageIdx ? ' active' : '');

    const titleEl = document.createElement('span');
    titleEl.className = 'page-title';
    titleEl.contentEditable = 'true';
    titleEl.textContent = page.title;

    titleEl.addEventListener('mousedown', e => {
      if (i !== state.currentPageIdx) {
        e.preventDefault();
        switchPage(i);
      }
    });

    titleEl.addEventListener('blur', () => {
      state.pages[i].title = titleEl.textContent.trim() || `Page ${i + 1}`;
      titleEl.textContent = state.pages[i].title;
      scheduleSave();
    });

    titleEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        titleEl.blur();
      }
    });

    // Rename button with ✎ → ✓ toggle — only on the active tab
    if (i === state.currentPageIdx) {
      let isEditing = false;

      const renameBtn = document.createElement('button');
      renameBtn.className = 'page-rename';
      renameBtn.textContent = '✎';
      renameBtn.title = 'Rename page';

      function enterEdit() {
        isEditing = true;
        renameBtn.textContent = '✓';
        renameBtn.title = 'Save name';
        renameBtn.classList.add('confirming');
        tab.classList.add('editing');
        titleEl.focus();
        const range = document.createRange();
        range.selectNodeContents(titleEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }

      function exitEdit() {
        isEditing = false;
        renameBtn.textContent = '✎';
        renameBtn.title = 'Rename page';
        renameBtn.classList.remove('confirming');
        tab.classList.remove('editing');
      }

      // When focus leaves the title for any reason, reset button to ✎
      titleEl.addEventListener('blur', exitEdit);

      // mousedown with preventDefault keeps titleEl focused when clicking ✓
      renameBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
      });

      renameBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (isEditing) {
          // Confirm: save title then blur
          exitEdit();
          state.pages[i].title = titleEl.textContent.trim() || `Page ${i + 1}`;
          titleEl.textContent = state.pages[i].title;
          scheduleSave();
          titleEl.blur();
        } else {
          enterEdit();
        }
      });

      tab.appendChild(titleEl);
      tab.appendChild(renameBtn);
    } else {
      tab.appendChild(titleEl);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'page-del';
    delBtn.textContent = '×';
    delBtn.title = 'Delete page';
    delBtn.style.display = showDel ? '' : 'none';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      deletePage(i);
    });

    tab.appendChild(delBtn);
    tabs.appendChild(tab);
  });
}

export function initPages() {
  const btn = document.getElementById('btn-add-page');
  if (btn) btn.addEventListener('click', addPage);
  renderPageBar();
}
