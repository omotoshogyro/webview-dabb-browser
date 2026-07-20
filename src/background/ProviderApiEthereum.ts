// The mock EVM provider backend.
//
// Mirrors OneKey's `ProviderApiEthereum` (+ `ProviderApiBase.handleMethods`): a
// dispatch keyed by RPC method. Read-only methods answer directly; anything that
// grants access or signs first `await`s the approval modal. All crypto is FAKE —
// the point is the architecture (routing + approval flow + reverse events).

import { approvalService } from './approvalService';

interface IWalletState {
  address: string;
  chainId: string; // hex, e.g. '0x1'
  connected: Set<string>; // origins that completed a connect approval
}

const state: IWalletState = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: '0x1',
  connected: new Set<string>(),
};

// The background wants to push events to dapps, but the bridge lives with the
// WebView. OneKey solves this with `backgroundApiProxy.connectBridge`; here the
// UI registers an emitter once the bridge is ready (see BrowserScreen).
type IEmitter = (method: string, params: unknown) => void;
let emitToDapps: IEmitter = () => {};
export function setDappEmitter(fn: IEmitter): void {
  emitToDapps = fn;
}

function rpcError(code: number, message: string): Error & { code: number } {
  const err = new Error(message) as Error & { code: number };
  err.code = code;
  return err;
}

function requireConnected(origin: string): void {
  if (!state.connected.has(origin)) {
    throw rpcError(4100, 'Unauthorized: connect the site first'); // EIP-1193 unauthorized
  }
}

async function connect(origin: string): Promise<string[]> {
  if (!state.connected.has(origin)) {
    await approvalService.request({ type: 'connect', origin, method: 'eth_requestAccounts' });
    state.connected.add(origin);
    emitToDapps('metamask_accountsChanged', [state.address]);
  }
  return [state.address];
}

export const ProviderApiEthereum = {
  async handle({
    method,
    params,
    origin,
  }: {
    method: string;
    params: unknown;
    origin: string;
  }): Promise<unknown> {
    switch (method) {
      // ---- read-only, no approval ----
      case 'eth_chainId':
        return state.chainId;
      case 'net_version':
        return String(parseInt(state.chainId, 16));
      case 'eth_accounts':
        return state.connected.has(origin) ? [state.address] : [];

      // ---- grant access (opens approval modal) ----
      case 'eth_requestAccounts':
        return connect(origin);
      case 'wallet_requestPermissions':
        await connect(origin);
        return [{ parentCapability: 'eth_accounts' }];
      case 'wallet_getPermissions':
        return state.connected.has(origin)
          ? [{ parentCapability: 'eth_accounts' }]
          : [];
      case 'wallet_revokePermissions':
        state.connected.delete(origin);
        emitToDapps('metamask_accountsChanged', []);
        return null;

      // ---- signing (mock result, real approval) ----
      case 'personal_sign':
      case 'eth_sign':
      case 'eth_signTypedData':
      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4': {
        requireConnected(origin);
        await approvalService.request({ type: 'sign', origin, method, payload: params });
        return `0x${'ab'.repeat(65)}`; // mock 65-byte signature
      }
      case 'eth_sendTransaction': {
        requireConnected(origin);
        await approvalService.request({ type: 'tx', origin, method, payload: params });
        return `0x${'cd'.repeat(32)}`; // mock 32-byte tx hash
      }

      // ---- chain management ----
      case 'wallet_switchEthereumChain': {
        const target = (params as { chainId?: string }[] | undefined)?.[0]?.chainId;
        if (target) {
          state.chainId = target;
          emitToDapps('metamask_chainChanged', state.chainId);
        }
        return null;
      }
      case 'wallet_addEthereumChain':
        return null;

      default:
        // A fuller build would proxy read RPC (eth_getBalance, eth_call, ...) to a
        // public node here. For the mock we reject unknown methods.
        throw rpcError(4200, `Method not supported: ${method}`);
    }
  },
};

// Exposed for the demo "emit chainChanged" button and for tests.
export const walletDebug = {
  state,
  switchChain(chainId: string): void {
    state.chainId = chainId;
    emitToDapps('metamask_chainChanged', chainId);
  },
  disconnectAll(): void {
    state.connected.clear();
    emitToDapps('metamask_accountsChanged', []);
  },
};
