// desktop.js
import { mountTerminal } from './terminal.js';

//for model
import 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';

(() => {
  let zTop = 100;
  const TERMINAL_POS_KEY = 'wm:terminal:pos';

  const USER = window.USER ?? 'user';
  const CURR_DIR = window.CURR_DIR ?? '~';
  const USER_LABEL = `${USER}@gabrielhansmann.com`;

  // Desktop root
  let desktop = document.getElementById('desktop');
  if (!desktop) {
    desktop = document.createElement('div');
    desktop.id = 'desktop';
    document.body.prepend(desktop);
  }

  const bringToFront = (el) => {
    zTop += 1;
    el.style.zIndex = zTop;
  };

  const savePos = (el) => {
    const key = el.dataset.posKey;
    if (!key) return;
    const r = el.getBoundingClientRect();
    localStorage.setItem(
      key,
      JSON.stringify({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      }),
    );
  };

  const loadPos = (key) => {
    if (!key) return null;
    try {
      const p = JSON.parse(localStorage.getItem(key) || 'null');
      if (!p) return null;
      const vw = innerWidth;
      const vh = innerHeight;
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      return {
        left: clamp(p.left ?? 80, 0, vw - 120),
        top: clamp(p.top ?? 80, 0, vh - 80),
        width: clamp(p.width ?? 840, 300, vw),
        height: clamp(p.height ?? 520, 240, vh),
      };
    } catch {
      return null;
    }
  };

  function makeDraggable(winEl, handleEl) {
    let sx = 0,
      sy = 0,
      sl = 0,
      st = 0,
      dragging = false,
      moved = false; // becomes true once we cross the drag threshold

    const DRAG_THRESHOLD = 3; // px before it counts as a drag

    // Transparent overlay that captures pointer events during a drag so the
    // cursor crossing an <iframe> doesn't steal mousemove/mouseup from us.
    let overlay = null;
    const addOverlay = () => {
      if (overlay) return;
      overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        cursor: 'grabbing',
        background: 'transparent',
      });
      document.body.appendChild(overlay);
    };
    const removeOverlay = () => {
      overlay?.remove();
      overlay = null;
    };

    const start = (x, y) => {
      dragging = true;
      moved = false;
      const r = winEl.getBoundingClientRect();
      sx = x;
      sy = y;
      sl = r.left;
      st = r.top;
      bringToFront(winEl);
    };
    const move = (x, y) => {
      if (!dragging) return;
      // Only treat it as a drag (and add the overlay) once we actually move.
      if (!moved && Math.abs(x - sx) + Math.abs(y - sy) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        addOverlay();
      }
      winEl.style.left = Math.max(0, sl + (x - sx)) + 'px';
      winEl.style.top = Math.max(0, st + (y - sy)) + 'px';
    };
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      removeOverlay();
      if (moved) savePos(winEl);
    };

    handleEl.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        start(e.clientX, e.clientY);
        // Don't preventDefault here or clicks on titlebar buttons break.
      }
    });
    addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    addEventListener('mouseup', stop);

    handleEl.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        start(t.clientX, t.clientY);
      },
      { passive: true },
    );
    addEventListener(
      'touchmove',
      (e) => {
        const t = e.touches?.[0];
        if (t && dragging) {
          move(t.clientX, t.clientY);
          if (moved) e.preventDefault(); // block scroll only once dragging
        }
      },
      { passive: false },
    );
    addEventListener('touchend', stop);
  }

  const ro = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      if (target.classList.contains('wm-window')) savePos(target);
    }
  });

  /**
   * Generic window factory
   * options:
   *  - title: string
   *  - contentNode: HTMLElement (will be put into .wm-content)
   *  - posKey?: string (for persistence, e.g. terminal)
   */
  function createWindow({ title, contentNode, posKey } = {}) {
    const win = document.createElement('div');
    win.className = 'wm-window';
    win.style.position = 'absolute';

    let pos = null;
    if (posKey) {
      pos = loadPos(posKey);
      win.dataset.posKey = posKey;
    }

    Object.assign(win.style, {
      left: (pos?.left ?? 80) + 'px',
      top: (pos?.top ?? 80) + 'px',
      width: (pos?.width ?? 840) + 'px',
      height: (pos?.height ?? 520) + 'px',
    });

    const bar = document.createElement('div');
    bar.className = 'wm-titlebar';

    const titleEl = document.createElement('div');
    titleEl.className = 'wm-title';
    titleEl.textContent = title ?? 'Window';

    // simple close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'wm-close';
    closeBtn.textContent = 'x';
    closeBtn.addEventListener('click', () => {
      win.remove();
    });

    const barInner = document.createElement('div');
    barInner.className = 'wm-titlebar-inner';
    barInner.appendChild(titleEl);
    barInner.appendChild(closeBtn);
    bar.appendChild(barInner);

    const content = document.createElement('div');
    content.className = 'wm-content';
    if (contentNode) content.appendChild(contentNode);

    win.append(bar, content);
    desktop.appendChild(win);

    bringToFront(win);
    makeDraggable(win, bar);
    win.addEventListener('mousedown', () => bringToFront(win));
    ro.observe(win);
    if (posKey) savePos(win);

    return win;
  }

  // === Window types =====================================================

  let terminalWin = null;

  function openTerminalWindow() {
    if (terminalWin && document.body.contains(terminalWin)) {
      bringToFront(terminalWin);
      terminalWin.querySelector('.term-host')?.focus();
      return;
    }

    const termHost = document.createElement('pre');
    termHost.className = 'term-host';
    termHost.tabIndex = 0;

    const win = createWindow({
      title: `${USER_LABEL}: ${CURR_DIR}`,
      contentNode: termHost,
      posKey: TERMINAL_POS_KEY,
    });
    win.classList.add('wm-window-terminal');

    mountTerminal(termHost, {
      user: USER,
      currDir: CURR_DIR,
      // called from `open` command for assets/links
      onOpenAsset: (node) => {
        // node.location + '/' + node.name is how you already store assets
        const src = node.location + '/' + node.name;
        openAssetWindow(src, node.name);
      },
      onOpenLink: (node) => {
        const url = node.location;
        openWebsiteWindow(url, node.name || url);
      },
    });

    setTimeout(() => termHost.focus(), 0);
    terminalWin = win;
  }

  function openWebsiteWindow(url, titleText) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.className = 'wm-iframe';
    iframe.setAttribute('frameborder', '0');
    iframe.style.width = '100%';
    iframe.style.height = '100%';

    createWindow({
      title: titleText ?? url,
      contentNode: iframe,
    });
  }

  function openAssetWindow(src, titleText) {
  const cleanSrc = src.split('#')[0].split('?')[0];
  const ext = cleanSrc.split('.').pop().toLowerCase();

  let node;

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'wm-image';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.display = 'block';
    img.style.margin = 'auto';
    node = img;
  }

  // Videos
  else if (['mp4', 'webm', 'ogg'].includes(ext)) {
    const video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.className = 'wm-video';
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    video.style.display = 'block';
    video.style.margin = 'auto';
    node = video;
  }

  // 3D assets (using <model-viewer>, script is included in dekstop.js)
  else if (['glb', 'gltf', 'usdz'].includes(ext)) {
    const viewer = document.createElement('model-viewer');
    viewer.src = src;
    viewer.alt = titleText || '3D model';
    viewer.setAttribute('camera-controls', '');
    viewer.setAttribute('auto-rotate', '');
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    viewer.style.display = 'block';
    node = viewer;
  }

  // Fallback: just show a link
  else {
    const link = document.createElement('a');
    link.href = src;
    link.textContent = 'Open ' + (titleText || src);
    link.target = '_blank';
    link.style.color = 'var(--titlebar-fg)';
    node = link;
  }

  createWindow({
    title: titleText ?? (src.split('/').pop() || 'Asset'),
    contentNode: node,
  });
}

  // For now: auto-open terminal on load.
  // Later you can hook openTerminalWindow, openWebsiteWindow, openImageWindow
  // to a dock / icons / shortcuts.
  openTerminalWindow();

  // // Optional: expose helpers globally if you want to call from elsewhere
  // window.DesktopAPI = {
  //   openTerminalWindow,
  //   openWebsiteWindow,
  //   openImageWindow,
  // };
})();
