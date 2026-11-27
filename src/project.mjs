// Pure orthographic projection helpers. No DOM access.
// World axes: x forward, y left, z up. Screen: x right, y down, depth increases away from the viewer.

export const VIEWS = Object.freeze({
  side: {yaw: 0, pitch: 0, label: 'Right side'},
  rear: {yaw: 90, pitch: 0, label: 'Rear (looking forward)'},
  top: {yaw: 0, pitch: 90, label: 'Top'},
  iso: {yaw: 32, pitch: 24, label: 'Isometric'},
});

export function camera({yaw = 32, pitch = 24} = {}) {
  const a = yaw * Math.PI / 180, b = pitch * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return {
    yaw, pitch,
    project([x, y, z]) {
      const x1 = x * ca - y * sa, y1 = x * sa + y * ca;
      return [x1, -(y1 * sb + z * cb), y1 * cb - z * sb];
    },
  };
}
