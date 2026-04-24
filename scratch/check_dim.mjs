import fs from 'fs';
import { join } from 'path';
import sizeOf from 'image-size'; // image-size might not be installed, better to just write a simple html + browser tool or just use basic buffer reading for PNG.

// PNG IHDR chunk contains dimensions
function getPngSize(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (buffer.toString('ascii', 1, 4) !== 'PNG') {
        console.log(filePath, 'Not a PNG');
        return;
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    console.log(filePath, width, 'x', height);
}

getPngSize('../asset/청토끼 보스2.png');
getPngSize('../asset/청토끼 킹.png');
