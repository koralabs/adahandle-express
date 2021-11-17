require('dotenv').config();
import { mintHandlesAndSend } from "../../../../helpers/wallet";
import { PaidSession } from "../../../../models/PaidSession";

// last offset: 0
const getMockPaidSessions = () => {
  return [
    new PaidSession({
      cost: 50,
      handle: `bulk3`,
      phoneNumber: '+11234567890',
      start: 1636951812153,
      status: "pending",
      wallet: {
        address: 'addr_test1qp0ar8gt0w8cz0cs6m442zted59j3xf3ux3mc3h7k6rl27mjrgjrtnje9wzl36l67nzqqxe4an9w0usc6p0c925zfemsl5hksg',
      }
    }),
    new PaidSession({
      cost: 50,
      handle: `bulk2`,
      phoneNumber: '+11234567890',
      start: 1636951806345,
      status: "pending",
      wallet: {
        address: 'addr_test1qp0aqefzuwfmtz97s7m8e4lfw2dwx6kurscnjxfqf4q2mqgta6y9q0mq4lrhxpe3mvaac3dz50kt53rf7pj9ms3h867sdm7q2h',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `conrad102`,
      phoneNumber: '+11234567890',
      start: 1636951724265,
      status: "pending",
      wallet: {
        address: 'addr_test1qp0apt7t86fqyx7zncwqh5ze6um993eqaals78ptxj30apmjrgjrtnje9wzl36l67nzqqxe4an9w0usc6p0c925zfemska68n0',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `conrad103`,
      phoneNumber: '+11234567890',
      start: 1636951761791,
      status: "pending",
      wallet: {
        address: 'addr_test1qp0apyt4gqesuujlq2yk387hmh6mfqmf34cev2f9mps0fctjrgjrtnje9wzl36l67nzqqxe4an9w0usc6p0c925zfems5eqm74',
      }
    }),
    new PaidSession({
      cost: 10,
      handle: `conrad101`,
      phoneNumber: '+11234567890',
      start: 1636951713706,
      status: "pending",
      wallet: {
        address: 'addr_test1qp0apnuv4fm46v8w50jeyldw0xp6z8sjcctpf3gvclpsn6tjrgjrtnje9wzl36l67nzqqxe4an9w0usc6p0c925zfems3fszxc',
      }
    }),
    new PaidSession({
      cost: 50,
      handle: `bulk1`,
      phoneNumber: '+11234567890',
      start: 1636951799985,
      status: "pending",
      wallet: {
        address: 'addr_test1qp0aq44f2lw340cl2ly2g3cqx9w3ysz2n8hgncnzl4jjefgta6y9q0mq4lrhxpe3mvaac3dz50kt53rf7pj9ms3h867sdeaunf',
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
