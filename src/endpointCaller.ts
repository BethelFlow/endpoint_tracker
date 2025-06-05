import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import moment from 'moment';
import endpoints from './endpoints';
import { logToFile } from './logger';
import { incrementCallCount, recordBlock, resetCounters } from './tracker';
import { scrapeTapTapSendExchangeRates, getPopularTapTapSendRates } from './taptapScraper';

const INTERVAL_MS: number = 3 * 60 * 1000;

interface TapTapSendStats {
  lastSuccessfulScrape: string | null;
  totalScrapes: number;
  failedScrapes: number;
  lastRatesCount: number;
  popularRates: { [key: string]: number } | null;
}

let tapTapSendStats: TapTapSendStats = {
  lastSuccessfulScrape: null,
  totalScrapes: 0,
  failedScrapes: 0,
  lastRatesCount: 0,
  popularRates: null
};

async function callEndpoints(monitorPairs?: Array<{ from: string; to: string; threshold: number }>) {
  resetCounters();

  for (const endpoint of endpoints) {
    try {
      const config: AxiosRequestConfig = {
        url: endpoint.url,
        method: endpoint.method,
        headers: endpoint.headers,
        data: endpoint.payload,
        timeout: 10000,
      };

      if (endpoint.headers?.['Content-Type'] === 'application/x-www-form-urlencoded') {
        config.data = new URLSearchParams(endpoint.payload as any).toString();
      }

      const response = await axios(config);
      const logMessage = `Endpoint: ${endpoint.name} (${endpoint.url}), Status: ${response.status}`;
      await logToFile(logMessage);

      incrementCallCount();
    } catch (error) {
      const axiosError = error as AxiosError;
      let errorMessage = `Endpoint: ${endpoint.name} (${endpoint.url}), Error: ${axiosError.message}`;
      let blockReason = 'Unknown';

      if (axiosError.response) {
        errorMessage += `, Status: ${axiosError.response.status}`;
        if (axiosError.response.status === 429) {
          blockReason = 'Rate Limit Exceeded';
          const retryAfter = axiosError.response.headers['retry-after'];
          errorMessage += retryAfter ? `, Retry-After: ${retryAfter}s` : '';
        } else if (axiosError.response.status >= 400) {
          blockReason = `HTTP Error ${axiosError.response.status}`;
        }
      } else if (axiosError.code === 'ECONNABORTED') {
        blockReason = 'Request Timeout';
      } else if (axiosError.code === 'ENOTFOUND') {
        blockReason = 'Endpoint Not Found';
      }

      await logToFile(errorMessage);

      if (axiosError.response && axiosError.response.status >= 400) {
        recordBlock({
          endpoint: `${endpoint.name} (${endpoint.url})`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
          status: axiosError.response ? axiosError.response.status : null,
          reason: blockReason,
        });
      }
    }
  }

  await scrapeTapTapSendRates();
}

async function scrapeTapTapSendRates() {
  const now = Date.now();

  try {
    tapTapSendStats.totalScrapes++;
    
    const rates = await scrapeTapTapSendExchangeRates();
    
    if (rates) {
      tapTapSendStats.lastSuccessfulScrape = moment().format('YYYY-MM-DD HH:mm:ss');
      tapTapSendStats.lastRatesCount = rates.rates.length;
      
      const popularRates = await getPopularTapTapSendRates();
      if (popularRates) {
        tapTapSendStats.popularRates = popularRates;
        
        const rateStrings = Object.entries(popularRates)
          .map(([pair, rate]) => `${pair.replace('_', '→')}: ${rate.toFixed(2)}`)
          .join(', ');
        await logToFile(`Popular TapTapSend rates: ${rateStrings}`);
      }
      
      // await saveRatesToStorage(rates);
      
      incrementCallCount();
    } else {
      tapTapSendStats.failedScrapes++;
      
      recordBlock({
        endpoint: 'TapTapSend Exchange Rates',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        status: null,
        reason: 'Scraping Failed',
      });
    }
  } catch (error) {
    tapTapSendStats.failedScrapes++;
    await logToFile(`TapTapSend scraping error: ${error}`);
    
    recordBlock({
      endpoint: 'TapTapSend Exchange Rates',
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      status: null,
      reason: 'Scraping Exception',
    });
  } 
}

// /*
// async function saveRatesToStorage(rates: any) {
//   try {
//     const fs = require('fs').promises;
//     const filename = `rates_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
//     const filepath = `./data/taptapsend/${filename}`;
    
//     // Ensure directory exists
//     await fs.mkdir('./data/taptapsend', { recursive: true });
    
//     // Save rates
//     await fs.writeFile(filepath, JSON.stringify(rates, null, 2));
//     await logToFile(`Saved TapTapSend rates to ${filepath}`);
//   } catch (error) {
//     await logToFile(`Failed to save rates to storage: ${error}`);
//   }
// }
// */

// export function getTapTapSendStats(): TapTapSendStats {
//   return { ...tapTapSendStats };
// }

// export async function getCurrentRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
//   try {
//     const rates = await scrapeTapTapSendExchangeRates();
//     if (!rates) return null;
    
//     const rate = rates.rates.find(r => 
//       r.from === fromCurrency && r.to === toCurrency
//     );
    
//     return rate ? (rate.effectiveRate || rate.rate) : null;
//   } catch (error) {
//     await logToFile(`Failed to get current rate ${fromCurrency}→${toCurrency}: ${error}`);
//     return null;
//   }
// }

// export async function monitorRateChanges(
//   pairs: Array<{ from: string; to: string; threshold: number }>
// ) {
//   const rates = await scrapeTapTapSendExchangeRates();
//   if (!rates) return;
  
//   for (const pair of pairs) {
//     const currentRate = rates.rates.find(r => 
//       r.from === pair.from && r.to === pair.to
//     );
    
//     if (currentRate) {
//       const rate = currentRate.effectiveRate || currentRate.rate;
      
//       await logToFile(
//         `Rate Monitor: ${pair.from}→${pair.to} = ${rate.toFixed(4)} ` +
//         `(${currentRate.fromCountry} → ${currentRate.toCountry})`
//       );
//     }
//   }
// }

export function startCallingEndpoints(monitorPairs?: Array<{ from: string; to: string; threshold: number }>) {
  const call = async () => {
    await callEndpoints(monitorPairs);
  };

  call();
  setInterval(call, INTERVAL_MS);
}