// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlToImage = require('node-html-to-image');

import { mocked } from 'ts-jest/dist/utils/testing';
import { ActiveSession } from '../models/ActiveSession';
import { ReservedHandles } from '../models/firestore/collections/ReservedHandles';
import { CreatedBySystem } from './constants';
import { createNFTImages } from './image';

jest.mock('../models/firestore/collections/ReservedHandles');
jest.mock('node-html-to-image');

describe('Image Helper Tests', () => {

  const sessions: ActiveSession[] = [
    new ActiveSession({
      emailAddress: '',
      cost: 0,
      handle: 'burritos',
      paymentAddress: '',
      start: 0,
      createdBySystem: CreatedBySystem.UI
    }),
    new ActiveSession({
      emailAddress: '',
      cost: 0,
      handle: 'tacos',
      paymentAddress: '',
      start: 0,
      createdBySystem: CreatedBySystem.UI
    })
  ]

  describe('createNFTImages', () => {
    it('should create NFT images', async () => {
      jest.spyOn(ReservedHandles, 'getReservedHandles').mockResolvedValue({
        twitter: [{ handle: 'burritos', index: 1 }, { handle: 'tacos' }],
        protected: [],
        private: [],
        spos: []
      });

      const htmlToImageSpy = mocked(htmlToImage);

      await createNFTImages(sessions);

      // Test with index to see the og === true
      expect(htmlToImageSpy).toHaveBeenNthCalledWith(1, {
        content: expect.arrayContaining([
          expect.objectContaining(
            {
              "handle": "burritos",
              "og": true,
              "ogNumber": 1,
              "ogTotal": 2,
              "output": expect.stringContaining("burritos.jpg"),
            }
          )
        ]),
        html: expect.any(String),
        quality: 100,
        type: 'jpeg'
      });

      // Test without index to see og removed
      expect(htmlToImageSpy).toHaveBeenNthCalledWith(2, {
        content: expect.arrayContaining([
          expect.objectContaining(
            {
              "handle": "tacos",
              "output": expect.stringContaining("tacos.jpg"),
            }
          )
        ]),
        html: expect.any(String),
        quality: 100,
        type: 'jpeg'
      });
    });
  });
});