import { getS3 } from "../helpers/aws";
import { asyncForEach } from "../helpers/utils";
import { ActiveSession, Status, WorkflowStatus } from "../models/ActiveSession";
import { readFile, unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ActiveSessions } from "../models/firestore/collections/ActiveSession";

const backupNftsToS3 = async () => {
    const paidSessions = await ActiveSessions.getByStatusAndWorkflow(Status.PAID, WorkflowStatus.CONFIRMED, 20000);
    await asyncForEach<ActiveSession, void>(paidSessions, async (session) => {

        const outputPath = resolve(__dirname, '../../bin');
        const outputSlug = `${outputPath}/${session.handle}.jpg`;
        if (existsSync(outputSlug)) {
            const s3 = getS3();
            readFile(outputSlug, function (err, data) {
                if (err) throw err;
                s3.putObject({ Bucket: 'adahandle-nfts', Key: `${session.handle}.jpg`, Body: data, Metadata: { ipfsHash: session.ipfsHash || '' } }, (err, data) => {
                    if (err) throw err;
                    unlinkSync(outputSlug);
                });
            });
        }
    });
}

backupNftsToS3();