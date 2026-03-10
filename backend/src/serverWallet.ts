import { ProtoWallet, PrivateKey } from '@bsv/sdk';
import { config } from './config.js';

if (!config.backendPrivateKey) {
  throw new Error('SERVER_PRIVATE_KEY is not set in environment.');
}

const serverWallet = new ProtoWallet(PrivateKey.fromString(config.backendPrivateKey));

export default serverWallet;
