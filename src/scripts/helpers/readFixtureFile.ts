import { readFileSync } from 'fs';

export const readFixturesFile = async <T>(path: string) => {
    const file = readFileSync(path, 'utf8');
    const json = JSON.parse(file);
    console.log(`importing: ${json.length} items`);
    return json as T;
}
