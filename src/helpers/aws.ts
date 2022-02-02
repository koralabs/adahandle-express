import * as AWS from "aws-sdk";

const credentials = {
  accessKeyId: process.env.MY_AWS_ACCESS_KEY as string,
  secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY as string,
}

export const getS3 = (): AWS.S3 => {
  const s3 = new AWS.S3({
    credentials: credentials
  });

  return s3;
};

export const sendEmail = (params: AWS.SES.SendEmailRequest): AWS.Request<AWS.SES.SendEmailResponse, AWS.AWSError> => {
  const ses = new AWS.SES({
    region: 'us-east-1',
    apiVersion: '2010-12-01',
    credentials: credentials
  })

  return ses.sendEmail(params);

}