import fetch from 'node-fetch';
import dns from 'dns/promises';
import net from 'net';

function isPrivateIP(ip) {
  return (
    ip.startsWith('10.') ||
    (ip.startsWith('172.') && +ip.split('.')[1] >= 16 && +ip.split('.')[1] <= 31) ||
    ip.startsWith('192.168.') ||
    ip === '127.0.0.1' ||
    ip === '0.0.0.0' ||
    ip.startsWith('169.254.')
  );
}

export async function safeFetch(url, options = {}) {
  const MAX_REDIRECTS = 5;
  const timeout = options.timeout || 5000;

  const targetUrl = new URL(url);

  // Disallow raw IPs and localhost-style hosts
  if (net.isIP(targetUrl.hostname) || ['localhost'].includes(targetUrl.hostname)) {
    throw new Error('Blocked host');
  }

  // DNS resolution
  const addresses = await dns.lookup(targetUrl.hostname, { all: true });
  const blocked = addresses.some(addr => isPrivateIP(addr.address));
  if (blocked) {
    throw new Error('Blocked private IP');
  }

  // Do the fetch
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      ...options
    });

    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw new Error(`Request failed: ${err.message}`);
  }
}
