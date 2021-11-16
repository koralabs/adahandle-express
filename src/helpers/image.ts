// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlToImage = require('node-html-to-image');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Pinata = require('@pinata/sdk');

import { BlockFrostIPFS } from '@blockfrost/blockfrost-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { LogCategory, Logger } from './Logger';
import { getRaritySlug } from './nft';

export const getIPFSImage = async (
  handle: string,
  og: boolean,
  ogNumber: number,
  ogTotal: number
): Promise<{
  hash: string;
} | false> => {
  const logStart = Date.now();
  Logger.log({ message: `Started generating Handle image for $${handle}...`, event: 'getIPFSImage' });
  const ipfs = new BlockFrostIPFS({
    projectId: process.env.BLOCKFROST_API_KEY!
  });

  const slug = getRaritySlug(handle);
  const target = slug.replace(' ', '-').toLowerCase();
  const path = resolve(__dirname, `../../src/nftTemplates/${target}.html`);
  const html = readFileSync(path).toString();
  const outputPath = resolve(__dirname, '../../bin');
  const outputSlug = `${outputPath}/${handle}.jpg`;

  let templateContent = {};
  if (og) {
    templateContent = {
      og,
      ogNumber,
      ogTotal
    }
  }

  try {
    await htmlToImage({
      output: outputSlug,
      html,
      quality: 100,
      type: 'jpeg',
      pupeteerArgs: {
        executablePath: '/usr/bin/chromium-browser'
      },
      content: {
        handle,
        ...templateContent
      },
    });

    const res = await ipfs.add(outputSlug);

    if (!res) {
      return false;
    }

    const pinataClient = Pinata(process.env.PINATA_API_KEY!, process.env.PINATA_API_SECRET!);
    await pinataClient.pinByHash(res.ipfs_hash);

    Logger.log({ message: `Finished generating Handle image for $${handle} in ${Date.now() - logStart}ms. `, event: 'getIPFSImage', category: LogCategory.METRIC });

    return {
      hash: res.ipfs_hash
    }
  } catch (e) {
    Logger.log({ message: `Failed to generate Handle image for $${handle}. Log: ${JSON.stringify(e)}`, event: 'getIPFSImage', category: LogCategory.ERROR });
    return false;
  }
}
