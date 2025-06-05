interface Endpoint {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  payload?: Record<string, any>;
  headers?: Record<string, string>;
}

const endpoints: Endpoint[] = [
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
    name: 'TapTapSend API',
    url: 'https://api.taptapsend.com/api/fxRates',
    method: 'GET',
    headers: {
      'Appian-Version': 'web/2022-05-03.0',
      'X-Device-Id': 'web',
      'X-Device-Model': 'web',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  },
];

export default endpoints;