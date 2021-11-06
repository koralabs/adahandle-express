import { BaseModel } from "./BaseModel";

export class MintedHandle extends BaseModel {
    constructor(public handleName: string) {
        super();
    }
}