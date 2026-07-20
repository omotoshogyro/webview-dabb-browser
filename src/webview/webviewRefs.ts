// Module-level registry of live WebView refs, keyed by tab id.
//
// This is OneKey's `explorerUtils.ts` `webviewRefs` map: imperative actions
// (navigate, reload, back) look a tab up by id rather than threading refs
// through React. It also lets the background fan events out to every tab,
// the way OneKey's `requestToAllCS` does.

import type { IDappWebViewRef } from './DappWebView';

const webviewRefs: Record<string, IDappWebViewRef> = {};

export function registerWebviewRef(id: string, ref: IDappWebViewRef): void {
  webviewRefs[id] = ref;
}

export function unregisterWebviewRef(id: string): void {
  delete webviewRefs[id];
}

export function getWebviewRef(id: string): IDappWebViewRef | undefined {
  return webviewRefs[id];
}

export function getAllWebviewRefs(): IDappWebViewRef[] {
  return Object.values(webviewRefs);
}

// Fan an EIP-1193 event out to every open tab (OneKey: requestToAllCS).
export function emitToAllTabs(
  scope: string,
  method: string,
  params: unknown,
): void {
  getAllWebviewRefs().forEach((ref) => {
    try {
      ref.jsBridge.emit(scope, method, params);
    } catch {
      // a tab may be tearing down; ignore
    }
  });
}
