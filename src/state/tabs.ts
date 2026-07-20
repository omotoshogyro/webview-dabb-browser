// Browser tab state.
//
// Mirrors OneKey's `states/jotai/contexts/discovery` (webTabsAtom / activeTabIdAtom
// + ContextJotaiActionsDiscovery). Plain module state + useSyncExternalStore here
// instead of Jotai, so there's no extra dependency to understand.

export interface IWebTab {
  id: string;
  url: string; // the URL this tab was opened at (used as WebView source once)
  currentUrl: string; // live URL, updated from navigation events
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ITabsState {
  tabs: IWebTab[];
  activeId: string;
}

export const HOME_URL = 'https://metamask.github.io/test-dapp/';

const MAX_TABS = 10;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `tab-${counter}`;
}

function createTab(url: string): IWebTab {
  return {
    id: nextId(),
    url,
    currentUrl: url,
    title: '',
    canGoBack: false,
    canGoForward: false,
  };
}

let tabs: IWebTab[] = [createTab(HOME_URL)];
let activeId = tabs[0].id;

// useSyncExternalStore compares snapshots by identity, so the snapshot must be
// a stable object that only changes when the state actually changes.
let snapshot: ITabsState = { tabs, activeId };

const listeners = new Set<() => void>();

function commit(): void {
  snapshot = { tabs, activeId };
  listeners.forEach((l) => l());
}

export const tabsStore = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  getSnapshot(): ITabsState {
    return snapshot;
  },

  getActiveTab(): IWebTab | undefined {
    return tabs.find((t) => t.id === activeId);
  },

  addTab(url: string = HOME_URL): string | undefined {
    if (tabs.length >= MAX_TABS) return undefined; // OneKey's disabledAddedNewTabAtom
    const tab = createTab(url);
    tabs = [...tabs, tab];
    activeId = tab.id;
    commit();
    return tab.id;
  },

  closeTab(id: string): void {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const remaining = tabs.filter((t) => t.id !== id);

    if (remaining.length === 0) {
      // Never leave zero tabs — reset to a fresh home tab.
      const fresh = createTab(HOME_URL);
      tabs = [fresh];
      activeId = fresh.id;
      commit();
      return;
    }

    tabs = remaining;
    if (activeId === id) {
      // Activate the neighbour, preferring the one to the left.
      activeId = remaining[Math.max(0, idx - 1)].id;
    }
    commit();
  },

  closeAllTabs(): void {
    const fresh = createTab(HOME_URL);
    tabs = [fresh];
    activeId = fresh.id;
    commit();
  },

  setActiveTab(id: string): void {
    if (activeId === id || !tabs.some((t) => t.id === id)) return;
    activeId = id;
    commit();
  },

  updateTab(id: string, patch: Partial<Omit<IWebTab, 'id'>>): void {
    let changed = false;
    tabs = tabs.map((t) => {
      if (t.id !== id) return t;
      // Skip no-op updates so we don't re-render on every navigation tick.
      const merged = { ...t, ...patch };
      const isSame = (Object.keys(patch) as (keyof IWebTab)[]).every(
        (k) => t[k] === merged[k],
      );
      if (isSame) return t;
      changed = true;
      return merged;
    });
    if (changed) commit();
  },

  // Test helper.
  _reset(): void {
    counter = 0;
    const fresh = createTab(HOME_URL);
    tabs = [fresh];
    activeId = fresh.id;
    commit();
  },
};
