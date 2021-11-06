import { BaseModel } from "./BaseModel";

export class PendingSession extends BaseModel {
    constructor(public handleName: string) {
        super();
    }
}