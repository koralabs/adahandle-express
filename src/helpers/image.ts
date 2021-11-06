// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlToImage = require('node-html-to-image');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Pinata = require('@pinata/sdk');

import { BlockFrostIPFS } from '@blockfrost/blockfrost-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getRaritySlug } from './nft';

export const getIPFSImage = async (
  handle: string,
  og: boolean,
  ogNumber: number,
  ogTotal: number
): Promise<{
  hash: string;
} | false> => {
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

    return {
      hash: res.ipfs_hash
    }
  } catch (e) {
    console.log(e);
    return false;
  }
}
