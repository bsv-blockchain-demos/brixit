/**
 * Backend treasury wallet.
 *
 * Built from a private key + remote storage (wallet-toolbox-client). The full
 * BRC-100 Wallet implementation supports createAction / signAction / etc.,
 * which we need to anchor submissions on chain. ProtoWallet alone could only
 * sign, not fund or broadcast.
 *
 * Initialization is async; this module uses top-level await so all importers
 * (auth middleware, certifier route, submission anchor) see a fully-initialized
 * wallet by the time their handlers run.
 */
import {
  KeyDeriver,
  PrivateKey,
  type WalletInterface,
} from '@bsv/sdk';
import {
  Wallet,
  WalletSigner,
  WalletStorageManager,
  Services,
  StorageClient,
} from '@bsv/wallet-toolbox-client';
import { config } from './config.js';

export const SERVER_WALLET_CHAIN: 'main' | 'test' = 'main';
export const SERVER_WALLET_STORAGE_URL = 'https://store-us-1.bsvb.tech';

if (!config.backendPrivateKey) {
  throw new Error('SERVER_PRIVATE_KEY is not set in environment.');
}

async function makeWallet(
  chain: 'main' | 'test',
  storageURL: string,
  privateKey: string,
): Promise<WalletInterface> {
  const keyDeriver = new KeyDeriver(new PrivateKey(privateKey, 'hex'));
  const storageManager = new WalletStorageManager(keyDeriver.identityKey);
  const signer = new WalletSigner(chain, keyDeriver, storageManager);
  const services = new Services(chain);
  const wallet = new Wallet(signer, services);
  const client = new StorageClient(wallet, storageURL);

  await client.makeAvailable();
  await storageManager.addWalletStorageProvider(client);

  return wallet as unknown as WalletInterface;
}

const serverWallet = await makeWallet(SERVER_WALLET_CHAIN, SERVER_WALLET_STORAGE_URL, config.backendPrivateKey);

export default serverWallet;
