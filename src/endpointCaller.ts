import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import moment from 'moment';
import { logToFile } from './logger';
import { incrementCallCount, recordBlock, resetCountersIfNeeded } from './tracker';

interface EndpointConfig {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  payload?: any;
  headers?: Record<string, string>;
}

const ENDPOINTS: EndpointConfig[] = [
  {
    name: 'Tap Tap Send',
    url: 'https://api.taptapsend.com/api/fxRates',
    method: 'GET',
  },
  {
    name: 'Lemfi',
    url: 'https://lemfi.com/api/lemonade/v2/exchange',
    method: 'POST',
    payload: { from: 'GBP', to: 'NGN' },
    headers: { 'Content-Type': 'application/json' },
  },
  {
    name: 'Nala',
    url: 'https://partners-api.prod.nala-api.com/v1/fx/rates',
    method: 'GET',
  },
  {
    name: 'Africhange',
    url: 'https://client.africhange.com/api/Rate?sendingCurrencyCode=GBP&receivingCurrencyCode=NGN',
    method: 'GET',
  },
  {
    name: 'Sendwave',
    url: 'https://app.sendwave.com/v2/pricing-public?amountType=SEND&receiveCurrency=PHP&amount=100&sendCurrency=USD&sendCountryIso2=us&receiveCountryIso2=ph',
    method: 'GET',
  },
  {
    name: 'Moniepoint',
    url: 'https://fx-apis.moniepoint.com/marketing/api/v1/fx-rates?sourceCurrency=GBP&targetCurrency=NGN',
    method: 'GET',
  },
 {
    name: 'Ace Money Transfer',
    url: 'https://acemoneytransfer.com/rate/calculator',
    method: 'POST',
    payload: {
      'uri': 'rate/calculator',
      'type': 'POST',
      'data[src_amount]': '100',
      'data[dest_amount]': '',
      'data[calculate]': '1',
      'data[user_currency]': 'GBP',
      'data[calculation_mode]': 'S',
      'data[dest_iso_numeric_code]': '566',
      'data[src_iso_numeric_code]': '826',
      'data[specific_payer_id]': '1199',
      'auth': 'true',
    },
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  },
];

const INTERVAL_MS: number = 30 * 1000; 

interface BlockEvent {
  endpoint: string;
  timestamp: string;
  status: number | null;
  reason: string;
}

async function callEndpoints(): Promise<void> {
  resetCountersIfNeeded();

  for (const endpoint of ENDPOINTS) {
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
}

export function startCallingEndpoints(): void {
  callEndpoints();
  setInterval(callEndpoints, INTERVAL_MS);
}