import { createWriteStream, WriteStream } from 'fs';
import moment from 'moment';

const LOG_FILE: string = 'logs.txt';
let writeStream: WriteStream | null = null;

function getWriteStream(): WriteStream {
  if (!writeStream) {
    writeStream = createWriteStream(LOG_FILE, { flags: 'a', encoding: 'utf8' });
    writeStream.on('error', (err) => {
      console.error('Error writing to log file:', err);
    });
  }
  return writeStream;
}

export async function logToFile(message: string): Promise<void> {
  const timestamp: string = moment().format('YYYY-MM-DD HH:mm:ss');
  const logMessage: string = `[${timestamp}] ${message}\n`;
  return new Promise((resolve, reject) => {
    const stream = getWriteStream();
    stream.write(logMessage, (err) => {
      if (err) {
        console.error('Error writing to log stream:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

process.on('SIGINT', () => {
  if (writeStream) {
    writeStream.end();
    writeStream = null;
  }
  process.exit();
});