import express from 'express';
import fetch from 'node-fetch';
import { URL } from 'url';
import dns from 'dns/promises';
import net from 'net';
import path from 'path';
import logger from './logger.js';
import { safeFetch } from './utils/safeFetch.js';

const app = express();
const __dirname = path.resolve();

app.get('/check', async (req, res) => {

  const input = req.query.url;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!input) {
    logger.info(`${clientIp} - No URL provided`);
    return res.status(400).json({ status: 'down', reason: 'No URL provided' });
  }
  
  const rawHost = input.replace(/^https?:\/\//i, '').split('/')[0];

  const protocols = ['https://', 'http://'];
  const prefixes = ['', 'www.'];

  for (const proto of protocols) {
    for (const prefix of prefixes) {
      const testUrl = `${proto}${prefix}${rawHost}`;
      try {
        const response = await safeFetch(testUrl, { timeout: 5000 });
        logger.info(`${clientIp} - Checked ${response.url} - Status ${response.status}`);
        return res.json({
          status: response.ok ? 'up' : 'down',
          httpStatus: response.status,
          checkedUrl: response.url
        });
      } catch (e) {
        // try next fallback
        logger.info(`${clientIp} - Error checking ${rawHost} - ${e.message}`);
      }
    }
  }

  logger.info(`${clientIp} - Checked ${rawHost} - Status All fetch attempts failed`);
  return res.json({ status: 'down', reason: 'All fetch attempts failed' });
});


app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
