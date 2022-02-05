import * as express from "express";
import * as compression from 'compression';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { urlencoded, json } from 'body-parser'
import Router from 'express-promise-router';

// Handlers
import { postToQueueHandler, queuePositionHandler } from "./handlers/queue";
import { verifyHandler } from "./handlers/verify";
import { sessionHandler } from "./handlers/session";
import { handleExistsHandler } from "./handlers/exists";
import { paymentConfirmedHandler } from "./handlers/payment";
import { locationHandler } from './handlers/location';

// Jobs
import { stateHandler } from './handlers/jobs/state';
import { sendAuthCodesHandler } from './handlers/jobs/auth';
import { mintPaidSessionsHandler } from './handlers/jobs/minting';
import { updateSessionsHandler } from './handlers/jobs/sessions';
import { mintConfirmHandler } from "./handlers/jobs/mintConfirm";
import { refundsHandler } from "./handlers/jobs/refunds";
import { searchHandler } from "./handlers/search";

export const startServer = async () => {
  const app = express();
  const router = Router();

  app.use(urlencoded({ extended: true }));
  app.use(json());
  app.use(compression());
  app.use(helmet());
  app.use(router);
  app.use(cookieParser());

  // Set headers.
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, x-firebase-appcheck, x-handle, x-email, x-email-authcode, x-access-token, x-session-token"
    );
    next();
  });

  // Handlers
  app.post("/queue", postToQueueHandler);
  app.post("/queuePosition", queuePositionHandler);
  app.get("/payment", paymentConfirmedHandler);
  app.get("/exists", handleExistsHandler);
  app.get("/verify", verifyHandler);
  app.get("/session", sessionHandler);
  app.get("/location", locationHandler);
  app.get('/search', searchHandler);

  // Jobs
  app.post("/state", stateHandler);
  app.post('/sendAuthCodes', sendAuthCodesHandler);
  app.post('/updateActiveSessions', updateSessionsHandler);
  app.post('/mintPaidSessions', mintPaidSessionsHandler);
  app.post('/mintConfirm', mintConfirmHandler);
  app.post('/refunds', refundsHandler);

  app.listen(3000);
}
