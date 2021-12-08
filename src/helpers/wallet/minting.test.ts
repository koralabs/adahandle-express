import { WalletswalletIdpaymentfeesPayments } from "cardano-wallet-js";
import { consolidateOutputs } from "./minting";

const mockCoinselectionOutputs = [
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qpfrh42ksa8avngttgnk6ane4qwrawzp6ejrlw0c2ljc5xgurdq733jdl8lw6wdmna42gt3dgzs69zaufwfsru7sm6aqqck685",
      "assets": [
          {
              "asset_name": "627269616e",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qzcp7rzyue7lrd9k24xsap4xk0f998x6hvyehwxt4xhn97gmqt3mwy7kp04rvk9rnyamwdph4p94x7wsj2yzcej433dqagxk6k",
      "assets": [
          {
              "asset_name": "746573747465737431",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qrmgygvjwwqz77he0pztfwryzyd4lc8sw35hyjl567p7l4y3rkc4hmdyag54xn97gncvz8g96d72rlwc4jf6nar3eu6sm8a5dc",
      "assets": [
          {
              "asset_name": "646564613232",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qpt4tem7jgqvh2nvrfzzcn4s6dna0z0d477q9qjg56wa97drq0ctn7ka0x294gj3r8zer0zjauq465g887xtcrw3e7xs8hh9e5",
      "assets": [
          {
              "asset_name": "73746f70",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qzskxw6403ll280jxw3nd5a9zjwjgp3u2rhzmn9ajjrq6y7k28kvg80m8p5yfkda5qkpmxs5243hysyp4ah9nx8ugrxs9rj3e5",
      "assets": [
          {
              "asset_name": "6c696c697468",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q",
      "assets": [
          {
              "asset_name": "78617239",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qqs8ar03mszl2tjvgk8da55zrv2v8alwtkm2qun6e5ae077mr2xmezxll9smqj5zpc92j6u95l2qvjctw4a9nnw6mv5q5xs7wq",
      "assets": [
          {
              "asset_name": "68617264646179736e69676874",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qrr8p60v5g3dljck2ltpu5uaytmjxlw9l8vtexl5p8z6dw6v4y7mqr2gu30mxu449qh2j69sqm7929x0hwpujk5dfw0sw0t87q",
      "assets": [
          {
              "asset_name": "656c657068616e74696e726f6f6d",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qzcp7rzyue7lrd9k24xsap4xk0f998x6hvyehwxt4xhn97gmqt3mwy7kp04rvk9rnyamwdph4p94x7wsj2yzcej433dqagxk6k",
      "assets": [
          {
              "asset_name": "74657374333332",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qrr8p60v5g3dljck2ltpu5uaytmjxlw9l8vtexl5p8z6dw6v4y7mqr2gu30mxu449qh2j69sqm7929x0hwpujk5dfw0sw0t87q",
      "assets": [
          {
              "asset_name": "74686568617070796c616e65",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qrje6krztj5jx4kf2tfaqq9tey6cg7em2heqg2nshg82f7fwyyu38gjecrtyqynvwe027v2x6fnhz85edn44lrtrep5snk505z",
      "assets": [
          {
              "asset_name": "79757975",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qq7cqr5telum0hr0gyl54hvqyjh22gqkuvdhf6phdtjsza8z546w399c48pgkl6qp9kgxx2ny9488x7fzwn0hxuhp62s3tq8tm",
      "assets": [
          {
              "asset_name": "6c6971756964",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qr0pz7nj87z7hh03w2uk25q944eqh4lagegavv0wlqh35thrjuystvnxa4uraydg2lj3whj7q8c5uvjcnjdkrnkvy74qteksnp",
      "assets": [
          {
              "asset_name": "70726f67616d6572313233",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qpvaswzhusqpgufgwghvjkenwgrfuztksefaz4w2p69w79lan4acsu62leue4yrwmt6spxr8qzpkmw2vw59mlgr2jags0ucl69",
      "assets": [
          {
              "asset_name": "64726f707461626c6573",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qzcp7rzyue7lrd9k24xsap4xk0f998x6hvyehwxt4xhn97gmqt3mwy7kp04rvk9rnyamwdph4p94x7wsj2yzcej433dqagxk6k",
      "assets": [
          {
              "asset_name": "746573747465737432",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qr9yqaq5cqdzwlm68h3tuwgm4599raqvursj3lz3hxn2c3g63ja73yk7s4ndk38tlnpnkha4q7z9yh8zdankc8mprc8q92nxds",
      "assets": [
          {
              "asset_name": "696e7465726e6574",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qz5nl4t5xwa5vut8smt4upk64v5dj5rkdupp6vwam2hplev7k9fcwefqwx9h3vlqjhvqt2qntxhdugzvr83c5al6tptqd5xnff",
      "assets": [
          {
              "asset_name": "63726f6e756c6c61",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qphn305punufcq7evhc9uvj53u8xjmmm6yhf4rgcwmvqg253rkc4hmdyag54xn97gncvz8g96d72rlwc4jf6nar3eu6swm9np6",
      "assets": [
          {
              "asset_name": "64656976736f6e73696c7661",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qzs07sm20s4yrljktq3w7rav4tyn0jpx8u3x56zxahqkksqtg523nlr9kvld2mll684dcstv5u5l6u54qepmhqlsnkhsvylqnk",
      "assets": [
          {
              "asset_name": "706f73746d616c6f6e65",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qzvz6aqn20mdwckneu9j9e7w994gdkt77kcksrx4y077pe5allejj29m2ea820mhjznljvdcvttfdx86uxw75y0k0v0s3s8v89",
      "assets": [
          {
              "asset_name": "616c69",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 334235424,
          "unit": "lovelace"
      },
      "address": "addr_test1qpt36zntw2dfhptfdctukkjwtw3denaq89r9593dyejwfuz8uqfk3mdgv545gvcn8dj8xq6mn406agld63wnrwxgc5xsmltyhy",
      "assets": []
  }
];

const expectedCoinselectionOutputs = [
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qpfrh42ksa8avngttgnk6ane4qwrawzp6ejrlw0c2ljc5xgurdq733jdl8lw6wdmna42gt3dgzs69zaufwfsru7sm6aqqck685",
      "assets": [
          {
              "asset_name": "627269616e",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 4407403,
          "unit": "lovelace"
      },
      "address": "addr_test1qzcp7rzyue7lrd9k24xsap4xk0f998x6hvyehwxt4xhn97gmqt3mwy7kp04rvk9rnyamwdph4p94x7wsj2yzcej433dqagxk6k",
      "assets": [
          {
              "asset_name": "746573747465737431",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          },
          {
              "asset_name": "74657374333332",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          },
          {
              "asset_name": "746573747465737432",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qrmgygvjwwqz77he0pztfwryzyd4lc8sw35hyjl567p7l4y3rkc4hmdyag54xn97gncvz8g96d72rlwc4jf6nar3eu6sm8a5dc",
      "assets": [
          {
              "asset_name": "646564613232",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qpt4tem7jgqvh2nvrfzzcn4s6dna0z0d477q9qjg56wa97drq0ctn7ka0x294gj3r8zer0zjauq465g887xtcrw3e7xs8hh9e5",
      "assets": [
          {
              "asset_name": "73746f70",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qzskxw6403ll280jxw3nd5a9zjwjgp3u2rhzmn9ajjrq6y7k28kvg80m8p5yfkda5qkpmxs5243hysyp4ah9nx8ugrxs9rj3e5",
      "assets": [
          {
              "asset_name": "6c696c697468",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q",
      "assets": [
          {
              "asset_name": "78617239",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qqs8ar03mszl2tjvgk8da55zrv2v8alwtkm2qun6e5ae077mr2xmezxll9smqj5zpc92j6u95l2qvjctw4a9nnw6mv5q5xs7wq",
      "assets": [
          {
              "asset_name": "68617264646179736e69676874",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 2962960,
          "unit": "lovelace"
      },
      "address": "addr_test1qrr8p60v5g3dljck2ltpu5uaytmjxlw9l8vtexl5p8z6dw6v4y7mqr2gu30mxu449qh2j69sqm7929x0hwpujk5dfw0sw0t87q",
      "assets": [
          {
              "asset_name": "656c657068616e74696e726f6f6d",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          },
          {
              "asset_name": "74686568617070796c616e65",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qrje6krztj5jx4kf2tfaqq9tey6cg7em2heqg2nshg82f7fwyyu38gjecrtyqynvwe027v2x6fnhz85edn44lrtrep5snk505z",
      "assets": [
          {
              "asset_name": "79757975",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qq7cqr5telum0hr0gyl54hvqyjh22gqkuvdhf6phdtjsza8z546w399c48pgkl6qp9kgxx2ny9488x7fzwn0hxuhp62s3tq8tm",
      "assets": [
          {
              "asset_name": "6c6971756964",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qr0pz7nj87z7hh03w2uk25q944eqh4lagegavv0wlqh35thrjuystvnxa4uraydg2lj3whj7q8c5uvjcnjdkrnkvy74qteksnp",
      "assets": [
          {
              "asset_name": "70726f67616d6572313233",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qpvaswzhusqpgufgwghvjkenwgrfuztksefaz4w2p69w79lan4acsu62leue4yrwmt6spxr8qzpkmw2vw59mlgr2jags0ucl69",
      "assets": [
          {
              "asset_name": "64726f707461626c6573",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qr9yqaq5cqdzwlm68h3tuwgm4599raqvursj3lz3hxn2c3g63ja73yk7s4ndk38tlnpnkha4q7z9yh8zdankc8mprc8q92nxds",
      "assets": [
          {
              "asset_name": "696e7465726e6574",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qz5nl4t5xwa5vut8smt4upk64v5dj5rkdupp6vwam2hplev7k9fcwefqwx9h3vlqjhvqt2qntxhdugzvr83c5al6tptqd5xnff",
      "assets": [
          {
              "asset_name": "63726f6e756c6c61",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qphn305punufcq7evhc9uvj53u8xjmmm6yhf4rgcwmvqg253rkc4hmdyag54xn97gncvz8g96d72rlwc4jf6nar3eu6swm9np6",
      "assets": [
          {
              "asset_name": "64656976736f6e73696c7661",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1481480,
          "unit": "lovelace"
      },
      "address": "addr_test1qzs07sm20s4yrljktq3w7rav4tyn0jpx8u3x56zxahqkksqtg523nlr9kvld2mll684dcstv5u5l6u54qepmhqlsnkhsvylqnk",
      "assets": [
          {
              "asset_name": "706f73746d616c6f6e65",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 1444443,
          "unit": "lovelace"
      },
      "address": "addr_test1qzvz6aqn20mdwckneu9j9e7w994gdkt77kcksrx4y077pe5allejj29m2ea820mhjznljvdcvttfdx86uxw75y0k0v0s3s8v89",
      "assets": [
          {
              "asset_name": "616c69",
              "quantity": 1,
              "policy_id": "c21f8b778503fbcee295d6e633c125f70bcc16c897d8873163c6577e"
          }
      ]
  },
  {
      "amount": {
          "quantity": 334235424,
          "unit": "lovelace"
      },
      "address": "addr_test1qpt36zntw2dfhptfdctukkjwtw3denaq89r9593dyejwfuz8uqfk3mdgv545gvcn8dj8xq6mn406agld63wnrwxgc5xsmltyhy",
      "assets": []
  }
];

describe('Coinselection Tests', () => {
    it('should consolidate duplicate outputs', async () => {
      expect(mockCoinselectionOutputs).toHaveLength(21);
      const newOutput = consolidateOutputs(mockCoinselectionOutputs as WalletswalletIdpaymentfeesPayments[]);
      expect(newOutput).toHaveLength(18);
      expect(JSON.stringify(newOutput)).toEqual(JSON.stringify(expectedCoinselectionOutputs));
    });
});
