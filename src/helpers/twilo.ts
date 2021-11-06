import * as Twilio from "twilio";
import { ServiceInstance } from "twilio/lib/rest/verify/v2/service";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

let client: Twilio.Twilio;
export const getTwilioClient = async (): Promise<Twilio.Twilio> => {
  if (!client) {
    client = Twilio(accountSid, authToken);
  }

  return client;
};

let verify: ServiceInstance;
export const getTwilioVerify = async (): Promise<ServiceInstance> => {
  if (!verify) {
    const client = await getTwilioClient();
    verify = await client.verify.services(serviceSid as string).fetch();
  }

  return verify;
};

export const createTwilioVerification = async (
  phone: string
): Promise<VerificationInstance> => {
  const twilioClient = await getTwilioClient();
  const twilioVerify = await getTwilioVerify();
  return twilioClient.verify
    .services(twilioVerify.sid)
    .verifications.create({
      to: phone,
      channel: "sms",
    });
};
