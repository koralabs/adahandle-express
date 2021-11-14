require('dotenv').config();
import { mintHandlesAndSend } from "../../../../helpers/wallet";
import { PaidSession } from "../../../../models/PaidSession";

// last offset: 0
const getMockPaidSessions = () => {
  return [
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-1`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qp0ag3v4w6m799f8ntjh049alzxruqhssmvsgmkaq0ndffrjrgjrtnje9wzl36l67nzqqxe4an9w0usc6p0c925zfemsrv9gf0',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-2`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qp0afpd8p5yf5mq30np2y0dku79duskggtr7gn4k9sqnlaqta6y9q0mq4lrhxpe3mvaac3dz50kt53rf7pj9ms3h867sga98pm',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-3`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qp0afng9fxf4e3ycxd7fedtgw77a96xmmlke3fws8krn7lmjrgjrtnje9wzl36l67nzqqxe4an9w0usc6p0c925zfemse38c8u',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-4`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qp04cyjhvxjp56d8x53y6wg55thf2ul5e27na8spmutststzcj2zc4nue8uxy0d95drvu4reufardm593y6pfj8e8t2qpuwzwu',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-5`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qp049un9uva7eu5y30satg6wskly058jfm929vaardtqwrrzcj2zc4nue8uxy0d95drvu4reufardm593y6pfj8e8t2qs9yfxq',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-6`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qqxes0dkdrxax0emvac5yhqhv3rt5wltfwd63pkul2e7wecuy9dx9904rza5hny9pjgmdtwcxrelg2kae8g78lpyfzyscffrj4',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-7`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qzt42qexhw9lsljr5gtnyava39m4wkfgmvtvnd9lded6juu4lq60rffhezpgq83pma3xjx3dux7ea5zk0jqdsey00nts5l8tn2',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-8`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qqhldxre5k0rlagje44f8t83v0as426ksu5n9x383nchpt8d4z3ghfdwnxesqxhl9hr588ttj7wa4nl6paksm9yu66aq0sjayz',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-9`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qp04474g7kq2r4nd85335hahfd36kq255a93kawqv55mmfrzcj2zc4nue8uxy0d95drvu4reufardm593y6pfj8e8t2qwr7gev',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `loadTest-bundle-10`,
      phoneNumber: '+11234567890',
      start: Date.now(),
      wallet: {
        address: 'addr_test1qz7zqtn5qqrs77g7dtsw5gdcngachlf0mex454np059czv68uqfk3mdgv545gvcn8dj8xq6mn406agld63wnrwxgc5xsjxzdph',
      }
    })
  ]
}

export const mintMockHandlesAndSend = async (index: number = 0) => {
  if (index > 25) {
    return;
  }

  const paidSessions = getMockPaidSessions();
  console.log(`minting sessions in batch (${index}): ${paidSessions.length}`);
  await mintHandlesAndSend(paidSessions);
  // const promises = paidSessions.map(async (session) => {
  //   try {
  //     const res = await mintHandleAndSend(session);
  //     return res;
  //   } catch (e) {
  //     return false;
  //   }
  // });

  // const processed = await Promise.all(promises);
  // console.log(`minted sessions in batch ${index}: ${processed.filter(session => false !== session).length}`)

  // setTimeout(() => mintMockHandlesAndSend(index + 1), 60000);
};

const run = async () => {
    console.log(`starting`);
    console.time("mintMockHandleAndSend");
    const results = await mintMockHandlesAndSend();
    console.timeEnd("mintMockHandleAndSend");
    // console.log(`count: ${results.length}`);
}

run();
