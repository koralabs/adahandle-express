import { getAdaHandleDomain } from "./constants";
import * as fs from 'fs';
import * as path from 'path';
import { LogCategory, Logger } from './Logger';
import { SettingsRepo } from "../models/firestore/collections/SettingsRepo";
import * as nodemailer from "nodemailer"
import * as SMTPConnection from "nodemailer/lib/smtp-connection";

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
  const content = `It's time to get your Handles. <br/>Hurry up though, this link is only valid for ${(await SettingsRepo.getSettings()).accessCodeTimeoutMinutes} minutes.<br/> Once expired, you'll need to re-enter the queue.`;
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

    const params = { to: email, html: html, text: content, subject: subject, from: fromAddress, replyTo: fromAddress };

  await sendEmail(params);

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
  const approximateQueueText = minutes > 3 ?
    'Your approximate position in the access queue is {{accessposition}} out of {{accesscount}}. At our current queue processing rate, it should be about {{minutes}} minutes until we send you an access code. Due to load, this could change.' :
    'Expect an email in the next few minutes.';
  const content = `We have saved your place in line! When it's your turn, we will send you a special access link. ${approximateQueueText} Make sure you turn on email notifications!`;
  const fromAddress = 'ADA Handle <hello@adahandle.com>';
  const subject = 'ADA Handle: You are confirmed and added to the queue.';

  const html = template.replace('{{preheader}}', preheader)
    .replace('{{content}}', content.replace('{{accessposition}}', accessPosition.toString()).replace('{{accesscount}}', accessCount.toString()).replace('{{minutes}}', minutes.toString()))
    .replace('{{actionbutton}}', '');

  const params = { to: email, html: html, text: content, subject: subject, from: fromAddress, replyTo: fromAddress };

  try {
    await sendEmail(params);
  }
  catch (err)
  {
    Logger.log({ message: JSON.stringify(err), category: LogCategory.ERROR, event: 'createConfirmationEmail.send' });
    return false;
  }

  return true;
};

export const sendEmail = async (params: {to: string, html: string, text?:string, subject: string, from: string, replyTo?: string}): Promise<void> => {

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false
  } as SMTPConnection.Options);

  await transporter.sendMail({
    from: params.from,
    replyTo: params.replyTo || params.from,
    to: params.to,
    subject: params.subject,
    text: params.text ? params.text : params.html.replace(/<style[^>]*>.*<\/style>/gm, '')
        .replace(/<script[^>]*>.*<\/script>/gm, '')
        .replace(/<[^>]+>/gm, '\\n')
        .replace(/([\r\n]+ +)+/gm, ''),
    html: params.html
  });

}