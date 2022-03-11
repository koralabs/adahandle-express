// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlToImage = require('node-html-to-image');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Pinata = require('@pinata/sdk');

import { BlockFrostIPFS } from '@blockfrost/blockfrost-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ActiveSession } from '../models/ActiveSession';
import { ReservedHandles } from '../models/firestore/collections/ReservedHandles';
import { TWITTER_OG_SIZE } from './constants';
import { LogCategory, Logger } from './Logger';
import { getRaritySlug } from './nft';

export const createNFTImages = async (sessions: ActiveSession[]) => {
  const rarities = {};
  const twitterHandles = (await ReservedHandles.getReservedHandles()).twitter;

  sessions.forEach((session) => {
    const outputPath = resolve(__dirname, '../../bin');
    const output = `${outputPath}/${session.handle}.jpg`;
    const twitterHandle = twitterHandles.find(({ handle }) => handle === session.handle);
    const ogNumber = twitterHandle?.index;
    let templateContent = {};
    if (twitterHandle && ogNumber) {
      templateContent = {
        og: true,
        ogNumber,
        ogTotal: TWITTER_OG_SIZE
      }
    }
    const slug = getRaritySlug(session.handle)
    if (!rarities[slug]) {
      rarities[slug] = [];
    }
    rarities[slug].push({
      handle: session.handle,
      ...templateContent,
      output
    });
  });

  await Promise.all(Object.keys(rarities).map(async (rarity) => {
    Logger.log({ message: `Started generating ${rarities[rarity].length} Handle images...`, event: 'getIPFSImage.generateImages' });
    const target = rarity.replace(' ', '-').toLowerCase();
    const path = resolve(__dirname, `../../src/htmlTemplates/nft-${target}.html`);
    const html = readFileSync(path).toString();
    await htmlToImage({
      html,
      quality: 100,
      type: 'jpeg',
      content: rarities[rarity]
    });
  }));
}

export const getIPFSImage = async (handle: string): Promise<string> => {
  const logStart = Date.now();
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
    const pinataClient = Pinata(process.env.PINATA_API_KEY || '', process.env.PINATA_API_SECRET || '');
    await pinataClient.pinByHash(res.ipfs_hash, {pinataMetadata:{name:handle}} );
  } catch (e) {
    Logger.log({ message: `Pinata errored for $${handle}. Log: ${JSON.stringify(e)}`, event: 'getIPFSImage.pinByHash', category: LogCategory.ERROR });
  }

  Logger.log({ message: `Finished IPFS image entry for $${handle} in ${Date.now() - logStart}ms. `, event: 'getIPFSImage', milliseconds: Date.now() - logStart, category: LogCategory.METRIC });
  return res.ipfs_hash;
}
