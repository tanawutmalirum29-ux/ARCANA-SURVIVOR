// UI state changes only after the authoritative transaction has completed.
// Serializing gestures also keeps rapid clicks from spending a stale balance.
export function createCampaignClient({store, onChange = () => {}, onCommit = () => {}}) {
  let state = null;
  let queue = Promise.resolve();
  function schedule(operation) {
    const result = queue.then(operation).catch(() => ({ok:false, code:'STORAGE_UNAVAILABLE', state}));
    queue = result.then(() => {});
    return result;
  }
  function accept(result) {
    if (result.state) {state = result.state; onChange(state);}
    return result;
  }
  return {
    getState: () => state,
    load: () => schedule(async () => accept(await store.load())),
    dispatch: command => schedule(async () => {
      if (!state) return {ok:false, code:'NOT_LOADED', state:null};
      const result = accept(await store.dispatch(command, {expectedRevision:state.revision}));
      if (result.ok) onCommit(result);
      return result;
    }),
  };
}
