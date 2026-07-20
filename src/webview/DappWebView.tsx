import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { getInjectedProviderCode } from '../bridge/injectedProvider';
import { JsBridgeHost, type IReceiveHandler } from '../bridge/JsBridgeHost';

import type {
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview/lib/WebViewTypes';

// Mirrors OneKey's `NativeWebView.tsx`: it owns the JsBridge, injects the
// provider before content loads, and stamps the trusted origin from the real URL.

export interface IDappWebViewRef {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  loadURL: (url: string) => void;
  jsBridge: JsBridgeHost;
}

interface IDappWebViewProps {
  initialUrl: string;
  receiveHandler: IReceiveHandler;
  onNavigationStateChange?: (nav: WebViewNavigation) => void;
}

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: 'transparent' },
});

const INJECTED = getInjectedProviderCode();

function getOriginFromUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export const DappWebView = forwardRef<IDappWebViewRef, IDappWebViewProps>(
  ({ initialUrl, receiveHandler, onNavigationStateChange }, ref) => {
    const webviewRef = useRef<WebView>(null);

    // The bridge is exposed on the imperative handle; the tab registers that
    // handle in `webviewRefs`, which is this app's equivalent of OneKey's
    // `backgroundApiProxy.connectBridge` (it's how the background reaches dapps).
    const jsBridge = useMemo(
      () => new JsBridgeHost({ webviewRef, receiveHandler }),
      [receiveHandler],
    );

    const onMessage = useCallback(
      (event: WebViewMessageEvent) => {
        const { data, url } = event.nativeEvent;
        // Trusted origin from the WebView's real URL — not from the message. (OneKey NativeWebView.tsx:81)
        const origin = getOriginFromUrl(url || initialUrl);
        if (origin) {
          void jsBridge.receive(data, { origin });
        }
      },
      [jsBridge, initialUrl],
    );

    useImperativeHandle(
      ref,
      (): IDappWebViewRef => ({
        reload: () => webviewRef.current?.reload(),
        goBack: () => webviewRef.current?.goBack(),
        goForward: () => webviewRef.current?.goForward(),
        // Vanilla react-native-webview has no imperative `loadUrl` (OneKey patches
        // one in). We navigate the existing page instead — no remount, so the
        // injected provider + page state survive, matching OneKey's keep-alive intent.
        loadURL: (url: string) =>
          webviewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(url)}; true;`,
          ),
        jsBridge,
      }),
      [jsBridge],
    );

    return (
      <WebView
        ref={webviewRef}
        source={{ uri: initialUrl }}
        style={styles.webview}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={INJECTED}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationStateChange}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        // Hardening, mirroring OneKey's NativeWebView props:
        cacheEnabled={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        fraudulentWebsiteWarningEnabled={false}
        allowsBackForwardNavigationGestures
        webviewDebuggingEnabled
      />
    );
  },
);

DappWebView.displayName = 'DappWebView';
