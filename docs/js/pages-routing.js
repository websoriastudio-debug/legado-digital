export const BASE = '/legado-digital';
export function localPath(pathname) {
  const path = pathname === BASE ? '/' : pathname.startsWith(BASE + '/') ? pathname.slice(BASE.length) : pathname;
  return path.replace(/\/+$/, '') || '/';
}
export function sitePath(path) {
  if (path === BASE || path.startsWith(BASE + '/')) return path;
  return BASE + (path.startsWith('/') ? path : '/' + path);
}
export function rebaseLinks(root) {
  root.querySelectorAll('a[href^="/"]').forEach((a) => {
    const path = a.getAttribute('href');
    if (path.startsWith('//') || path.startsWith('/api/') || path === BASE || path.startsWith(BASE + '/')) return;
    a.setAttribute('href', sitePath(path));
  });
}
