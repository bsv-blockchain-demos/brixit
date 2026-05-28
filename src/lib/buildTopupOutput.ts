// Sender side of a BRC-29 wallet payment. Extracted from AdminTreasury so the
// derivation + locking step is unit-testable.
import { P2PKH, PublicKey, type WalletClient, type WalletProtocol } from '@bsv/sdk';

export const BRC29_PROTOCOL: WalletProtocol = [2, '3241645161d8'];

export interface BuildTopupOutputArgs {
  wallet: Pick<WalletClient, 'getPublicKey'>;
  payee: string;
  network: 'mainnet' | 'testnet';
  derivationPrefix: string;
  derivationSuffix: string;
}

export interface BuildTopupOutputResult {
  lockingScript: string;
  customInstructions: string;
  derivedPubKey: string;
  keyID: string;
}

export async function buildTopupOutput(args: BuildTopupOutputArgs): Promise<BuildTopupOutputResult> {
  const keyID = `${args.derivationPrefix} ${args.derivationSuffix}`;

  const { publicKey: derivedPubKey } = await args.wallet.getPublicKey({
    counterparty: args.payee,
    protocolID: BRC29_PROTOCOL,
    keyID,
  });

  const lockingScript = new P2PKH()
    .lock(PublicKey.fromString(derivedPubKey).toAddress(args.network))
    .toHex();

  const customInstructions = JSON.stringify({
    derivationPrefix: args.derivationPrefix,
    derivationSuffix: args.derivationSuffix,
    payee: args.payee,
  });

  return { lockingScript, customInstructions, derivedPubKey, keyID };
}
