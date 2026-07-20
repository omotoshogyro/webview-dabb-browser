import { HOME_URL, tabsStore } from '../tabs';

beforeEach(() => {
  tabsStore._reset();
});

describe('tabsStore', () => {
  it('starts with one home tab that is active', () => {
    const { tabs, activeId } = tabsStore.getSnapshot();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].url).toBe(HOME_URL);
    expect(activeId).toBe(tabs[0].id);
  });

  it('addTab appends and activates the new tab', () => {
    const id = tabsStore.addTab('https://app.uniswap.org');
    const { tabs, activeId } = tabsStore.getSnapshot();
    expect(tabs).toHaveLength(2);
    expect(activeId).toBe(id);
    expect(tabs[1].url).toBe('https://app.uniswap.org');
  });

  it('caps the number of tabs', () => {
    for (let i = 0; i < 20; i += 1) tabsStore.addTab();
    expect(tabsStore.getSnapshot().tabs.length).toBeLessThanOrEqual(10);
    // adding past the cap returns undefined rather than throwing
    expect(tabsStore.addTab()).toBeUndefined();
  });

  it('closing the active tab activates its left neighbour', () => {
    const a = tabsStore.getSnapshot().tabs[0].id;
    const b = tabsStore.addTab()!;
    const c = tabsStore.addTab()!;
    expect(tabsStore.getSnapshot().activeId).toBe(c);

    tabsStore.closeTab(c);
    expect(tabsStore.getSnapshot().activeId).toBe(b);

    tabsStore.closeTab(b);
    expect(tabsStore.getSnapshot().activeId).toBe(a);
  });

  it('closing an inactive tab keeps the active one', () => {
    const a = tabsStore.getSnapshot().tabs[0].id;
    const b = tabsStore.addTab()!;
    tabsStore.setActiveTab(a);
    tabsStore.closeTab(b);
    expect(tabsStore.getSnapshot().activeId).toBe(a);
    expect(tabsStore.getSnapshot().tabs).toHaveLength(1);
  });

  it('closing the last tab leaves a fresh home tab (never zero)', () => {
    const only = tabsStore.getSnapshot().tabs[0].id;
    tabsStore.closeTab(only);
    const { tabs, activeId } = tabsStore.getSnapshot();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].url).toBe(HOME_URL);
    expect(activeId).toBe(tabs[0].id);
  });

  it('returns a stable snapshot identity until state changes', () => {
    const first = tabsStore.getSnapshot();
    expect(tabsStore.getSnapshot()).toBe(first); // same object -> no render loop
    tabsStore.addTab();
    expect(tabsStore.getSnapshot()).not.toBe(first);
  });

  it('updateTab ignores no-op patches (keeps snapshot identity)', () => {
    const id = tabsStore.getSnapshot().tabs[0].id;
    tabsStore.updateTab(id, { title: 'Test Dapp' });
    const afterFirst = tabsStore.getSnapshot();
    tabsStore.updateTab(id, { title: 'Test Dapp' }); // identical -> no commit
    expect(tabsStore.getSnapshot()).toBe(afterFirst);
  });

  it('notifies subscribers on change', () => {
    let calls = 0;
    const unsub = tabsStore.subscribe(() => {
      calls += 1;
    });
    tabsStore.addTab();
    expect(calls).toBe(1);
    unsub();
    tabsStore.addTab();
    expect(calls).toBe(1);
  });
});
