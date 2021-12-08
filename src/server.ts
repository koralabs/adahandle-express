// Increase memory limit for generating images.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('events').defaultMaxListeners = 20;

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { startServer } from './express';
import { Firebase } from './helpers/firebase';


const startApp = async () => {
  await Firebase.init();
  startServer();
}

startApp();
