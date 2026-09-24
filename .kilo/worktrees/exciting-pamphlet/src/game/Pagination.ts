/** Bounded, deterministic view over a loaded collection. Rendering a new page
 * never mutates data or drops a form draft. */
export function paginate<T>(items: readonly T[], requestedPage: number, size = 6) {
  const perPage = Math.max(1, Math.floor(size) || 6);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.max(0, Math.min(pages - 1, Math.floor(requestedPage) || 0));
  return { items: items.slice(page * perPage, (page + 1) * perPage), page, pages, total: items.length };
}
