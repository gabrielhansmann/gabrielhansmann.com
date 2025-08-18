// terminal.js
import { loadTree, resolvePath, listDir, isDir, find } from './tree.js';

(async () => {
  'use strict';

  const term = document.getElementById('term');
  if (!term) {
    console.error('No element with id="term" found.');
    return;
  }

  /* Configuration (provided by your page) */
  const CURR_DIR = window.CURR_DIR ?? '~';
  //const current_dir_node = 
  const USER     = window.USER ?? 'user';
  const GREEN = '#26a164';
  const WHITE = '#fff';
  const BLUE  = '#12488b';

  /* Load tree (async) */
  const tree = await loadTree();
  const root =
    (tree.find((n) => isDir(n) && n.name === '~')) ||
    (tree.find((n) => isDir(n))) ||
    null;

  if (!root) {
    console.error('No root directory found in tree.json');
    return;
  }

  /* State */
  const history = [];
  const cmd_list = [];
  let current_cmd = 0;
  let buffer = '';
  let saved_buffer = '';
  let change_site = false;

  function pushLine(tokens) {
    history.push(tokens);
  }

  function execute(full_cmd) {
    pushLine([
      { text: USER, color: GREEN }, { text: ':', color: WHITE }, { text: CURR_DIR, color: BLUE }, { text: '$ ', color: WHITE },
      { text: full_cmd + '\n', color: WHITE }
    ]);

    const split_cmd = full_cmd.trim().split(/\s+/).filter(Boolean);
    const cmd = split_cmd[0] ?? '';

    let output = [];
    change_site = false;

    switch (cmd) {
      case 'help': {
        output.push({ text: 'Available commands: help, clear, ll, ls, l, cd\n', color: WHITE });
        break;
      }

      case 'clear': {
        history.length = 0;
        break;
      }

      case 'll': {
        const pathArg = split_cmd.length > 1 ? split_cmd[1] : CURR_DIR;
        const items = listDir(root, pathArg, CURR_DIR, true);
        if (!items) {
          output.push({ text: "ll: cannot access '" + pathArg + "': No such file or directory\n", color: WHITE });
          break;
        }
        output.push({ text: 'total X\n', color: WHITE });
        for (const node of items) {
          if (node.type === 'directory') {
            output.push(
              { text: 'drwxr-sr-x ' + (node.contents.length-1 + 2) + ' user gabrielhansmann 4096 ' + node.date + ' ', color: WHITE },
              { text: node.name, color: BLUE },
              { text: '/\n', color: WHITE }
            );
          } else {
            output.push(
              { text: '-rw-r--r-- 1 user user            1234 ' + node.date + ' ', color: WHITE },
              { text: node.name + '\n', color: WHITE }
            );
          }
        }
        break;
      }

      case 'ls': {
        const pathArg = split_cmd.length > 1 ? split_cmd[1] : CURR_DIR;
        const items = listDir(root, pathArg, CURR_DIR, false);
        if (!items) {
          output.push({ text: "ls: cannot access '" + pathArg + "': No such file or directory\n", color: WHITE });
          break;
        }
        for (const node of items) {
          if (node.type === 'directory') {
            output.push({ text: node.name + ' ', color: BLUE });
          } else {
            output.push({ text: node.name + ' ', color: WHITE });
          }
        }
        output.push({ text: '\n', color: WHITE });
        break;
      }

      case 'l': {
        const pathArg = split_cmd.length > 1 ? split_cmd[1] : CURR_DIR;
        const items = listDir(root, pathArg, CURR_DIR, false);
        if (!items) {
          output.push({ text: "l: cannot access '" + pathArg + "': No such file or directory\n", color: WHITE });
          break;
        }
        for (const node of items) {
          if (node.type === 'directory') {
            output.push({ text: node.name, color: BLUE }, { text: '/ ', color: WHITE });
          } else {
            output.push({ text: node.name + ' ', color: WHITE });
          }
        }
        output.push({ text: '\n', color: WHITE });
        break;
      }

      case 'cd': {
        if (split_cmd.length > 2) {
          output.push({ text: 'bash: cd: too many arguments\n', color: WHITE });
          break;
        }
        let target = '';
        if (split_cmd.length < 2 || split_cmd[1] === '~') {
          target = '/';
        } else {
          target = split_cmd[1];
          target = target.startsWith('~') ? target : resolvePath(CURR_DIR, target);
        }
        
        if (isDir(find(root, target, CURR_DIR, false))) {
          window.location.replace(target);
          change_site = true;
        } else {
          output.push({ text: 'bash: cd: ' + split_cmd[1] + ': No such file or directory', color: WHITE });
        }
        break;
      }

      default: {
        output.push({ text: 'bash: ' + cmd + ': command not found\n', color: WHITE });
        break;
      }
    }

    if (output.length > 0) pushLine(output);
    current_cmd = cmd_list.push(full_cmd);
    render();
  }

  function render() {
    if (change_site) return;

    const frag = document.createDocumentFragment();

    for (const line of history) {
      for (const token of line) {
        const span = document.createElement('span');
        span.textContent = token.text;
        if (token.color) span.style.color = token.color;
        frag.appendChild(span);
      }
      if (!line.length || !line[line.length - 1].text.endsWith('\n')) {
        frag.appendChild(document.createTextNode('\n'));
      }
    }

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

    const bufSpan = document.createElement('span');
    bufSpan.textContent = buffer || ' ';
    bufSpan.style.color = WHITE;
    frag.appendChild(bufSpan);

    term.replaceChildren(frag);
    term.scrollTop = term.scrollHeight;
  }

  term.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C')) {
      pushLine([
        { text: USER, color: GREEN }, { text: ':', color: WHITE }, { text: CURR_DIR, color: BLUE }, { text: '$ ', color: WHITE },
        { text: buffer, color: WHITE },
        { text: '^C\n', color: WHITE }
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
    } else if (ev.key === 'ArrowUp') {
      if (current_cmd === cmd_list.length) saved_buffer = buffer;
      if (current_cmd > 0) {
        current_cmd -= 1;
        buffer = cmd_list[current_cmd];
      }
    } else if (ev.key === 'ArrowDown') {
      if (current_cmd < cmd_list.length) current_cmd += 1;
      else saved_buffer = buffer;
      buffer = cmd_list[current_cmd] ?? saved_buffer;
    } else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey) {
      buffer += ev.key;
    }
    render();
    ev.preventDefault();
  });

  document.addEventListener('click', () => term.focus());

  render();
  term.setAttribute('tabindex', '0');
  term.focus();
})();