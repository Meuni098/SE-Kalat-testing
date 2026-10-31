import assert from "node:assert/strict";
import test from "node:test";
import { areAllVisibleSelected, toggleVisibleSelection } from "../src/lib/qr-selection";

test("equal selection counts in different units must not mean all visible items are selected", () => {
  assert.equal(areAllVisibleSelected(["amo-1", "amo-2"], ["coe-1", "coe-2"]), false);
  assert.deepEqual(toggleVisibleSelection(["amo-1", "amo-2"], ["coe-1", "coe-2"]), ["amo-1", "amo-2", "coe-1", "coe-2"]);
});

test("deselect visible preserves other units and an empty list is never all selected", () => {
  assert.equal(areAllVisibleSelected([], []), false);
  assert.deepEqual(toggleVisibleSelection(["amo-1", "coe-1"], ["coe-1"]), ["amo-1"]);
  assert.deepEqual(toggleVisibleSelection(["amo-1"], []), ["amo-1"]);
});

test("selecting a partially selected list adds only missing items once", () => {
  assert.deepEqual(toggleVisibleSelection(["a"], ["a", "b"]), ["a", "b"]);
  assert.equal(areAllVisibleSelected(["a", "b"], ["a", "b"]), true);
});
