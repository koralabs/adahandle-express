export class BaseModel {
    // Firestore doesn't support JavaScript objects with custom prototypes (i.e. objects that were created via the "new" operator).
    // This method allows us to convert the extends class to a plain JavaScript object.
    toJSON(): Record<string, unknown> {
        return Object.keys(this).reduce((obj, key) => {
            // remove undefined values
            // Error: Value for argument "data" is not a valid Firestore document. Cannot use "undefined"
            if (this[key] !== undefined && this[key] !== null) {
                obj[key] = this[key];
            }
            return obj;
        }, {});
    }
}