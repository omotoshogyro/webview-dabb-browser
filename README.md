# onekey-mini-dapp-browser

A minimal, understandable clone of OneKey's in-app dapp browser (the "Discovery"
tab), built as a standalone Expo React Native app. It replicates the **exact
architecture** — an injected `window.ethereum` provider, a `JsBridge` host that
stamps a trusted origin, a `scope`-based router, a provider backend that opens
approval modals, and reverse EIP-1193 events — with a hand-rolled bridge and a
**mock** (no real crypto) signing backend.

## Run it

```bash
npm install
npm run ios      # or: npm run android
npm test         # background-layer unit tests (8 tests)
npm run typecheck
```

Then load `https://metamask.github.io/test-dapp/` (it's the default home page) and
try Connect / Personal Sign / Send — each pops the approval modal.

## The message envelope

One JSON shape in each direction:

```jsonc
// dapp -> wallet (request)
{ "id": 12, "scope": "ethereum", "data": { "method": "eth_requestAccounts", "params": [] } }

// wallet -> dapp (response)
{ "id": 12, "data": { "result": ["0x1111..."] } }
{ "id": 12, "error": { "code": 4001, "message": "User rejected" } }

// wallet -> dapp (unsolicited event, no id)
{ "scope": "ethereum", "data": { "method": "metamask_accountsChanged", "params": ["0x1111..."] } }
```

## End-to-end flow

```
dapp: window.ethereum.request({ method: 'eth_requestAccounts' })
  → injectedProvider posts { id, scope, data } via ReactNativeWebView.postMessage
  → DappWebView.onMessage → jsBridge.receive(data, { origin: <real URL> })
  → receiveHandler({ scope, method, params, origin })     [scope router]
  → ProviderApiEthereum → approvalService.request({ type:'connect', origin })
  → ApprovalModal shows; user taps Approve → the awaited Promise resolves
  → returns [address] → jsBridge.send({ id, data:{ result:[address] } })
  → injected __walletBridgeReceive matches id → resolves the dapp's Promise
  ← later: walletDebug.switchChain() → jsBridge.emit('ethereum','metamask_chainChanged','0x…')
```

## File map (and the OneKey file each mirrors)

| File | Mirrors in OneKey | Role |
|---|---|---|
| `src/bridge/injectedProvider.ts` | `@onekeyfe/.../injectedNative.js` | the injected `window.ethereum` (a string) |
| `src/bridge/JsBridgeHost.ts` | `JsBridgeNativeHost` | receive / send / emit; id matching |
| `src/webview/DappWebView.tsx` | `components/WebView/NativeWebView.tsx` | RN WebView; injects provider; stamps origin |
| `src/background/receiveHandler.ts` | `BackgroundApiBase.handleProviderMethods` | route by `scope` |
| `src/background/ProviderApiEthereum.ts` | `kit-bg/providers/ProviderApiEthereum.ts` | per-method dispatch; opens approvals |
| `src/background/approvalService.ts` | `serviceDApp.openConnectionModal` | promise-based approval queue |
| `src/ui/ApprovalModal.tsx` | dApp approval bottom-sheet | renders the head of the queue |
| `src/ui/BrowserScreen.tsx` | `views/Discovery` Browser | address bar + bottom toolbar + tab stack |
| `src/state/tabs.ts` | `jotai/contexts/discovery` atoms | tab list, active tab, add/close |
| `src/ui/BrowserTab.tsx` | `MobileBrowserContent.tsx` | one mounted WebView per tab, frozen when inactive |
| `src/ui/TabSwitcher.tsx` | Discovery tab list | switch / close tabs, new tab |
| `src/webview/webviewRefs.ts` | `explorerUtils.ts` `webviewRefs` | id → live ref registry; fan events to all tabs |

## Multi-tab keep-alive

Every tab is mounted at once. Inactive tabs are hidden with `display: none` **and
frozen** with `<Freeze>` (`react-freeze`) rather than unmounted — exactly OneKey's
`MobileBrowserContent.tsx` pattern. Switching tabs therefore never reloads the page,
never re-injects the provider, and never loses the dapp's session or scroll position.

Imperative actions (navigate, reload, back/forward) don't thread refs through React;
they look the tab up by id in the module-level `webviewRefs` registry. That registry
is also how the background fans an EIP-1193 event out to **every** open tab, the way
OneKey's `requestToAllCS` does.

Bottom toolbar: back · forward · home · tab-count (opens the switcher) · new tab.

## Deliberate simplifications vs OneKey

- **`loadURL` navigates via `window.location.href`.** OneKey patches a native
  `loadUrl` command into `react-native-webview`; vanilla RN has none, so we inject
  navigation instead (no remount, so the page/provider survive).
- **Mock backend.** Addresses and signatures are fake. Swap `ProviderApiEthereum`
  for real `viem`/`ethers` signing + a testnet RPC to make it real, without
  touching the bridge.
- **EVM only.** Add a `solana`/`btc` provider and register it in
  `receiveHandler.ts` exactly as OneKey keys `this.providers[scope]`.
```
