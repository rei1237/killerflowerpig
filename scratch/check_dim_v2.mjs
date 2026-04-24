import fs from 'fs';

function getPngSize(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        if (buffer.toString('ascii', 1, 4) !== 'PNG') {
            console.log(filePath + ': Not a PNG');
            return;
        }
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        console.log(filePath + ': ' + width + 'x' + height);
    } catch (e) {
        console.log(filePath + ': Error ' + e.message);
    }
}

getPngSize('asset/청토끼 보스2.png');
getPngSize('asset/청토끼 킹.png');
getPngSize('asset/청토끼 보스.png');
