const FILTER_PAGE_PARAM = "filter-page";
const FILTER_KEYWORD_PARAM = "filter-keyword";
const FILTER_VALUE_PREFIX = "filter.";

function clearManagedFilterParams(params) {
  for (const key of [...params.keys()]) {
    if (key === FILTER_PAGE_PARAM || key === FILTER_KEYWORD_PARAM || key.startsWith(FILTER_VALUE_PREFIX)) {
      params.delete(key);
    }
  }
}

/** Draft controls never call this helper: the URL represents queried results only. */
export function buildAppliedFilterSearch(search, pageKey, filterValues = {}, keyword = "") {
  const params = new URLSearchParams(search);
  clearManagedFilterParams(params);
  params.set(FILTER_PAGE_PARAM, pageKey);
  for (const [label, value] of Object.entries(filterValues)) {
    if (value) params.set(`${FILTER_VALUE_PREFIX}${label}`, value);
  }
  if (keyword.trim()) params.set(FILTER_KEYWORD_PARAM, keyword.trim());
  return params.toString();
}

/**
 * Restores only a known page's submitted scope. URL values are never trusted
 * as arbitrary page state: fields not declared by that page are ignored.
 */
export function readAppliedFilterQuery(search, supportedPageKeys, allowedFilterLabels) {
  const params = new URLSearchParams(search);
  const pageKey = params.get(FILTER_PAGE_PARAM);
  if (!pageKey || !supportedPageKeys.includes(pageKey)) {
    return null;
  }

  const values = {};
  for (const label of allowedFilterLabels) {
    const value = params.get(`${FILTER_VALUE_PREFIX}${label}`);
    if (value) values[label] = value;
  }

  return {
    pageKey,
    scope: {
      values,
      keyword: params.get(FILTER_KEYWORD_PARAM) ?? "",
    },
  };
}

export function replaceAppliedFilterQueryUrl(pageKey, filterValues = {}, keyword = "") {
  const url = new URL(window.location.href);
  url.search = buildAppliedFilterSearch(url.search, pageKey, filterValues, keyword);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/** Clear a former page's applied filter URL when navigation changes the result set. */
export function clearAppliedFilterQueryUrl() {
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.search);
  clearManagedFilterParams(params);
  url.search = params.toString();
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
