// terminal.js
import { loadTree, resolvePath, listDir, findFile, isDir, isFile, find } from './tree.js';

(async () => {
  'use strict';

  const term = document.getElementById('term');
  if (!term) {
    console.error('No element with id="term" found.');
    return;
  }

  /* Configuration (provided by your page) */
  const CURR_DIR = window.CURR_DIR ?? '~';
  const USER = window.USER ?? 'user';
  const AVAIL_CMDS = ['cd', 'clear', 'help', 'l', 'll', 'ls', 'open'];
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
  let prev_event = null;

  function pushLine(tokens) {
    history.push(tokens);
  }

  function execute(command_string) {
    pushLine([
      { text: USER, color: GREEN }, { text: ':', color: WHITE }, { text: CURR_DIR, color: BLUE }, { text: '$ ', color: WHITE },
      { text: command_string + '\n', color: WHITE }
    ]);

    const args = command_string.trim().split(/\s+/).filter(Boolean);
    const cmd = args[0] ?? '';
    args.shift();

    let output = [];
    change_site = false;

    switch (cmd) {
      case 'cd': {
        if (args.length > 1) {
          output.push({ text: 'bash: cd: too many arguments\n', color: WHITE });
          break;
        }
        let target = '';
        if (args.length < 1 || args[0] === '~') {
          target = '/';
        } else {
          target = args[0];
          target = target.startsWith('~') ? target : resolvePath(CURR_DIR, target);
        }
        output.push({ text: target + '\n', color: WHITE });
        console.log(root + ' ' + target);
        if (isDir(find(root, target))) {
          window.location.replace(target.replace(/^~\/?/, '/'));
          change_site = true;
        } else {
          output.push({ text: 'bash: cd: ' + args[0] + ': No such file or directory', color: WHITE });
        }
        break;
      }
      case 'clear': {
        history.length = 0;
        break;
      }
      case 'help': {
        output.push({ text: 'Available commands: ' + AVAIL_CMDS.join(', ') + '\n', color: WHITE });
        break;
      }
      case 'l': {
        const pathArgs = args.length > 0 ? args : [CURR_DIR];
        for (const pathArg of pathArgs) {
          const items = listDir(root, pathArg, CURR_DIR, false);
          if (!items) {
            output.push({ text: "l: cannot access '" + pathArg + "': No such file or directory\n", color: WHITE });
            continue;
          }
          if (pathArgs.length > 1) {
            output.push({ text: pathArg + ':\n', color: WHITE });
          }
          for (const node of items) {
            if (node.type === 'directory') {
              output.push({ text: node.name, color: BLUE }, { text: '/ ', color: WHITE });
            } else {
              output.push({ text: node.name + ' ', color: WHITE });
            }
          }
          output.push({ text: '\n\n', color: WHITE });
        }
        output.pop()
        break;
      }
      case 'll': {
        const pathArgs = args.length > 0 ? args : [CURR_DIR];
        for (const pathArg of pathArgs) {
          const items = listDir(root, pathArg, CURR_DIR, true);
          if (!items) {
            output.push({ text: "ll: cannot access '" + pathArg + "': No such file or directory\n", color: WHITE });
            continue;
          }
          if (pathArgs.length > 1) {
            output.push({ text: pathArg + ':\n', color: WHITE });
          }
          output.push({ text: 'total X\n', color: WHITE });
          for (const node of items) {
            if (node.type === 'directory') {
              output.push(
                { text: 'drwxr-sr-x ' + (node.contents.length + 2) + ' user gabrielhansmann 4096 ' + node.date + ' ', color: WHITE },
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
          output.push({ text: '\n', color: WHITE });
        }
        output.pop();
        break;
      }
      case 'ls': {
        const pathArgs = args.length > 0 ? args : [CURR_DIR];
        for (const pathArg of pathArgs) {
          const items = listDir(root, pathArg, CURR_DIR, false);
          if (!items) {
            output.push({ text: "ls: cannot access '" + pathArg + "': No such file or directory\n", color: WHITE });
            continue;
          }
          if (pathArgs.length > 1) {
            output.push({ text: pathArg + ':\n', color: WHITE });
          }
          for (const node of items) {
            if (node.type === 'directory') {
              output.push({ text: node.name + ' ', color: BLUE });
            } else {
              output.push({ text: node.name + ' ', color: WHITE });
            }
          }
          output.push({ text: '\n\n', color: WHITE });
        }
        output.pop();
        break;
      }
      case 'open': {
        if (args.length > 1) {
          output.push({ text: "xdg-open: unexpected argument '" + args.at(1) + "'", color: WHITE });
          break;
        }
        const pathArg = args[0];
        const file_node = findFile(root, pathArg, CURR_DIR);
        
        if (file_node) {
          if (file_node.type === 'asset') window.location = file_node.location + '/' + file_node.name; //window.open(file_node.location + '/' + file_node.name);
          if (file_node.type === 'link') window.location = file_node.location;
        } else {
          output.push({ text: 'gio: file:///' + pathArg + ': Error when getting information for file “' + pathArg + '”: No such file or directory', color: WHITE });
        }
        break;
      }
      default: {
        output.push({ text: 'bash: ' + cmd + ': command not found\n', color: WHITE });
        break;
      }
    }
    if (output.length > 0) pushLine(output);
    current_cmd = cmd_list.push(command_string);
    render();
  }

  function autocomplete(command_string) {
    const last_is_whitespace = command_string.at(-1) === ' ';
    console.log(last_is_whitespace);
    const args = command_string.trim().split(/\s+/).filter(Boolean);
    const prev_args = args.slice(0, -1);
    const last_arg = last_is_whitespace ? '' : args.at(-1);
    
    let output = [];
    if (prev_args.length === 0 && !last_is_whitespace) {   //Change command
      const cmd_to_fit = last_arg;
      const fitting_cmds = AVAIL_CMDS.filter(cmd => cmd.startsWith(cmd_to_fit));
      if (fitting_cmds.length === 1) {
        buffer = fitting_cmds[0] + ' ';
      } else if (prev_event === 'Tab') {
          output.push({ text: fitting_cmds.join(' '), color: WHITE });
      }
    } else {   // Change (last) arg (e.g. to correct dir)
      const cmd = prev_args[0];
      const pathArg = last_arg.includes('/') ? last_arg.replace(/^~\/?/, '').split('/').slice(0, -1).join('/') || CURR_DIR : CURR_DIR;
      const AVAIL_CONTENT = listDir(root, pathArg, CURR_DIR, true);
      if (!Array.isArray(AVAIL_CONTENT)) return;
      const arg_to_fit = last_arg.replace(/^~\/?/, '').split('/').at(-1);
      let fitting_args = AVAIL_CONTENT.filter(content => content.name.startsWith(arg_to_fit) && !['.', '..'].includes(content.name));

      switch(cmd) {
        case 'cd': {   //show avail dirs
          fitting_args = fitting_args.filter(dir => isDir(dir)).map(dir => dir.name + '/');
          break;
        }
        default: {   // show avail dirs and files
          fitting_args = fitting_args.map(content => isDir(content) ? content.name + '/' : content.name);
          break;
        }
      }
      if (fitting_args.length === 1) {
        buffer = command_string + fitting_args[0].slice(arg_to_fit.length);
      } else if (prev_event === 'Tab') {
        output.push({ text: fitting_args.join(' '), color: WHITE });
      }
    }

    if (output.length > 0) {
      pushLine([
          { text: USER, color: GREEN }, { text: ':', color: WHITE }, { text: CURR_DIR, color: BLUE }, { text: '$ ', color: WHITE },
          { text: command_string + '\n', color: WHITE }
      ]);
      pushLine(output);
    }
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
    if (ev.ctrlKey && (ev.key === 'c')) {
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
    } else if (ev.key === 'Tab') {
      autocomplete(buffer);
    } else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey) {
      buffer += ev.key;
    }
    prev_event = ev.key;
    render();
    ev.preventDefault();
  });

  document.addEventListener('click', () => term.focus());

  render();
  term.setAttribute('tabindex', '0');
  term.focus();
})();