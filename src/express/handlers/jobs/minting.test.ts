import { StateData } from "../../../models/firestore/collections/StateData";
import { mintPaidSessionsHandler } from "./minting";
import * as StateFixtures from "../../../tests/stateFixture";
import { CronState } from "../../../models/State";

jest.mock('../../../models/firestore/collections/ActiveSession');
jest.mock('../../../helpers/cardano');
StateFixtures.setupStateFixtures();

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
    StateFixtures.state.mintPaidSessionsLock = CronState.LOCKED;
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Mint Paid Sessions cron is locked. Try again later." });
  });

  it('should not proceed if minting wallet balance is lower than minimum balance', async () => {
    StateFixtures.state.mintPaidSessionsLock = CronState.UNLOCKED;
    StateFixtures.mintingWallet.balance = 99000000;
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Not enough balance in wallet 1234" });
  });

  it('should not proceed if chain load is too high', async () => {
    StateFixtures.state.chainLoad = .90;
    StateFixtures.mintingWallet.balance = 1000000000;
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Chain load is too high." });
  });

  it('should not proceed if there are no available minting wallets', async () => {
    jest.spyOn(StateData, 'findAvailableMintingWallet').mockResolvedValue(null);
    jest.spyOn(StateData, 'allMintingWalletsAreLockedWithNoTransactions').mockResolvedValue(false);
    
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "No available minting wallets." });
  });
});