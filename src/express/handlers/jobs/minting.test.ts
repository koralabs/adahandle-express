import { mocked } from "ts-jest/utils";
import { getChainLoad } from "../../../helpers/cardano";
import { StateData } from "../../../models/firestore/collections/StateData";
import { State } from "../../../models/State";
import { mintPaidSessionsHandler } from "./minting";

jest.mock('../../../models/firestore/collections/StateData');
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
    jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .77, position: 10, updateActiveSessions_lock: false, mintPaidSessions_lock: true, totalHandles: 171 }));
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Minting cron is locked. Try again later." });
  });

  it('should not proceed if chain load is too high', async () => {
    jest.spyOn(StateData, 'getStateData').mockResolvedValue(new State({ chainLoad: .90, position: 10, updateActiveSessions_lock: false, mintPaidSessions_lock: false, totalHandles: 171 }));
    mocked(getChainLoad).mockResolvedValue(.90);
    // @ts-expect-error mocking response
    await mintPaidSessionsHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": false, "message": "Chain load is too high." });
  });
});