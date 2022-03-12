import { hasDoubleMint } from "../../../../helpers/graphql";
import { LogCategory, Logger } from "../../../../helpers/Logger";
import { StateData } from "../../../../models/firestore/collections/StateData";

export const checkForDoubleMint = async () => {
    const doubleMint = await hasDoubleMint();
    if (doubleMint) {
        Logger.log({ message: `Double mint detected`, event: 'checkForDoubleMint.doubleMint', category: LogCategory.NOTIFY });
        await StateData.lockMintingCron();
    }
}