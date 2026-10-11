// How an item is delivered/ordered. Shared by the item form and the bulk editor.
export const UNITS = [
  'bag', 'ball', 'batch', 'bottle', 'box', 'bunch', 'can', 'case', 'container', 'dozen', 'each',
  'flat', 'gallon', 'head', 'jar', 'kg', 'lb', 'liter', 'loaf', 'pack', 'piece', 'pint', 'quart',
  'roll', 'sleeve', 'tub', 'wheel',
];

// Keep an item's existing unit selectable even if it isn't in the standard list
export function unitOptions(current?: string | null): string[] {
  return current && !UNITS.includes(current) ? [current, ...UNITS] : UNITS;
}
