/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import * as fs from 'fs';
import * as sgMail from "@sendgrid/mail";
import { Request, Response } from 'express';
import { postToQueueHandler } from "./queue";
import { AccessQueues } from '../../models/firestore/collections/AccessQueues';

jest.mock('fs');
jest.mock('../../models/firestore/collections/AccessQueues');
jest.mock('@sendgrid/mail');

describe('Queue Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    mockRequest = {};
    mockResponse = {
      // @ts-ignore
      status: jest.fn(() => mockResponse),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send an 400 response if email header is not provided', async () => {
    mockRequest = {
      headers: {
        'burrito': 'burrito'
      }
    }

    await postToQueueHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Missing email address." });
  });

  it('should send an 403 response if body is empty', async () => {
    mockRequest = {
      headers: {
        'x-email': 'burrito@burritos.com'
      },
      body: {}
    }

    await postToQueueHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Forbidden: Suspicious Activity. Send this code to support@adahandle.com for assistance: missing_agent_info" });
  });

  it('should send an 403 response if body does not include clientIp', async () => {
    mockRequest = {
      headers: {
        'x-email': 'burrito@burritos.com'
      },
      body: {
        clientAgent: 'test-agent',
      }
    }

    await postToQueueHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Forbidden: Suspicious Activity. Send this code to support@adahandle.com for assistance: missing_agent_info" });
  });

  it('should send an 403 response if body does not include clientAgent', async () => {
    mockRequest = {
      headers: {
        'x-email': 'burrito@burritos.com'
      },
      body: {
        clientIp: 'test-ip',
      }
    }

    await postToQueueHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Forbidden: Suspicious Activity. Send this code to support@adahandle.com for assistance: missing_agent_info" });
  });

  it('should send an 403 response if verifyClientAgentInfo returns error code ', async () => {
    const fileName = `${process.cwd()}/dist/helpers/clientAgentInfo/index.js`;

    if (!fs.existsSync(fileName)) {
      console.warn("SKIPPED");
    } else {
      mockRequest = {
        headers: {
          'x-email': 'burrito@burritos.com'
        },
        body: {
          clientIp: 'test-ip',
          clientAgent: 'test-agent',
        }
      }

      const errorCode = 'some-error-code';
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.mock(`${fileName}`, () => ({ verifyClientAgentInfo: () => ({ errorCode }) }));

      await postToQueueHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": `Forbidden: Suspicious Activity. Send this code to support@adahandle.com for assistance: ${errorCode}` });
    }
  });

  it('should send an 400 response if email address is invalid', async () => {
    const fileName = `${process.cwd()}/dist/helpers/clientAgentInfo/index.js`;

    if (!fs.existsSync(fileName)) {
      console.warn("SKIPPED");
    } else {
      mockRequest = {
        headers: {
          'x-email': 'no-an-email-address'
        },
        body: {
          clientIp: 'test-ip',
          clientAgent: 'test-agent',
        }
      }

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.mock(`${fileName}`, () => ({ verifyClientAgentInfo: () => ({ sha: '123' }) }));
      jest.spyOn(AccessQueues, 'addToQueue').mockResolvedValue({ updated: true, alreadyExists: false });
      jest.spyOn(AccessQueues, 'getAccessQueueCount').mockResolvedValue(1);

      await postToQueueHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Invalid email." });
    }
  });

  it('should send an 200 response', async () => {
    const fileName = `${process.cwd()}/dist/helpers/clientAgentInfo/index.js`;

    if (!fs.existsSync(fileName)) {
      console.warn("SKIPPED");
    } else {
      mockRequest = {
        headers: {
          'x-email': 'burrito@burritos.com'
        },
        body: {
          clientIp: 'test-ip',
          clientAgent: 'test-agent',
        }
      }

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.mock(`${fileName}`, () => { return { verifyClientAgentInfo: () => { return { sha: '123' }; } } });
      jest.spyOn(AccessQueues, 'addToQueue').mockResolvedValue({ updated: true, alreadyExists: false });
      jest.spyOn(AccessQueues, 'getAccessQueueCount').mockResolvedValue(1);

      // @ts-expect-error no need to have a valid response
      const sendMailMock = jest.spyOn(sgMail, 'send').mockResolvedValue([{}, {}]);

      await postToQueueHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(sendMailMock).toHaveBeenCalledTimes(1);
      expect(mockResponse.json).toHaveBeenCalledWith({ "alreadyExists": false, "error": false, "message": null, "updated": true });
    }
  });
});
