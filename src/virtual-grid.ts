export const gridGap = 14;

export function virtualGridLayout(count: number, columns: number, heights: ReadonlyMap<number, number>) {
  const offsets = [0];
  const rows = Math.ceil(count / columns);
  for (let row = 0; row < rows; row++) offsets.push(offsets[row] + (heights.get(row) ?? 280) + gridGap);
  return { offsets, height: rows ? offsets[rows] - gridGap : 0 };
}

export function virtualGridRows(offsets: readonly number[], top: number, height: number, pinned: readonly number[]) {
  const count = offsets.length - 1;
  if (!count) return [];
  const rowAt = (offset: number) => {
    let low = 0, high = count - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (offsets[middle + 1] <= offset) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  const first = Math.max(0, rowAt(top) - 2);
  const last = Math.min(count - 1, rowAt(top + height) + 2);
  const rows = new Set(pinned.filter(row => row >= 0 && row < count));
  for (let row = first; row <= last; row++) rows.add(row);
  return [...rows].sort((a, b) => a - b);
}

export function gridNavigationIndex(index: number, count: number, columns: number, direction: string, rtl: boolean) {
  let next = index;
  if (direction === "next") next++;
  else if (direction === "previous") next--;
  else if (direction === "up") next -= columns;
  else if (direction === "down") {
    if (Math.floor(index / columns) === Math.ceil(count / columns) - 1) return null;
    next = Math.min(count - 1, index + columns);
  } else if (direction === "left" || direction === "right") {
    const step = (direction === "right" ? 1 : -1) * (rtl ? -1 : 1);
    next += step;
    if (Math.floor(next / columns) !== Math.floor(index / columns)) return null;
  } else return null;
  return next >= 0 && next < count ? next : null;
}
