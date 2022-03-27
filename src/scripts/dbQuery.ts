import { Firebase } from "../helpers/firebase";
import * as admin from "firebase-admin";
import { Color } from "./scriptUtils"
import { ActiveSession } from "../models/ActiveSession"


const dbQuery = async (trim: number = 100) => {
    await Firebase.init();
    console.time("query");

    // **************************************************
    // MODIFY THIS QUERY AS YOU SEE FIT FOR YOUR PURPOSE
    const snapshot = await admin.firestore().collection("activeSessions")
    //.where('status', '==', 'paid')
    //.where('workflowStatus', '==', 'confirmed')
    //.where('email', '==', 's2per@hotmail.com')
    //.where('handle', '>=', 'xar').where('handle', '<=', 'xar' + '~') // This is a "startsWith" query
    //.orderBy('dateAdded', 'desc')
    .select('handle')
    //.limit(10)
    .get();
    // **************************************************

    let fields = {};
    if (snapshot?.size > 0) {
        const filtered = snapshot.docs.filter(d => d);
        for (let record of filtered) {
            for (const [key, value] of Object.entries(record.data())) {
                let length = 0;
                if (typeof value == 'object')
                    length = JSON.stringify(value).length;
                else if (typeof value != 'string')
                    length = value.toString().length;
                else
                    length = value.length;
                if (!fields[key])
                    fields[key] = length;
                else
                    if (length > fields[key])
                        fields[key] = length;
                if (key.length > fields[key])
                    fields[key] = key.length;
            }
        }
        let header = '';
        const keys = Object.keys(fields).sort();
        for (let field of keys) {
            header += `${Color.FgGreen}${field.padEnd(fields[field]).substring(0, trim)}${Color.FgBlue}|${Color.Reset}`;
        }
        console.log(`|${header}`);
        let color = Color.Dim;
        for (let record of filtered) {
            let row = ''
            const data = record.data();
            for (let field of keys) {
                let value = '';
                if (data[field]) {
                    if (typeof data[field] == 'object')
                        value = JSON.stringify(data[field]);
                    else if (typeof data[field] != 'string')
                        value = data[field].toString();
                    else
                        value = data[field];
                }
                row += `${color}${value.padEnd(fields[field]).substring(0, trim)}${Color.FgBlue}|${Color.Reset}`;
            }
            console.log(`|${row}`);
            color = (color == Color.Dim) ? Color.Reset : Color.Dim
        }
        console.log(`|${header}`);
        console.log(`${filtered.length} records found`); 
        // const filteredCount = snapshot.docs.filter(d => (d.data() as ActiveSession).txId);
        // console.log(`refundables with a refundAmount ${filteredCount}`)
    }
    else {
        console.log("No records found");
    }
    console.timeEnd("query");
}

dbQuery(20);