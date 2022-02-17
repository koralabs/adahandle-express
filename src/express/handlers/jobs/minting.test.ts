import * as cardanoHelper from "../../../helpers/cardano";
import { StateData } from "../../../models/firestore/collections/StateData";
import { State } from "../../../models/State";
import { mintPaidSessionsHandler } from "./minting";

jest.mock('../../../models/firestore/collections/StateData');
jest.mock('../../../models/firestore/collections/ActiveSession');
jest.mock('../../../helpers/cardano');

describe('mintPaidSessionsHandler Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      // @ts-expect-error mocking response
      status: jest.fn(() => mockResponse),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not proceed if locked', async () => {
    jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, mintPaidSessionsLock: true, totalHandles: 171 }));
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Mint Paid Sessions cron is locked. Try again later." });
  });

  it('should not proceed if there are no available minting wallets', async () => {
    jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .90, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, mintPaidSessionsLock: false, totalHandles: 171, chainLoadThresholdPercent: .80 }));
    jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(true);
    jest.spyOn(cardanoHelper, 'getChainLoad').mockResolvedValue(.90);
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "No available wallets." });
  });

  it('should not proceed if chain load is too high', async () => {
    jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .90, accessQueueSize: 10, mintingQueueSize: 10, updateActiveSessionsLock: false, mintPaidSessionsLock: false, totalHandles: 171, chainLoadThresholdPercent: .80 }));
    jest.spyOn(StateData, 'checkAndLockCron').mockResolvedValue(true);
    jest.spyOn(StateData, 'findAvailableMintingWallet').mockResolvedValue({
      id: '1234',
      index: 1,
      locked: false
    });
    jest.spyOn(cardanoHelper, 'getChainLoad').mockResolvedValue(.90);
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Chain load is too high." });
  });
});