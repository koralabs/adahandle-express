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
): Promise<string> => {
  const logStart = Date.now();
  Logger.log({ message: `Started generating Handle image for $${handle}...`, event: 'getIPFSImage' });
  const ipfs = new BlockFrostIPFS({
    projectId: process.env.IPFS_KEY as string
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
    } catch (e) {
      Logger.log({ message: `Image generation error for $${handle}. Log: ${JSON.stringify(e)}`, event: 'getIPFSImage.htmlToImage', category: LogCategory.ERROR });
      throw e;
    }

    let res;
    try {
      res = await ipfs.add(outputSlug);
    } catch (e) {
      Logger.log({ message: `Blockfrost errored for $${handle}. Log: ${JSON.stringify(e)}`, event: 'getIPFSImage.ipfs.add', category: LogCategory.ERROR });
      throw e;
    }

    try {
      const pinataClient = Pinata(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);
      await pinataClient.pinByHash(res.ipfs_hash);
    } catch (e) {
      Logger.log({ message: `Pinata errored for $${handle}. Log: ${JSON.stringify(e)}`, event: 'getIPFSImage.pinByHash', category: LogCategory.ERROR });
    }

    Logger.log({ message: `Finished generating Handle image for $${handle} in ${Date.now() - logStart}ms. `, event: 'getIPFSImage', milliseconds: Date.now() - logStart, category: LogCategory.METRIC });
    return res.ipfs_hash;
  } catch (e) {
    Logger.log({ message: `Failed to generate Handle image for $${handle}. Log: ${JSON.stringify(e)}`, event: 'getIPFSImage', category: LogCategory.ERROR });
    throw new Error(
      'IPFS image generation failed!'
    );
  }
}
