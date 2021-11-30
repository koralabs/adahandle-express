/* eslint-disable @typescript-eslint/ban-ts-comment */
// disabling ban-ts-comment is only acceptable in tests. And it's recommend to use very little when you can.
import * as fs from 'fs';
import * as sgMail from "@sendgrid/mail";
import { Request, Response } from 'express';
import { mocked } from 'ts-jest/utils';
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
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Forbidden: Suspicious Activity - CODE: missing_agent_info" });
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
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Forbidden: Suspicious Activity - CODE: missing_agent_info" });
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
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Forbidden: Suspicious Activity - CODE: missing_agent_info" });
  });

  it('should send an 403 response if verifyClientAgentInfo returns error code ', async () => {
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
    mocked(fs.existsSync).mockReturnValue(true);
    jest.mock(`${process.cwd()}/dist/helpers/clientAgentInfo/index.js`, () => ({ verifyClientAgentInfo: () => ({ errorCode }) }));

    await postToQueueHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": `Forbidden: Suspicious Activity - CODE: ${errorCode}` });
  });

  it('should send an 400 response if email address is invalid', async () => {
    mockRequest = {
      headers: {
        'x-email': 'no-an-email-address'
      },
      body: {
        clientIp: 'test-ip',
        clientAgent: 'test-agent',
      }
    }

    mocked(fs.existsSync).mockReturnValue(true);
    jest.mock(`${process.cwd()}/dist/helpers/clientAgentInfo/index.js`, () => ({ verifyClientAgentInfo: () => ({ sha: '123' }) }));
    mocked(AccessQueues.addToQueue).mockResolvedValue({ updated: true, alreadyExists: false });
    mocked(AccessQueues.getAccessQueuesCount).mockResolvedValue(1);

    await postToQueueHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({ "error": true, "message": "Invalid email." });
  });

  it('should send an 200 response', async () => {
    mockRequest = {
      headers: {
        'x-email': 'burrito@burritos.com'
      },
      body: {
        clientIp: 'test-ip',
        clientAgent: 'test-agent',
      }
    }

    mocked(fs.existsSync).mockReturnValue(true);
    jest.mock(`${process.cwd()}/dist/helpers/clientAgentInfo/index.js`, () => { return { verifyClientAgentInfo: () => { return { sha: '123' }; } } });
    mocked(AccessQueues.addToQueue).mockResolvedValue({ updated: true, alreadyExists: false });
    mocked(AccessQueues.getAccessQueuesCount).mockResolvedValue(1);

    // @ts-expect-error no need to have a valid response
    const sendMailMock = mocked(sgMail.send).mockResolvedValue([{}, {}]);

    await postToQueueHandler(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(mockResponse.json).toHaveBeenCalledWith({ "alreadyExists": false, "error": false, "message": null, "updated": true });
  });
});
