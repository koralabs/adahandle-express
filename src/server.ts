// Increase memory limit for generating images.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('events').defaultMaxListeners = 20;

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { startServer } from './express';
import { Logger, LogCategory } from './helpers/Logger'
import { Firebase } from './helpers/firebase';

console.log(`ENV_SMTP_HOST=${process.env.ENV_SMTP_HOST}`);
const startApp = async () => {
  // If either is set to production, they both should be production or exit  
  if (process.env.NODE_ENV?.trim() === 'production' || process.env.Machine_Environment?.trim() === 'production'){
    if (process.env.NODE_ENV?.trim() != process.env.Machine_Environment?.trim()){
      Logger.log({ message: `NODE_ENV is set to ${process.env.NODE_ENV?.trim() || '' } but Machine_Environment is '${process.env.Machine_Environment?.trim() || ''}'`, event: 'server.start', category: LogCategory.NOTIFY });
      return;
    }
  }
  await Firebase.init();
  startServer();
}

startApp();
