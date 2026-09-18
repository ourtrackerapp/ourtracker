import yahooFinance from 'yahoo-finance2';

const YahooFinanceClass = (yahooFinance as any).default || yahooFinance;
const yf = new YahooFinanceClass();

async function test() {
  try {
    const quote = await yf.quote('AMZN');
    console.log('Quote:', JSON.stringify(quote, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
