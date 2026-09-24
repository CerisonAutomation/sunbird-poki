import type { BufferAttribute } from "three";

/** A dense buffer is rewritten from zero on every update. Replace (don't append)
 * pending ranges: culled objects can go many frames without a GPU upload.
 * Counts are attribute items, not bytes; Three's ranges use scalar components.
 */
export function uploadDensePrefix(attribute: BufferAttribute, items: number): void {
  attribute.clearUpdateRanges();
  const count = Math.min(attribute.count, Math.max(0, Math.floor(items))) * attribute.itemSize;
  if (count === 0) return;
  attribute.addUpdateRange(0, count);
  attribute.needsUpdate = true;
}
