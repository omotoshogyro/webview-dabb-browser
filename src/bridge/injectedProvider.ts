// The injected EIP-1193 provider.
//
// This is the equivalent of OneKey's prebuilt `injectedNative.js`
// (@onekeyfe/cross-inpage-provider-injected), hand-written and EVM-only.
//
// The string returned here runs INSIDE the dapp page, before its content loads
// (react-native-webview `injectedJavaScriptBeforeContentLoaded`). It installs
// `window.ethereum` and a global receiver `window.__walletBridgeReceive` that the
// native side calls back via `injectJavaScript`.
//
// Transport is one JSON envelope in each direction:
//   dapp -> wallet:  window.ReactNativeWebView.postMessage(JSON.stringify({ id, scope, data:{method,params} }))
//   wallet -> dapp:  window.__walletBridgeReceive({ id, data:{result} } | { id, error } | { scope, data:{method,params} })

export function getInjectedProviderCode(): string {
  // NOTE: this body is serialized to a string and evaluated in the WebView.
  // Keep it ES5-ish and self-contained — it cannot reference anything outside.
  return `
(function () {
  if (window.ethereum && window.ethereum.__isWalletMiniBridge) { return; }

  var idCounter = 1;
  var pending = {};
  var listeners = {};

  function emit(event, data) {
    (listeners[event] || []).slice().forEach(function (fn) {
      try { fn(data); } catch (e) {}
    });
  }

  function postToNative(msg) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  function request(args) {
    args = args || {};
    var id = idCounter++;
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      postToNative({ id: id, scope: 'ethereum', data: { method: args.method, params: args.params || [] } });
    });
  }

  // Global receiver: the native JsBridgeHost calls this via injectJavaScript.
  window.__walletBridgeReceive = function (msg) {
    try {
      // A response to a pending request (has matching id).
      if (msg && msg.id != null && pending[msg.id]) {
        var p = pending[msg.id];
        delete pending[msg.id];
        if (msg.error) {
          var err = new Error((msg.error && msg.error.message) || 'Provider error');
          err.code = msg.error && msg.error.code;
          p.reject(err);
        } else {
          p.resolve(msg.data ? msg.data.result : undefined);
        }
        return;
      }
      // An unsolicited event (no id) -> emit as EIP-1193 event.
      if (msg && msg.data && msg.data.method) {
        var m = msg.data.method;
        var params = msg.data.params;
        if (m === 'metamask_accountsChanged') { emit('accountsChanged', params); }
        else if (m === 'metamask_chainChanged') { emit('chainChanged', params); }
        else { emit('message', { type: m, data: params }); }
      }
    } catch (e) {}
  };

  var provider = {
    __isWalletMiniBridge: true,
    isMetaMask: true, // many dapps gate their connect button on this
    isOneKey: true,
    chainId: null,
    networkVersion: null,
    selectedAddress: null,
    request: request,
    on: function (event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
      return provider;
    },
    removeListener: function (event, fn) {
      listeners[event] = (listeners[event] || []).filter(function (f) { return f !== fn; });
      return provider;
    },
    // Legacy compatibility shims.
    enable: function () { return request({ method: 'eth_requestAccounts' }); },
    sendAsync: function (payload, cb) {
      request({ method: payload.method, params: payload.params }).then(
        function (result) { cb(null, { id: payload.id, jsonrpc: '2.0', result: result }); },
        function (error) { cb(error, null); }
      );
    },
    send: function (payload, cb) {
      if (typeof cb === 'function') { return provider.sendAsync(payload, cb); }
      return request({ method: payload && payload.method ? payload.method : payload, params: [] });
    }
  };

  // Keep convenience fields in sync with events.
  provider.on('accountsChanged', function (accounts) {
    provider.selectedAddress = accounts && accounts.length ? accounts[0] : null;
  });
  provider.on('chainChanged', function (chainId) {
    provider.chainId = chainId;
    provider.networkVersion = parseInt(chainId, 16) + '';
  });

  window.ethereum = provider;

  // EIP-6963: announce the provider so modern dapps can discover it.
  function announce() {
    var info = {
      uuid: '350670db-19fa-4704-a166-e52e178b59d2',
      name: 'Wallet Mini',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
      rdns: 'so.onekey.mini'
    };
    try {
      window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
        detail: Object.freeze({ info: info, provider: provider })
      }));
    } catch (e) {}
  }
  window.addEventListener('eip6963:requestProvider', announce);
  announce();

  try { emit('connect', { chainId: provider.chainId }); } catch (e) {}
})();
true;
`;
}
