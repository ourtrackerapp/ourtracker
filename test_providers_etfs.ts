import { getAlpacaQuote } from './server/providers/alpaca.js';
import { getFinnhubQuote } from './server/providers/finnhub.js';

const symbols = ['SXR8', 'VVSM', 'SXR8.DE', 'VVSM.DE'];

async function testProvedores() {
  console.log('--- TESTE ALPACA & FINNHUB ---');
  
  for (const sym of symbols) {
    console.log(`\nTestando ticker: ${sym}`);
    
    // Teste Alpaca
    try {
      const alpaca = await getAlpacaQuote(sym);
      console.log(`Alpaca: ${alpaca ? 'SUCESSO (Preço: ' + alpaca.price + ')' : 'Falhou'}`);
    } catch (e) {
      console.log(`Alpaca: Erro`);
    }

    // Teste Finnhub
    try {
      const finnhub = await getFinnhubQuote(sym);
      console.log(`Finnhub: ${finnhub ? 'SUCESSO (Preço: ' + finnhub.price + ')' : 'Falhou'}`);
    } catch (e) {
      console.log(`Finnhub: Erro`);
    }
  }
}

testProvedores();
