// tree.js
/**
 * @typedef {{ type:string, name:string, location:string }} FileNode
 * @typedef {{ type:'directory', name:string, contents:(DirNode|FileNode)[] }} DirNode
 */

/** Load the serialized tree array (top-level should include a "~" directory). */
export async function loadTree(url = '/assets/dicts/tree.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`tree.json ${res.status}`);
  return /** @type {(DirNode|FileNode)[]} */ (await res.json());
}

export const isDir   = (n) => n?.type === 'directory';
export const isFile  = (n) => n?.type != 'directory';

/** Normalize to a canonical "~" path. Handles "~", ".", "..", and relative paths. */
export function resolvePath(cwd, path) {
  if (typeof path !== 'string' || !path.length) throw new Error('path must be a non-empty string');
  if (typeof cwd !== 'string' || !cwd.startsWith('~')) throw new Error('cwd must start with "~"');

  const stripTilde = (p) => p.replace(/^~\/?/, '');
  const isAbs = path.startsWith('~');

  // Seed from cwd (without "~") when relative
  const baseParts = isAbs ? [] : stripTilde(cwd).split('/').filter(Boolean);
  const segs = stripTilde(path).split('/').filter(Boolean);

  const parts = [...baseParts];
  for (const seg of segs) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') { if (parts.length) parts.pop(); continue; }
    parts.push(seg);
  }
  return parts.length ? `~/${parts.join('/')}` : '~';
}

/** Walk the tree using a "~" canonical or relative path. */
export function find(root, pathOrCanonical, cwd = '~', list_hidden = false) {
  if (!root || !isDir(root)) throw new Error('root must be a directory node');

  const canonical = resolvePath(cwd, pathOrCanonical);
  
  const parts = canonical.replace(/^~\/?/, '').split('/').filter(Boolean);
  
  let node = root;
  let parent_node = root;
  
  if (parts.length != 0) {
    for (const part of parts) {
      if (!isDir(node)) return null;
      parent_node = node;
      node = node.contents.find((c) => c.name === part) ?? null;
      if (!node) return null;
    }
  }

  if(isDir(node)) {
    let contents = node.contents.filter(item => { return item.name !== '.' && item.name !== '..'; });
    
    if (!list_hidden) {
      contents = contents.filter(item => !item.name.startsWith('.'));
    } else {
      contents.unshift(
        { ...node, name: '.' },
        { ...parent_node, name: '..' }
      );
    }
    
    return {...node, contents};
  } else if (isFile(node)) {
    return node;
  }
  return null;
}

export function findFile(root, pathOrCanonical, cwd = '~') {
  const n = find(root, pathOrCanonical, cwd);
  return isFile(n) ? n : null;
}

export function listDir(root, pathOrCanonical = '~', cwd = '~', list_hidden = false) {
  const n = find(root, pathOrCanonical, cwd, list_hidden);
  return isDir(n) ? n.contents : null;
}
