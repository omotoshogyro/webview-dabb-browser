import { useCallback, useEffect, useRef } from 'react';

import { StyleSheet, View } from 'react-native';
import { Freeze } from 'react-freeze';

import { receiveHandler } from '../background/receiveHandler';
import { tabsStore, type IWebTab } from '../state/tabs';
import { DappWebView, type IDappWebViewRef } from '../webview/DappWebView';
import {
  registerWebviewRef,
  unregisterWebviewRef,
} from '../webview/webviewRefs';

import type { WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';

// One mounted WebView per tab.
//
// Mirrors OneKey's `MobileBrowserContent.tsx`: EVERY tab stays mounted and the
// inactive ones are FROZEN (react-freeze) rather than unmounted, so switching
// tabs never reloads the page or loses the dapp's session/scroll position.
// `display: none` hides it; <Freeze> stops it re-rendering.

interface IBrowserTabProps {
  tab: IWebTab;
  isActive: boolean;
}

export function BrowserTab({ tab, isActive }: IBrowserTabProps) {
  const webRef = useRef<IDappWebViewRef>(null);

  // Register/unregister this tab's imperative handle in the global registry.
  useEffect(() => {
    const id = tab.id;
    return () => unregisterWebviewRef(id);
  }, [tab.id]);

  const attachRef = useCallback(
    (ref: IDappWebViewRef | null) => {
      webRef.current = ref;
      if (ref) registerWebviewRef(tab.id, ref);
    },
    [tab.id],
  );

  const onNav = useCallback(
    (nav: WebViewNavigation) => {
      tabsStore.updateTab(tab.id, {
        currentUrl: nav.url || tab.currentUrl,
        title: nav.title || '',
        canGoBack: nav.canGoBack,
        canGoForward: nav.canGoForward,
      });
    },
    [tab.id, tab.currentUrl],
  );

  return (
    <View
      style={[styles.container, { display: isActive ? 'flex' : 'none' }]}
      pointerEvents={isActive ? 'auto' : 'none'}
    >
      <Freeze freeze={!isActive}>
        <DappWebView
          ref={attachRef}
          initialUrl={tab.url}
          receiveHandler={receiveHandler}
          onNavigationStateChange={onNav}
        />
      </Freeze>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
