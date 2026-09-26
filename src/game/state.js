export const STATE = {
  EXPLORING: 'exploring',
  DIALOGUE: 'dialogue',
  WIN: 'win',
};

export function createState() {
  return {
    current: STATE.EXPLORING,
    activeNPC: null,
  };
}
