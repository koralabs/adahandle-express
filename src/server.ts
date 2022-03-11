// Increase memory limit for generating images.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('events').defaultMaxListeners = 20;

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { startServer } from './express';
import { Logger, LogCategory } from './helpers/Logger'
import { Firebase } from './helpers/firebase';

const startApp = async () => {
  // If either is set to production, they both should be production or exit  
  if (process.env.NODE_ENV?.trim() === 'production' || process.env.MAC_ENV?.trim() === 'production'){
    if (process.env.NODE_ENV?.trim() != process.env.MAC_ENV?.trim()){
      Logger.log({ message: `NODE_ENV is set to ${process.env.NODE_ENV?.trim() || '' } but Machine_Environment is '${process.env.MAC_ENV?.trim() || ''}'`, event: 'server.start', category: LogCategory.NOTIFY });
      return;
    }
  }
  await Firebase.init();
  startServer();
}

startApp();
