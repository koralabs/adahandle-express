import * as Twilio from "twilio";
import { ServiceInstance } from "twilio/lib/rest/verify/v2/service";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { isProduction } from "./constants";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

let client: Twilio.Twilio;
export const getTwilioClient = (): Twilio.Twilio => {
  if (!client) {
    client = Twilio(accountSid, authToken);
  }

  return client;
};

let verify: ServiceInstance;
export const getTwilioVerify = async (): Promise<ServiceInstance> => {
  if (!verify) {
    const client = getTwilioClient();
    verify = await client.verify.services(serviceSid as string).fetch();
  }

  return verify;
};

export const createTwilioVerification = async (
  email: string
): Promise<VerificationInstance> => {
  const twilioClient = getTwilioClient();
  const twilioVerify = await twilioClient.verify.services(serviceSid as string).fetch();
  return twilioClient.verify
    .services(twilioVerify.sid)
    .verifications.create({
      channelConfiguration: {
        template_id: 'd-38b228c7f32945b89dfc17f3c9a37695',
        from: 'hello@adahandle.com',
        from_name: 'ADA Handle',
        substitutions: {
          domain: isProduction() ? 'adahandle.com' : 'testnet.adahandle.com',
          email
        }
      },
      to: email,
      channel: 'email'
    });
};
