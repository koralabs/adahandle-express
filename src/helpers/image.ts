// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlToImage = require('node-html-to-image');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Pinata = require('@pinata/sdk');

import { BlockFrostIPFS } from '@blockfrost/blockfrost-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ReservedHandles } from '../models/firestore/collections/ReservedHandles';
import { PaidSession } from '../models/PaidSession';
import { LogCategory, Logger } from './Logger';
import { getRaritySlug } from './nft';

export const createNFTImages = async (sessions: PaidSession[]) => {
  let rarities = {}; 
  const twitterHandles = (await ReservedHandles.getReservedHandles()).twitter;

  sessions.forEach((session) => {
    const outputPath = resolve(__dirname, '../../bin');
    const output = `${outputPath}/${session.handle}.jpg`;
    const og = twitterHandles.includes(session.handle);
    let templateContent = {};
    if (og) {
      templateContent = {
        og,
        ogNumber:twitterHandles.indexOf(session.handle),
        ogTotal:twitterHandles.length
      }
    }
    const slug = getRaritySlug(session.handle)
    if (!rarities[slug]) {
      rarities[slug]=new Array();
    }
    rarities[slug].push({
      handle: session.handle,
      ...templateContent,
      output
    });
  });
  await Promise.all(Object.keys(rarities).map(async (rarity) => {
    Logger.log({ message: `Started generating ${rarities[rarity].length} Handle images...`, event: 'getIPFSImage' });
    const target = rarity.replace(' ', '-').toLowerCase();
    const path = resolve(__dirname, `../../src/nftTemplates/${target}.html`);
    const html = readFileSync(path).toString();
    await htmlToImage({
      html,
      quality: 100,
      type: 'jpeg',
      pupeteerArgs: {executablePath: '/usr/bin/chromium-browser'},
      content: rarities[rarity]
    });
  }));
}

export const getIPFSImage = async (handle: string): Promise<string> => {
  const logStart = Date.now();
  Logger.log({ message: `Started IPFS image entry for $${handle}...`, event: 'getIPFSImage' });
  const ipfs = new BlockFrostIPFS({
    projectId: process.env.IPFS_KEY as string
  });

  const outputPath = resolve(__dirname, '../../bin');
  const outputSlug = `${outputPath}/${handle}.jpg`;

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

    Logger.log({ message: `Finished IPFS image entry for $${handle} in ${Date.now() - logStart}ms. `, event: 'getIPFSImage', milliseconds: Date.now() - logStart, category: LogCategory.METRIC });
    return res.ipfs_hash;
}
