// The scope router.
//
// Mirrors OneKey's `BackgroundApiBase.handleProviderMethods`: pick a provider by
// `payload.scope` and dispatch. One entry today (`ethereum`); add `solana`,
// `btc`, ... the same way OneKey keys `this.providers[scope]`.

import { ProviderApiEthereum } from './ProviderApiEthereum';

import type { IJsBridgeRequestPayload } from '../bridge/JsBridgeHost';

interface IProviderApi {
  handle(args: {
    method: string;
    params: unknown;
    origin: string;
  }): Promise<unknown>;
}

const providers: Record<string, IProviderApi> = {
  ethereum: ProviderApiEthereum,
};

export async function receiveHandler(
  payload: IJsBridgeRequestPayload,
): Promise<unknown> {
  const provider = providers[payload.scope];
  if (!provider) {
    const err = new Error(`Unknown scope: ${payload.scope}`) as Error & {
      code: number;
    };
    err.code = 4200;
    throw err;
  }
  return provider.handle({
    method: payload.method,
    params: payload.params,
    origin: payload.origin,
  });
}
