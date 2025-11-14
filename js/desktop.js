// desktop.js
import { mountTerminal } from './terminal.js';

(() => {
  let zTop = 100;
  const POS_KEY = 'wm:terminal:pos';

  const USER = window.USER ?? 'user';
  const CURR_DIR = window.CURR_DIR ?? '~';
  const USER_LABEL = `${USER}@gabrielhansmann.com`;

  // Desktop root (from your desktop.css)
  let desktop = document.getElementById('desktop');
  if (!desktop) {
    desktop = document.createElement('div');
    desktop.id = 'desktop';
    document.body.prepend(desktop);
  }

  const bringToFront = el => { zTop += 1; el.style.zIndex = zTop; };

  const savePos = el => {
    const r = el.getBoundingClientRect();
    localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top, width: r.width, height: r.height }));
  };
  const loadPos = () => {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (!p) return null;
      const vw = innerWidth, vh = innerHeight;
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
      return {
        left: clamp(p.left ?? 80, 0, vw - 120),
        top: clamp(p.top ?? 80, 0, vh - 80),
        width: clamp(p.width ?? 840, 300, vw),
        height: clamp(p.height ?? 520, 240, vh)
      };
    } catch { return null; }
  };

  function makeDraggable(winEl, handleEl) {
    let sx=0, sy=0, sl=0, st=0, dragging=false;
    const start=(x,y)=>{ dragging=true; const r=winEl.getBoundingClientRect(); sx=x; sy=y; sl=r.left; st=r.top; bringToFront(winEl); };
    const move=(x,y)=>{ if(!dragging)return; winEl.style.left=Math.max(0, sl+(x-sx))+'px'; winEl.style.top=Math.max(0, st+(y-sy))+'px'; };
    const stop=()=>{ if(!dragging)return; dragging=false; savePos(winEl); };
    handleEl.addEventListener('mousedown', e=>{ if(e.button===0){ start(e.clientX,e.clientY); e.preventDefault(); }});
    addEventListener('mousemove', e=>move(e.clientX,e.clientY));
    addEventListener('mouseup', stop);
    handleEl.addEventListener('touchstart', e=>{ const t=e.touches[0]; start(t.clientX,t.clientY); e.preventDefault(); }, {passive:false});
    addEventListener('touchmove', e=>{ const t=e.touches?.[0]; if(t){ move(t.clientX,t.clientY); e.preventDefault(); }}, {passive:false});
    addEventListener('touchend', stop);
  }

  const ro = new ResizeObserver(entries => {
    for (const {target} of entries) if (target.classList.contains('wm-window')) savePos(target);
  });

  let terminalWin = null;

  function openTerminalWindow() {
    if (terminalWin && document.body.contains(terminalWin)) {
      bringToFront(terminalWin);
      terminalWin.querySelector('.term-host')?.focus();
      return;
    }

    const pos = loadPos();

    const win = document.createElement('div');
    win.className = 'wm-window';
    Object.assign(win.style, {
      position:'absolute',
      left:  (pos?.left ?? 80) + 'px',
      top:   (pos?.top ?? 80) + 'px',
      width: (pos?.width ?? 840) + 'px',
      height:(pos?.height ?? 520) + 'px'
    });

    const bar = document.createElement('div');
    bar.className = 'wm-titlebar';
      
    const title = document.createElement('div');
    title.className = 'wm-title';
    title.textContent = USER_LABEL + ': ' + CURR_DIR;const content = document.createElement('div'); content.className = 'wm-content';

    const termHost = document.createElement('pre');
    termHost.className = 'term-host';
    termHost.tabIndex = 0;

    content.appendChild(termHost);
    bar.appendChild(title);
    win.append(bar, content);
    desktop.appendChild(win);

    bringToFront(win);
    makeDraggable(win, bar);
    win.addEventListener('mousedown', () => bringToFront(win));
    ro.observe(win);
    savePos(win);

    // Pass values from index.html
    mountTerminal(termHost, {
      user: USER,
      currDir: CURR_DIR
    });

    setTimeout(() => termHost.focus(), 0);
    terminalWin = win;
  }

  openTerminalWindow();
})();