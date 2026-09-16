import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();
async function test() {
  try {
    const quote = await yf.quoteSummary('AAPL', { modules: ['financialData'] });
    console.log(quote.financialData?.targetMeanPrice);
  } catch (err) {
    console.error(err);
  }
}
test();
