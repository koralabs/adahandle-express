import * as express from "express";
import * as compression from 'compression';
import * as helmet from 'helmet';
import { urlencoded, json } from 'body-parser'
import Router from 'express-promise-router';

// Handlers
import { postToQueueHandler } from "./handlers/queue";
import { verifyHandler } from "./handlers/verify";
import { sessionHandler } from "./handlers/session";
import { handleExistsHandler } from "./handlers/exists";
import { paymentConfirmedHandler } from "./handlers/payment";
import { locationHandler } from './handlers/location';
import { stateHandler } from './handlers/jobs/state';

// Jobs
import { sendAuthCodesHandler } from './handlers/jobs/auth';
import { mintPaidSessionsHandler } from './handlers/jobs/minting';
import { updateSessionsHandler } from './handlers/jobs/sessions';

export const startServer = async () => {
  const app = express();
  const router = Router();

  app.use(urlencoded({ extended: false }));
  app.use(json());
  app.use(compression());
  app.use(helmet());
  app.use(router);

  // Set headers.
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, x-firebase-appcheck, x-handle, x-phone, x-phone-authcode, x-access-token, x-session-token"
    );
    next();
  });

  // Handlers
  app.post("/queue", postToQueueHandler);
  app.get("/payment", paymentConfirmedHandler);
  app.get("/exists", handleExistsHandler);
  app.get("/verify", verifyHandler);
  app.get("/session", sessionHandler);
  app.get("/location", locationHandler);

  // Jobs
  app.post("/state", stateHandler);
  app.post('/sendAuthCodes', sendAuthCodesHandler);
  app.post('/updateActiveSessions', updateSessionsHandler);
  app.post('/mintPaidSessions', mintPaidSessionsHandler);

  app.listen(3000);
}
