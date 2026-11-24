import { realpathSync, statSync } from "node:fs";
import path from "node:path";

/** Resolve an existing regular file inside the upload root, including symlinks. */
export function uploadFile(root, pathname) {
  try {
    if (!pathname.startsWith("/") || pathname.includes("\0")) return null;
    const base = realpathSync(root);
    const candidate = path.resolve(base, `.${pathname}`);
    const relative = path.relative(base, candidate);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
    const file = realpathSync(candidate);
    const resolvedRelative = path.relative(base, file);
    if (!resolvedRelative || resolvedRelative === ".." || resolvedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(resolvedRelative)) return null;
    return statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}
