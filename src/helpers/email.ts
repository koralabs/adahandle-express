import { sendEmail } from '../helpers/aws';
import { isProduction } from "./constants";
import * as fs from 'fs';

export class VerificationInstance {
  public authCode: string;
  public status: string;

  constructor(authCode: string, status: string){
    this.authCode = authCode;
    this.status = status;
  }
}

export const createVerificationEmail = async (
  email: string, docRef: string
): Promise<VerificationInstance> => {
  const template = fs.readFileSync('../htmlTemplates/main.html', 'utf8');
  const preheader = 'Your activation code is here. Let\'s get started.';
  const content   = 'It\'s time to get your Handles. <br/>Hurry up though, this link is only valid for 10 minutes.<br/> Once expired, you\'ll need to re-enter the queue.';
  const fromAddress = 'ADA Handle <hello@adahandle.com>';
  const domain = isProduction() ? 'adahandle.com' : 'testnet.adahandle.com'
  const authCode = Buffer.from(`${docRef}|${email}`).toString('base64');
  const status = 'pending';
  const subject = 'ADA Handle: Your Access Link';
  const authCodeLink = `https://${domain}/mint/?activeAuthCode=${authCode}`;
  const actionButton = `<a href="${authCodeLink}" class="action-button" target="_blank">Get Access Now</a>`;
  
  const html = template.replace('{{preheader}}', preheader)
    .replace('{{content}}', content)
    .replace('{{actionbutton}}', actionButton);
    
    var params = {
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
    const sentEmail = sendEmail(params);

    return {authCode: authCode, status};
};

export const createConfirmationEmail = async (
  email: string,
  accessPosition: number,
  accessCount: number,
  minutes: number
): Promise<boolean> => {
  const template = fs.readFileSync('../htmlTemplates/main.html', 'utf8');
  const preheader = 'Your spot has been saved.';
  const content   = 'We have saved your place in line! When it\'s your turn, we will send you a special access link. Your approximate position in the access queue is {{accessposition}} out of {{accesscount}}. At our current queue processing rate, it should be about {{minutes}} minutes until we send you an acess code. Due to load, this could change. Make sure you turn on email notifications!';
  const fromAddress = 'ADA Handle <hello@adahandle.com>';
  const subject = 'ADA Handle: You are confirmed and added to the queue.';

  const html = template.replace('{{preheader}}', preheader)
    .replace('{{content}}', content.replace('{{accessposition}}', accessPosition.toString()).replace('{{accesscount}}', accessCount.toString()).replace('{{minutes}}', minutes.toString()));
    
    var params = {
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
    const sentEmail = sendEmail(params);

    return true;
};
