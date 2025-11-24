// desktop.js
import { mountTerminal } from './terminal.js';

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
      dragging = false;

    const start = (x, y) => {
      dragging = true;
      const r = winEl.getBoundingClientRect();
      sx = x;
      sy = y;
      sl = r.left;
      st = r.top;
      bringToFront(winEl);
    };
    const move = (x, y) => {
      if (!dragging) return;
      winEl.style.left = Math.max(0, sl + (x - sx)) + 'px';
      winEl.style.top = Math.max(0, st + (y - sy)) + 'px';
    };
    const stop = () => {
      if (!dragging) return;
      dragging = false;
      savePos(winEl);
    };

    handleEl.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        start(e.clientX, e.clientY);
        e.preventDefault();
      }
    });
    addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    addEventListener('mouseup', stop);

    handleEl.addEventListener(
      'touchstart',
      (e) => {
        const t = e.touches[0];
        start(t.clientX, t.clientY);
        e.preventDefault();
      },
      { passive: false },
    );
    addEventListener(
      'touchmove',
      (e) => {
        const t = e.touches?.[0];
        if (t) {
          move(t.clientX, t.clientY);
          e.preventDefault();
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

    // (Optional) simple close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'wm-close';
    closeBtn.textContent = '×';
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
        openImageWindow(src, node.name);
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

  function openImageWindow(src, titleText) {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'wm-image';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.display = 'block';
    img.style.margin = 'auto';

    createWindow({
      title: titleText ?? (src.split('/').pop() || 'Image'),
      contentNode: img,
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
