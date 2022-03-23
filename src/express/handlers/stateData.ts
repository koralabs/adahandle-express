import * as express from "express";

import { LogCategory, Logger } from "../../helpers/Logger";
import { SettingsRepo } from "../../models/firestore/collections/SettingsRepo";
import { StateData } from "../../models/firestore/collections/StateData";

const getLogMessage = (startTime: number) => ({ message: `handleStateHandler processed in ${Date.now() - startTime}ms`, event: 'handleStateHandler.run', milliseconds: Date.now() - startTime, category: LogCategory.METRIC });

export const stateDataHandler = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();

    try {
        const [state, settings] = await Promise.all([
            StateData.getStateData(),
            SettingsRepo.getSettings()
        ]);

        const result = {
            ...state, ...settings,
            error: false,
            message: "",
        };

        getLogMessage(startTime);

        return res.status(200).json(result);
    } catch (e) {
        Logger.log({ message: JSON.stringify(e), category: LogCategory.ERROR });
        return res.status(500).json({
            error: true,
            message: JSON.stringify(e)
        })
    }
}
