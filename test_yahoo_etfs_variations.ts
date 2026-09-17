import WebSocket from 'ws';
import protobuf from 'protobufjs';

const protoRoot = protobuf.Root.fromJSON({
  nested: {
    PricingData: {
      fields: {
        id: { type: "string", id: 1 },
        price: { type: "float", id: 2 },
      }
    }
  }
});

const PricingData = protoRoot.lookupType("PricingData");
const symbols = ['SXR8.DE', 'SXR8', 'SXR8.XETRA', 'VVSM.DE', 'VVSM', 'VVSM.XETRA'];

console.log('--- TESTE VARIÁVEIS TICKERS YAHOO ---');
const ws = new WebSocket('wss://streamer.finance.yahoo.com/?version=2');

ws.on('open', () => {
  console.log('CONECTADO. Subscrevendo:', symbols);
  ws.send(JSON.stringify({ subscribe: symbols }));
});

ws.on('message', (data) => {
  try {
    const json = JSON.parse(data.toString());
    if (json.type === 'pricing' && json.message) {
      const buffer = Buffer.from(json.message, 'base64');
      const msg: any = PricingData.decode(buffer);
      console.log(`SUCESSO! Recebido para ticker: [${msg.id}]`);
      process.exit(0);
    }
  } catch (err) {}
});

setTimeout(() => {
  console.log('FALHA: Nenhuma das variações funcionou.');
  process.exit(1);
}, 15000);
