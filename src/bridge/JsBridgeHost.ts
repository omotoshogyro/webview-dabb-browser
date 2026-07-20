import type { RefObject } from 'react';
import type WebView from 'react-native-webview';

// Mirrors OneKey's `JsBridgeNativeHost` (@onekeyfe/onekey-cross-webview):
// it receives messages the dapp posted, routes them through a `receiveHandler`,
// matches request/response ids, and can push unsolicited events back.

export interface IJsBridgeRequestPayload {
  id?: number;
  scope: string;
  method: string;
  params: unknown;
  // Stamped by the host from the WebView's REAL url — never taken from the dapp.
  origin: string;
}

export type IReceiveHandler = (
  payload: IJsBridgeRequestPayload,
) => Promise<unknown>;

interface IJsBridgeHostOptions {
  webviewRef: RefObject<WebView | null>;
  receiveHandler: IReceiveHandler;
}

interface IIncomingMessage {
  id?: number;
  scope?: string;
  data?: { method?: string; params?: unknown };
}

export class JsBridgeHost {
  private readonly webviewRef: RefObject<WebView | null>;

  private readonly receiveHandler: IReceiveHandler;

  constructor({ webviewRef, receiveHandler }: IJsBridgeHostOptions) {
    this.webviewRef = webviewRef;
    this.receiveHandler = receiveHandler;
  }

  // Called by DappWebView.onMessage with the raw postMessage string + trusted origin.
  async receive(rawData: string, { origin }: { origin: string }): Promise<void> {
    let msg: IIncomingMessage;
    try {
      msg = JSON.parse(rawData) as IIncomingMessage;
    } catch {
      return; // not our envelope, ignore
    }
    if (!msg || !msg.scope || !msg.data || !msg.data.method) {
      return;
    }

    const { id, scope } = msg;
    const { method, params } = msg.data;

    try {
      const result = await this.receiveHandler({
        id,
        scope,
        method,
        params,
        origin,
      });
      if (id != null) {
        this.send({ id, data: { result } });
      }
    } catch (e) {
      const err = e as { code?: number; message?: string };
      if (id != null) {
        this.send({
          id,
          error: {
            code: err?.code ?? -32603,
            message: err?.message ?? 'Internal error',
          },
        });
      }
    }
  }

  // Push a message down into the page by invoking the injected global receiver.
  // This is OneKey's `sendMessageViaInjectedScript` / `createMessageInjectedScript`.
  send(msg: unknown): void {
    const payload = JSON.stringify(msg);
    this.webviewRef.current?.injectJavaScript(
      `window.__walletBridgeReceive && window.__walletBridgeReceive(${payload}); true;`,
    );
  }

  // Fire an unsolicited EIP-1193 event at the dapp (accountsChanged / chainChanged...).
  emit(scope: string, method: string, params: unknown): void {
    this.send({ scope, data: { method, params } });
  }
}
