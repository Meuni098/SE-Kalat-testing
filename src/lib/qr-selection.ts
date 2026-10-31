export function areAllVisibleSelected(selected: readonly string[], visible: readonly string[]): boolean {
  const ids = new Set(selected);
  return visible.length > 0 && visible.every(id => ids.has(id));
}

export function toggleVisibleSelection(selected: readonly string[], visible: readonly string[]): string[] {
  const visibleIds = new Set(visible);
  return areAllVisibleSelected(selected, visible)
    ? selected.filter(id => !visibleIds.has(id))
    : [...new Set([...selected, ...visible])];
}
