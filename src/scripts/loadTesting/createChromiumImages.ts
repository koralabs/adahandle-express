import { readFileSync } from 'fs';
import { resolve } from 'path';
import { LogCategory, Logger } from '../../helpers/Logger';
import { getRaritySlug } from '../../helpers/nft';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlToImage = require('node-html-to-image');
console.log(`starting`);
console.time("createChromiumImages");
let index = 0;
const promises = Array.from({ length: 10 }, async () => {
    let images = []
    const path = resolve(__dirname, `../../nftTemplates/basic.html`);
    const html = readFileSync(path).toString();
    for(var i=0;i<100;i++){
        index++;
        const handle = index.toString();
        const slug = getRaritySlug(handle);
        const target = slug.replace(' ', '-').toLowerCase();
        const outputPath = resolve(__dirname, '../../../bin');
        const output = `${outputPath}/${handle}.jpg`;
        images.push({ handle, output });
    }
    await htmlToImage({
        html,
        quality: 100,
        type: 'jpeg',
        pupeteerArgs: {executablePath: '/usr/bin/chromium-browser'},
        content: images
    });
});
console.timeEnd("createChromiumImages");