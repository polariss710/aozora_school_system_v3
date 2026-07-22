/**
 * Keeps a page's editable filter controls separate from the scope that has
 * actually been submitted by the operator.  Pages must fetch or filter only
 * with `applied`, never with `draft`.
 */
export function createQueryFilterState(initialScope) {
  return {
    draft: { ...initialScope },
    applied: { ...initialScope },
  };
}

export function updateQueryFilterDraft(state, patch) {
  return {
    ...state,
    draft: { ...state.draft, ...patch },
  };
}

export function applyQueryFilterDraft(state) {
  return {
    ...state,
    applied: { ...state.draft },
  };
}

/** A normal Reset action only changes controls, never the applied result scope. */
export function resetQueryFilterDraft(state, initialScope) {
  return {
    ...state,
    draft: { ...initialScope },
  };
}

/** Use only for a separately named, documented navigation action such as 回到本周. */
export function applyDefaultQueryFilters(initialScope) {
  return createQueryFilterState(initialScope);
}
