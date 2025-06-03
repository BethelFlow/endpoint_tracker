import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import moment from 'moment';
import endpoints from './endpoints';
import { logToFile } from './logger';
import { incrementCallCount, recordBlock, resetCountersIfNeeded } from './tracker';

const INTERVAL_MS: number = 30 * 1000; 

interface BlockEvent {
  endpoint: string;
  timestamp: string;
  status: number | null;
  reason: string;
}

async function callEndpoints() {
  resetCountersIfNeeded();

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