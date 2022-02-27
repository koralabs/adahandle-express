import htmlToImage from 'node-html-to-image';

import { ActiveSession } from '../models/ActiveSession';
import { ReservedHandles } from '../models/firestore/collections/ReservedHandles';
import { CreatedBySystem } from './constants';
import { createNFTImages } from './image';

jest.mock('../models/firestore/collections/ReservedHandles');

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
    it.skip('should create NFT images', async () => {
      jest.spyOn(ReservedHandles, 'getReservedHandles').mockResolvedValue({
        twitter: [{ handle: 'burritos', index: 1 }, { handle: 'tacos' }],
        protected: [],
        private: [],
        spos: []
      });

      const expected1 = {
        content: expect.arrayContaining([
          expect.objectContaining(
          {
            "handle": "burritos",
            "og": true,
            "ogNumber": 1,
            "ogTotal": 2438,
            "output": expect.stringContaining("burritos.jpg"),
          })
        ]),
        html: expect.any(String),
        quality: 100,
        type: 'jpeg'
      }

      const expected2 = {
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
      }

      const htmlToImageSpy = jest.mock('node-html-to-image', () => jest.fn());//jest.spyOn(htmlToImage, 'default');

      await createNFTImages(sessions);

      // Test with index to see the og === true
      expect(htmlToImageSpy).toHaveBeenNthCalledWith(1, expected1);

      // Test without index to see og removed
      expect(htmlToImageSpy).toHaveBeenNthCalledWith(2, expected2);
    });
  });
});