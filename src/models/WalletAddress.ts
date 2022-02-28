import { BaseModel } from './BaseModel';

export class WalletAddress extends BaseModel {
    constructor(public id: string, public index: number) {
        super();
    }
}