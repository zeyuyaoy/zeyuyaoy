type WheelGesture = {
  lastTime: number;
  distance: number;
  native: boolean;
  captured: boolean;
};

export const initialWheelGesture: WheelGesture = {
  lastTime: -Infinity,
  distance: 0,
  native: false,
  captured: false,
};

export function advanceWheelGesture(
  previous: WheelGesture,
  input: { time: number; deltaX: number; deltaY: number; canScroll: boolean; canNavigate: boolean },
) {
  const state = input.time - previous.lastTime > 180 ? { ...initialWheelGesture } : { ...previous };
  state.lastTime = input.time;
  if (Math.abs(input.deltaY) <= Math.abs(input.deltaX)) {
    return { state, direction: 0, preventDefault: false };
  }
  if (state.captured) {
    return { state, direction: 0, preventDefault: true };
  }
  if (input.canScroll || state.native) {
    state.native = true;
    return { state, direction: 0, preventDefault: false };
  }
  if (!input.canNavigate) {
    state.distance = 0;
    return { state, direction: 0, preventDefault: false };
  }
  if (Math.sign(state.distance) !== Math.sign(input.deltaY)) {
    state.distance = 0;
  }
  state.distance += input.deltaY;
  if (Math.abs(state.distance) < 70) {
    return { state, direction: 0, preventDefault: true };
  }
  state.captured = true;
  return { state, direction: Math.sign(state.distance), preventDefault: true };
}
