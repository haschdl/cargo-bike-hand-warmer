// Loads the classic browser scripts into an isolated context for Node tests.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

export function load() {
  const ctx = vm.createContext({});
  for (const f of ['../src/pattern.js', '../src/drawing.js'])
    vm.runInContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx, {filename: f});
  return {SP: ctx.SewingPattern, PD: ctx.PatternDrawing};
}
