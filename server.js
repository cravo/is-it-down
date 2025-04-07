import express from 'express';
import fetch from 'node-fetch';
import { URL } from 'url';
import dns from 'dns/promises';
import net from 'net';
import path from 'path';
import logger from './logger.js';

const app = express();
const __dirname = path.resolve();

function isPrivateIP(ip) {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31 ||
    ip.startsWith('192.168.') ||
    ip === '127.0.0.1' ||
    ip === '0.0.0.0' ||
    ip.startsWith('169.254.')
  );
}

async function tryFetchWithFallbacks(hostname) {
    const protocols = ['https://', 'http://'];
    const prefixes = ['', 'www.'];
  
    for (const proto of protocols) {
      for (const prefix of prefixes) {
        const url = `${proto}${prefix}${hostname}`;
        try {
          const u = new URL(url);
          const addresses = await dns.lookup(u.hostname, { all: true });
          const blocked = addresses.some(addr => net.isIP(addr.address) && isPrivateIP(addr.address));
          if (blocked) continue;
  
          const response = await fetch(u.href, {
            method: 'GET',
            redirect: 'follow',
            timeout: 5000,
          });
  
          return { success: true, url: u.href, status: response.status, ok: response.ok };
        } catch {
          // continue trying
        }
      }
    }
  
    return { success: false };
  }
  
  
  app.get('/check', async (req, res) => {
    const input = req.query.url;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
    if (!input) {
      logger.info(`${clientIp} - No URL provided`);
      return res.status(400).json({ status: 'down', reason: 'No URL provided' });
    }
  
    const hostnameOnly = input.replace(/^https?:\/\//i, '').split('/')[0];
  
    try {
      const result = await tryFetchWithFallbacks(hostnameOnly);
  
      if (result.success) {
        logger.info(`${clientIp} - Checked ${result.url} - Status ${result.status}`);
        return res.json({ status: result.ok ? 'up' : 'down', httpStatus: result.status, checkedUrl: result.url });
      } else {
        logger.info(`${clientIp} - All attempts failed for ${hostnameOnly}`);
        return res.json({ status: 'down', reason: 'All fetch attempts failed' });
      }
    } catch (err) {
      logger.info(`${clientIp} - Error checking ${hostnameOnly} - ${err.message}`);
      return res.json({ status: 'down', reason: err.message });
    }
  });

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
