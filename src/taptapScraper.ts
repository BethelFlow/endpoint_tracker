import axios, { AxiosError } from 'axios';
import moment from 'moment';
import { logToFile } from './logger';

const API_FXRATES_URL = 'https://api.taptapsend.com/api/fxRates';

interface ExchangeRate {
  id: string;
  isoCountryCode: string;
  countryDisplayName: string;
  currency: string;
  fxRate: number;
  effectiveFxRate?: number;
  currencyScale: number;
  govIncentive?: {
    effectiveFxRate: number;
    footnote: string;
  };
}

interface Corridor extends ExchangeRate {
  feeSchedule?: {
    type: 'standard' | 'tiered';
    flatFee?: number;
    feePercent?: number;
    maxFee?: number;
    tiers?: Array<{
      minValue: number;
      fee: number;
    }>;
  };
}

interface Country extends ExchangeRate {
  corridors: Corridor[];
}

interface FxRatesResponse {
  availableCountries: Country[];
}

interface ExchangeRateData {
  timestamp: string;
  rates: Array<{
    from: string;
    to: string;
    fromCountry: string;
    toCountry: string;
    rate: number;
    effectiveRate?: number;
    hasGovIncentive: boolean;
    govIncentiveFootnote?: string;
    fee: string;
  }>;
}

function getEffectiveRate(corridor: Corridor): number {
  const govRate = corridor.govIncentive?.effectiveFxRate;
  const baseRate = corridor.fxRate;
  
  if (govRate && !isNaN(Number(govRate))) {
    return Number(govRate);
  }
  
  return Number(baseRate) || 0;
}


function calculateFeeAmount(amount: number, feeSchedule?: Corridor['feeSchedule']): number {
  if (!feeSchedule || !amount || isNaN(amount)) return 0;
  
  let fee = 0;
  
  try {
    if (feeSchedule.type === 'standard') {
      const flatFee = Number(feeSchedule.flatFee) || 0;
      const percentFee = Number(feeSchedule.feePercent) || 0;
      fee = flatFee + (percentFee * 0.01 * amount);
      
      if (feeSchedule.maxFee && !isNaN(Number(feeSchedule.maxFee))) {
        fee = Math.min(Number(feeSchedule.maxFee), fee);
      }
    } else if (feeSchedule.type === 'tiered' && feeSchedule.tiers && Array.isArray(feeSchedule.tiers)) {
      const tier = [...feeSchedule.tiers]
        .filter(t => t && !isNaN(Number(t.minValue)) && !isNaN(Number(t.fee)))
        .sort((a, b) => Number(b.minValue) - Number(a.minValue))
        .find(tier => amount >= Number(tier.minValue));
      fee = tier ? Number(tier.fee) : 0;
    }
  } catch (error) {
    console.error('Error calculating fee:', error);
    return 0;
  }
  
  return isNaN(fee) ? 0 : fee;
}

function formatFeeText(fee: number | undefined | null, currency: string): string {
  if (!fee || fee === 0 || isNaN(fee)) return 'No transfer fees';
  return `${currency} ${Number(fee).toFixed(2)} fee`;
}

export async function scrapeTapTapSendExchangeRates(): Promise<ExchangeRateData | null> {
  try {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const fxResponse = await axios.get<FxRatesResponse>(API_FXRATES_URL, {
      headers: {
        'Appian-Version': 'web/2022-05-03.0',
        'X-Device-Id': 'web',
        'X-Device-Model': 'web',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const rates: ExchangeRateData['rates'] = [];
    
    for (const originCountry of fxResponse.data.availableCountries) {
      if (!originCountry || !Array.isArray(originCountry.corridors)) continue;
      
      for (const corridor of originCountry.corridors) {
        if (!corridor) continue;
        
        const effectiveRate = getEffectiveRate(corridor);
        const sampleAmount = 100; 
        const feeAmount = calculateFeeAmount(sampleAmount, corridor.feeSchedule);
        
        rates.push({
          from: originCountry.currency,
          to: corridor.currency,
          fromCountry: originCountry.countryDisplayName,
          toCountry: corridor.countryDisplayName,
          rate: Number(corridor.fxRate) || 0,
          effectiveRate: effectiveRate !== corridor.fxRate ? effectiveRate : undefined,
          hasGovIncentive: !!corridor.govIncentive,
          govIncentiveFootnote: corridor.govIncentive?.footnote,
          fee: formatFeeText(feeAmount, originCountry.currency)
        });
      }
    }

    const exchangeData: ExchangeRateData = {
      timestamp,
      rates
    };

    
    const logMessage = `TapTapSend: Scraped ${rates.length} exchange rate pairs at ${timestamp}`;
    await logToFile(logMessage);

    return exchangeData;
    
  } catch (error) {
    const axiosError = error as AxiosError;
    let errorMessage = 'TapTapSend scraping failed: ';
    
    if (axiosError.response) {
      errorMessage += `HTTP ${axiosError.response.status} - ${axiosError.response.statusText}`;
    } else if (axiosError.code === 'ECONNABORTED') {
      errorMessage += 'Request timeout';
    } else if (axiosError.code === 'ENOTFOUND') {
      errorMessage += 'DNS resolution failed';
    } else {
      errorMessage += axiosError.message;
    }
    
    await logToFile(errorMessage);
    return null;
  }
}

export async function getTapTapSendRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
  try {
    const data = await scrapeTapTapSendExchangeRates();
    if (!data) return null;
    
    const rate = data.rates.find(r => 
      r.from === fromCurrency && r.to === toCurrency
    );
    
    return rate ? (rate.effectiveRate || rate.rate) : null;
  } catch (error) {
    await logToFile(`Failed to get specific rate ${fromCurrency}→${toCurrency}: ${error}`);
    return null;
  }
}

export async function getPopularTapTapSendRates(): Promise<{ [key: string]: number } | null> {
  try {
    const data = await scrapeTapTapSendExchangeRates();
    if (!data) return null;
    
    const popularRates: { [key: string]: number } = {};
    
    const popularCurrencies = ['NGN', 'GHS', 'KES', 'UGX', 'INR', 'PHP', 'BDT'];
    
    for (const currency of popularCurrencies) {
      const rate = data.rates.find(r => 
        r.from === 'USD' && r.to === currency
      );
      
      if (rate) {
        popularRates[`USD_${currency}`] = rate.effectiveRate || rate.rate;
      }
    }
    
    return popularRates;
  } catch (error) {
    await logToFile(`Failed to get popular rates: ${error}`);
    return null;
  }
}