import { sendEmail } from '../helpers/aws';
import { getAdaHandleDomain } from "./constants";
import * as fs from 'fs';
import * as path from 'path';
import { LogCategory, Logger } from './Logger';
import { StateData } from "../models/firestore/collections/StateData";

export class VerificationInstance {
  public authCode: string;
  public status: string;

  constructor(authCode: string, status: string) {
    this.authCode = authCode;
    this.status = status;
  }
}

export const createVerificationEmail = async (
  email: string, docRef: string
): Promise<VerificationInstance> => {
  const template = fs.readFileSync(path.resolve(__dirname, '../htmlTemplates/email-main.html'), 'utf8');
  const preheader = 'Your activation code is here. Let\'s get started.';
  const content = `It's time to get your Handles. <br/>Hurry up though, this link is only valid for ${(await StateData.getStateData()).accessCodeTimeoutMinutes} minutes.<br/> Once expired, you'll need to re-enter the queue.`;
  const fromAddress = 'ADA Handle <hello@adahandle.com>';
  const domain = getAdaHandleDomain();
  const authCode = Buffer.from(`${docRef}|${email}`).toString('base64');
  const status = 'pending';
  const subject = 'ADA Handle: Your Access Link';
  const authCodeLink = `${domain}/mint/?activeAuthCode=${authCode}&activeEmail=${email}`;
  const actionButton = `<a href="${authCodeLink}" class="action-button" target="_blank">Get Access Now</a>`;

  const html = template.replace('{{preheader}}', preheader)
    .replace('{{content}}', content)
    .replace('{{actionbutton}}', actionButton);

  const params = {
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: html
        },
        Text: {
          Charset: "UTF-8",
          Data: `${content} Get Access Now - ${authCodeLink}`
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject
      }
    },
    Source: fromAddress,
    ReplyToAddresses: [fromAddress],
  };

  sendEmail(params).send();

  return { authCode: authCode, status };
};

export const createConfirmationEmail = async (
  email: string,
  accessPosition: number,
  accessCount: number,
  minutes: number
): Promise<boolean> => {
  const template = fs.readFileSync(path.resolve(__dirname, '../htmlTemplates/email-main.html'), 'utf8');
  const preheader = 'Your spot has been saved.';
  const content = 'We have saved your place in line! When it\'s your turn, we will send you a special access link. Your approximate position in the access queue is {{accessposition}} out of {{accesscount}}. At our current queue processing rate, it should be about {{minutes}} minutes until we send you an access code. Due to load, this could change. Make sure you turn on email notifications!';
  const fromAddress = 'ADA Handle <hello@adahandle.com>';
  const subject = 'ADA Handle: You are confirmed and added to the queue.';

  const html = template.replace('{{preheader}}', preheader)
    .replace('{{content}}', content.replace('{{accessposition}}', accessPosition.toString()).replace('{{accesscount}}', accessCount.toString()).replace('{{minutes}}', minutes.toString()))
    .replace('{{actionbutton}}', '');

  const params = {
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: html
        },
        Text: {
          Charset: "UTF-8",
          Data: content
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject
      }
    },
    Source: fromAddress,
    ReplyToAddresses: [fromAddress],
  };

  sendEmail(params).send((err) => { if (err) Logger.log({ message: JSON.stringify(err), category: LogCategory.ERROR, event: 'createConfirmationEmail.send' }) });

  return true;
};
