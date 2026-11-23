// Projection data stays in memory and is used only by the owner's individual view.
export const plannerURL = 'https://finbuddy-2025.web.app/finvision';
export function projectionBridge(onChange) {
  let user = null;
  let generation = 0;
  let state = { status: 'local', projection: null };
  function publish(next) { state = next; onChange(); }
  async function refresh() {
    if (!user) return;
    const current = user;
    const sequence = ++generation;
    try {
      const token = await current.getIdToken();
      const response = await fetch('/api/v1/finvision/projection', { headers: { Authorization: 'Bearer ' + token }, credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('Projection unavailable');
      const data = await response.json();
      if (typeof data.adopted !== 'boolean' || !Array.isArray(data.goals) || !Array.isArray(data.activeSavings)) throw new Error('Invalid projection');
      if (sequence !== generation) return;
      publish(data.adopted ? { status: 'adopted', projection: { goals: data.goals, activeSavings: data.activeSavings } } : { status: 'local', projection: null });
    } catch {
      if (sequence === generation) publish({ status: 'unavailable', projection: null });
    }
  }
  return {
    get status() { return state.status; },
    get projection() { return state.projection; },
    async switchUser(next) {
      generation++;
      user = next;
      publish({ status: next ? 'checking' : 'local', projection: null });
      await refresh();
    },
    refresh,
    individual(inputs) { return state.projection ? { ...inputs, ...state.projection } : inputs; },
    legacyFields(goals, activeSavings, planHealth) {
      return state.status === 'local' ? { goals, activeSavings, planHealth } : {};
    },
  };
}
