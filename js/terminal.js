// terminal.js – Vanilla JavaScript terminal with per‑token colours
(() => {
    'use strict';

    const term = document.getElementById('term');
    if (!term) {
        console.error('No element with id="term" found.');
        return;
    }

    /* Configuration */
    const PARENT_DIR = window.PARENT_DIR;
    const CURR_DIR = window.CURR_DIR;
    const AVAIL_DIRS = window.AVAIL_DIR;
    const USER = window.USER;
    const GREEN = '#26a164';
    const WHITE = '#fff';
    const BLUE = '#12488b';

    /* State */
    const history = [];
    const cmd_list = [];
    let current_cmd = -1;
    let buffer = '';
    let saved_buffer = '';
    let change_site = false;

    /* Helper – push one coloured line */
    function pushLine(tokens) {
      history.push(tokens);
    }

    /* Command execution (demo) */
    function execute(full_cmd) {
        // Display the command the user typed
        pushLine([
            { text: USER, color: GREEN }, { text: ':', color: WHITE }, { text: CURR_DIR, color: BLUE}, { text: '$ ', color: WHITE },
            { text: full_cmd + '\n', color: WHITE }
        ]);
        const split_cmd = full_cmd.split(' ');
        const cmd = split_cmd[0];

        let output = [];
        change_site = false;
        switch (cmd) {
            case 'help': {
                output.push( { text: 'Available commands: help, clear, ll, ls\n', color: WHITE } );
                break;
            }
            case 'clear': {
                history.length = 0;
                break;
            }
            case 'll': {
                output.push( { text: 'total X\n', color: WHITE } );
                for (const dir of AVAIL_DIRS) {
                    output.push( { text: 'drwxr-xr-x 332 user gabrielhansmann 4096 Aug 25 12:00 ', color: WHITE }, { text: dir, color: BLUE }, { text: '/\n', color: WHITE } );
                }
                break;
            }
            case 'ls': {
                for (const dir of AVAIL_DIRS) {
                    if (dir != '.' && dir != '..') {
                        output.push( { text: dir + ' ', color: BLUE } );
                    }
                }
                output.push( { text: '\n', color: WHITE } );
                break;
            }
            case 'l': {
                for (const dir of AVAIL_DIRS) {
                    if (dir != '.' && dir != '..') {
                        output.push( { text: dir, color: BLUE }, { text: '/ ', color: WHITE } );
                    }
                }
                output.push( { text: '\n', color: WHITE } );
                break;
            }
            case 'cd': {
                if (split_cmd.length > 2) {
                    output.push( { text: 'bash: cd: too many arguments', color: WHITE } );
                    break;
                }
                if (split_cmd.length < 2 || split_cmd[1] === '~') { 
                    window.location.replace('/');
                } 
                switch (split_cmd[1]) {
                    case '.': {
                        break;
                    }
                    case '..': {
                        if (PARENT_DIR != '') {
                            window.location.replace(PARENT_DIR)
                        }
                        change_site = true;
                        break;
                    }
                    default: {
                        if (AVAIL_DIRS.includes(split_cmd[1])) {
                            window.location.replace('/' + split_cmd[1]); 
                            change_site = true; 
                        } else {
                            output.push( { text: 'bash: cd: ' + split_cmd[1] + ': No such file or directory', color: WHITE } );
                        }
                        break;
                    }
                }
                break;
            }
            default: {
                output.push( { text: 'bash: ' + cmd + ': command not found', color: WHITE } );
                break;
            }
        }

        if (output.length > 0) pushLine(output)
        current_cmd = cmd_list.push(full_cmd)
        
        render();
    }

  /* Rendering */
  function render() {
    if (change_site) {
        return;
    }
    
    const frag = document.createDocumentFragment();
    // Render scrollback history
    for (const line of history) {
      for (const token of line) {
        const span = document.createElement('span');
        span.textContent = token.text;
        if (token.color) span.style.color = token.color;
        frag.appendChild(span);
      }
      // Ensure newline if last token didn't include it
      if (!line.length || !line[line.length - 1].text.endsWith('\n')) {
        frag.appendChild(document.createTextNode('\n'));
      }
    }
    // Render current prompt
    const userSpan = document.createElement('span');
    userSpan.textContent = USER;
    userSpan.style.color = GREEN;
    const colonSpan = document.createElement('span');
    colonSpan.textContent = ':';
    colonSpan.style.color = WHITE;
    const dirSpan = document.createElement('span');
    dirSpan.textContent = CURR_DIR;
    dirSpan.style.color = BLUE;
    const dollarSpan = document.createElement('span');
    dollarSpan.textContent = '$ ';
    dollarSpan.style.color = WHITE;
    frag.appendChild(userSpan);
    frag.appendChild(colonSpan);
    frag.appendChild(dirSpan);
    frag.appendChild(dollarSpan);

    // Render current buffer
    const bufSpan = document.createElement('span');
    bufSpan.textContent = buffer || ' ';
    bufSpan.style.color = WHITE;
    frag.appendChild(bufSpan);

    term.replaceChildren(frag);
    scrollToBottom();
  }

  /* Keep latest line visible */
  function scrollToBottom() {
    term.scrollTop = term.scrollHeight;
  }

  /* Keyboard handler */
  term.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C')) {
      // Visual feedback like a real shell
      pushLine([
        { text: USER, color: GREEN }, { text: ':', color: WHITE }, { text: CURR_DIR, color: BLUE}, { text: '$ ', color: WHITE },
        { text: buffer, color: WHITE },
        { text: '^C\n', color: WHITE}
      ]);
      buffer = '';
      render();
      ev.preventDefault();
      return;
    } else if (ev.key === 'Backspace') {
      buffer = buffer.slice(0, -1);
    } else if (ev.key === 'Enter') {
      execute(buffer);
      buffer = '';
    } else if (ev.key === 'ArrowUp'){
      if (current_cmd === cmd_list.length) saved_buffer = buffer;
      if (current_cmd > 0) {
        current_cmd -= 1;
        buffer = cmd_list[current_cmd];
      }
    } else if (ev.key === 'ArrowDown'){
      if (current_cmd < cmd_list.length) current_cmd += 1;
      else saved_buffer = buffer;
      buffer = cmd_list[current_cmd];
      if (current_cmd === cmd_list.length) buffer = saved_buffer;
    } else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey) {
      buffer += ev.key;
    }
    render();
    ev.preventDefault();
  });

  /* Restore focus if lost */
  document.addEventListener('click', () => term.focus());

  /* Initial setup */
  render();
  term.setAttribute('tabindex', '0');
  term.focus();
})();
