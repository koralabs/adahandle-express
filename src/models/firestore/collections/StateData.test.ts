import { StateData } from "./StateData";

describe('StateData Tests', () => {
  it('should have the correct collection name for develop', () => {
    expect(StateData.collectionName).toEqual('stateData_dev');
  })
});