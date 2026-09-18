export interface MetricExplanation {
  id: string;
  title: string;
  shortName: string;
  category: string;
  definition: string;
  example: string;
  interpretation: string;
}

export const METRIC_EXPLANATIONS: Record<string, MetricExplanation> = {
  targetPrice: {
    id: 'targetPrice',
    title: 'Preço-Alvo Médio de Wall Street',
    shortName: 'Preço-Alvo',
    category: 'Wall Street & Analistas',
    definition: 'Média das estimativas de preço a 12 meses emitidas por analistas de bancos e corretoras de investimento.',
    example: 'Se a ação cota a 100€ e o preço-alvo médio é 125€, os analistas preveem um ganho de +25% no próximo ano.',
    interpretation: 'Pensa nisto como um grupo de peritos a avaliar uma casa: se acham que vai valorizar dos 100 mil para os 120 mil euros (+20%), recomendam comprar antes que suba. Se acham que vai descer para 80 mil (-20%), avisam que o preço está esticado. É uma estimativa informada, não uma certeza.',
  },
  recommendation: {
    id: 'recommendation',
    title: 'Consenso de Recomendação',
    shortName: 'Recomendação',
    category: 'Wall Street & Analistas',
    definition: 'Opinião combinada dos analistas que acompanham a empresa (Compra Forte, Compra, Manter, Venda).',
    example: 'Uma nota de 1.8 (numa escala de 1 a 5) significa que a grande maioria dos analistas aconselha a compra das ações.',
    interpretation: 'Funciona como a pontuação de estrelas num restaurante: quanto mais perto de 1.0 (Compra Forte), mais os especialistas dizem "este negócio vale muito a pena". Se a nota subir para 3.0 ou mais (Manter ou Vender), o sinal é de cautela ou de que o preço já subiu o que tinha a subir.',
  },
  pe: {
    id: 'pe',
    title: 'P/E Atual (Preço / Lucro)',
    shortName: 'P/E Atual',
    category: 'Valuation',
    definition: 'Mede quantas vezes o lucro líquido anual que a empresa gera tu estás a pagar pelo preço de cada ação.',
    example: 'Se a ação custa 50€ e lucrou 2,50€ por ação no último ano, o P/E é 20x. Demorarias 20 anos a reaver o valor só com os lucros passados.',
    interpretation: 'Pensa nisto como comprar uma loja ou um apartamento para arrendar: se compras por 100.000€ e ele dá 5.000€ de lucro limpo por ano, o P/E é 20 (demoras 20 anos a reaver o investimento). Quanto mais baixo, mais depressa o negócio "se paga". Um P/E alto só compensa se a empresa for crescer muito nos próximos anos.',
  },
  forwardPE: {
    id: 'forwardPE',
    title: 'Forward P/E (Preço / Lucro Futuro)',
    shortName: 'Forward P/E',
    category: 'Valuation',
    definition: 'Relação entre a cotação de hoje e os lucros que os especialistas esperam que a empresa tenha nos próximos 12 meses.',
    example: 'Se o P/E atual é 25x e o Forward P/E desce para 18x, significa que os lucros futuros devem subir com força.',
    interpretation: 'É a mesma conta do P/E, mas a olhar para o para-brisas em vez do retrovisor. Se o Forward P/E for mais baixo do que o P/E atual, significa que a empresa vai faturar e lucrar mais no próximo ano, tornando a ação proporcionalmente mais barata para quem a mantiver.',
  },
  pegRatio: {
    id: 'pegRatio',
    title: 'PEG Ratio (Preço face ao Crescimento)',
    shortName: 'PEG Ratio',
    category: 'Valuation',
    definition: 'Ajusta o P/E à velocidade de crescimento dos lucros para tirar a teima se uma ação que parece cara vale mesmo a pena.',
    example: 'Um P/E de 30 com lucros a crescer 30% ao ano dá um PEG de 1.0 (preço justo). Com crescimento de apenas 10%, o PEG sobe para 3.0 (cara).',
    interpretation: 'Serve para tirar as dúvidas: "Esta ação parece cara, mas o seu ritmo de crescimento compensa?". A regra de ouro é simples: abaixo de 1.0 a ação é uma pechincha pelo ritmo que cresce; acima de 1.5 ou 2.0 estás a pagar um preço salgado por esse crescimento.',
  },
  pb: {
    id: 'pb',
    title: 'P/B (Preço / Valor Patrimonial)',
    shortName: 'P/B',
    category: 'Valuation',
    definition: 'Compara o preço da ação com o valor contabilístico dos bens que a empresa tem (edifícios, máquinas, dinheiro menos dívidas).',
    example: 'Se o património líquido por ação é 20€ e ela cota a 30€, o P/B é 1.5x (pagas 1,50€ por cada 1€ de património real).',
    interpretation: 'Imagina que uma empresa fecha hoje, vende todos os prédios, computadores e armazéns, e paga todas as dívidas. O que sobrar é o valor patrimonial. Se o P/B for 1.0, pagas exatamente o valor das coisas que ela tem. Se for 0.8, compras com desconto. Se for 10.0, estás a pagar pela marca, tecnologia e clientes, não por tijolos.',
  },
  ps: {
    id: 'ps',
    title: 'P/S (Preço / Vendas)',
    shortName: 'P/S',
    category: 'Valuation',
    definition: 'Mede quantos euros os investidores estão a pagar por cada 1 euro que entra na faturação total da empresa.',
    example: 'Se uma empresa fatura 10 mil milhões e vale 20 mil milhões em bolsa, o seu P/S é 2.0x.',
    interpretation: 'Mede quantos euros pagas por cada 1 euro que entra na caixa registadora da empresa. É muito útil em empresas inovadoras que já faturam milhões mas reinvestem tudo e ainda não mostram lucros limpos. Abaixo de 2x costuma ser moderado; acima de 10x só se justifica se as vendas forem multiplicar.',
  },
  evEbitda: {
    id: 'evEbitda',
    title: 'EV / EBITDA (Valor Total / Lucro Operacional)',
    shortName: 'EV/EBITDA',
    category: 'Valuation',
    definition: 'Compara o custo total de comprar a empresa inteira (incluindo pagar as suas dívidas) com o lucro que ela gera no dia a dia.',
    example: 'Um rácio de 10x significa que a operação da empresa geraria dinheiro suficiente para pagar a compra completa em 10 anos.',
    interpretation: 'É a conta que um investidor rico faz se quiser comprar a empresa toda: paga as ações, liquida os empréstimos no banco, desconta o dinheiro no cofre e vê quantos anos de lucro do negócio do dia a dia precisa para reaver esse custo total. Abaixo de 10 anos é geralmente bom negócio.',
  },
  eps: {
    id: 'eps',
    title: 'EPS Atual (Lucro por Ação)',
    shortName: 'EPS Atual',
    category: 'Valuation',
    definition: 'Fatia do lucro líquido limpo dos últimos 12 meses que pertence a cada ação individual.',
    example: 'Se a empresa lucrou 100 milhões e tem 50 milhões de ações, o EPS é 2,00€ por cada ação emitida.',
    interpretation: 'Imagina uma pizza de lucros fatiada pelo número de ações em circulação. O EPS é o valor em dinheiro que calha a cada fatia tua. Se este ano a tua fatia for de 3,00€ e no próximo for de 4,00€, a empresa está a gerar mais riqueza real para o teu bolso.',
  },
  forwardEps: {
    id: 'forwardEps',
    title: 'Forward EPS (Lucro Estimado Futuro)',
    shortName: 'Forward EPS',
    category: 'Valuation',
    definition: 'Estimativa dos analistas para o lucro que a empresa irá gerar por ação no próximo ano.',
    example: 'Se o EPS passado foi 2,00€ e o Forward EPS é 2,60€, espera-se que o lucro cresça +30%.',
    interpretation: 'É a estimativa dos especialistas sobre o tamanho da fatia de lucro que a tua ação vai receber no próximo ano. Se a fatia futura for maior do que a de hoje, o negócio está a acelerar e a ganhar mais dinheiro.',
  },
  beta: {
    id: 'beta',
    title: 'Beta (Volatilidade e Risco)',
    shortName: 'Beta',
    category: 'Valuation',
    definition: 'Mede a força com que o preço da ação balança quando a bolsa em geral sobe ou desce.',
    example: 'Um Beta de 1.4 significa que, se a bolsa subir 10%, a ação tende a subir 14%; mas se a bolsa cair 10%, tende a cair 14%.',
    interpretation: 'Imagina a bolsa como ondas no mar: um barco normal sobe e desce ao mesmo ritmo das ondas (Beta = 1.0). Se o Beta for 1.8, é como uma lancha desportiva: salta mais alto quando a onda sobe, mas bate com mais violência quando a onda cai. Se o Beta for 0.6, é como um cargueiro: mal sente o mar a abanar.',
  },
  profitMargins: {
    id: 'profitMargins',
    title: 'Margem Líquida',
    shortName: 'Margem Líq.',
    category: 'Rentabilidade',
    definition: 'Percentagem de cada euro de vendas que sobra como lucro limpo no bolso após pagar todos os custos, salários e impostos.',
    example: 'Uma margem de 20% significa que, em cada 100€ que entram na loja, sobram 20€ de lucro limpo no fim do mês.',
    interpretation: 'De cada 100€ que entram na caixa registadora, quanto sobra limpo depois de pagar ordenados, mercadorias, luz e Finanças? Margens de 20% ou mais mostram empresas muito fortes que conseguem cobrar bons preços. Margens de 2% ou 3% vivem com o coração nas mãos a qualquer subida de custos.',
  },
  operatingMargins: {
    id: 'operatingMargins',
    title: 'Margem Operacional',
    shortName: 'Margem Oper.',
    category: 'Rentabilidade',
    definition: 'Eficiência da atividade principal da empresa antes de pagar juros de dívidas ao banco e impostos.',
    example: 'Uma margem de 25% significa que o negócio principal gera 25 cêntimos de lucro por cada euro de vendas.',
    interpretation: 'Mede a saúde do negócio no dia a dia. Se uma padaria fatura 100€ e gasta 75€ em farinha, padeiros e fornos, sobram 25€ de lucro operacional. Permite ver se o negócio em si funciona bem, antes de falar com bancos ou com o Estado.',
  },
  grossMargins: {
    id: 'grossMargins',
    title: 'Margem Bruta',
    shortName: 'Margem Bruta',
    category: 'Rentabilidade',
    definition: 'Lucro imediato da venda retirando apenas o custo direto de fabrico do produto ou serviço.',
    example: 'Se compras uma peça por 30€ e a vendes por 100€, a margem bruta é de 70%.',
    interpretation: 'É o primeiro fôlego de lucro: a diferença direta entre o que custa produzir o produto e o preço a que o vendes na prateleira. Se fazes uma camisola por 20€ e a vendes a 100€, ganhas 80€ brutos. Quanto maior for, mais dinheiro tens para pagar lojas, anúncios e salários.',
  },
  returnOnEquity: {
    id: 'returnOnEquity',
    title: 'ROE (Retorno sobre Capital Próprio)',
    shortName: 'ROE',
    category: 'Rentabilidade',
    definition: 'Taxa de rentabilidade que a gestão consegue gerar com o dinheiro investido pelos próprios acionistas.',
    example: 'Um ROE de 20% significa que por cada 100€ postos na empresa, a gestão gerou 20€ de lucro num ano.',
    interpretation: 'Mostra se os administradores sabem multiplicar o dinheiro dos donos da empresa. Se entregas 100€ a um amigo para abrir um negócio e ele te devolve 20€ de lucro limpo no fim do ano (ROE de 20%), é um excelente gestor. Valores acima de 15% distinguem as melhores empresas do mundo.',
  },
  returnOnAssets: {
    id: 'returnOnAssets',
    title: 'ROA (Retorno sobre Ativos Totais)',
    shortName: 'ROA',
    category: 'Rentabilidade',
    definition: 'Mede quanto lucro a empresa consegue tirar de tudo o que possui (máquinas, armazéns, carrinhas e tecnologia).',
    example: 'Um ROA de 8% indica que cada 100€ em bens da empresa geram 8€ de lucros todos os anos.',
    interpretation: 'Mede se a empresa aproveita bem tudo o que comprou. Se uma fábrica tem 1 milhão de euros em maquinaria e tira 80 mil euros de lucro líquido (ROA de 8%), significa que não tem ferramentas paradas a apanhar pó e sabe pôr os seus bens a render.',
  },
  marketCap: {
    id: 'marketCap',
    title: 'Capitalização Bolsista',
    shortName: 'Capitalização',
    category: 'Balanço & Caixa',
    definition: 'Valor de mercado da empresa inteira se alguém comprasse todas as ações existentes na bolsa hoje.',
    example: '100 milhões de ações a 50€ cada dá uma capitalização bolsista de 5 mil milhões de euros (5B€).',
    interpretation: 'É o preço de compra da empresa inteira. Empresas gigantes (mais de 100 mil milhões) raramente abrem falência e oferecem grande solidez, mas crescem com calma. Empresas pequenas (menos de 2 mil milhões) podem duplicar ou triplicar de valor muito mais depressa, mas têm maior risco de correr mal.',
  },
  totalCash: {
    id: 'totalCash',
    title: 'Caixa Total Disponível',
    shortName: 'Caixa Total',
    category: 'Balanço & Caixa',
    definition: 'Dinheiro vivo na conta bancária e investimentos rápidos que a empresa pode usar a qualquer momento.',
    example: 'Uma empresa com 10 mil milhões em caixa tem total tranquilidade para aguentar crises ou comprar concorrentes.',
    interpretation: 'É a poupança guardada na conta à ordem e em depósitos a prazo. Ter muito dinheiro no banco permite à empresa aguentar anos de vacas magras sem pedir favores aos bancos, investir em novos produtos ou comprar rivais em saldos durante uma crise.',
  },
  totalDebt: {
    id: 'totalDebt',
    title: 'Dívida Total',
    shortName: 'Dívida Total',
    category: 'Balanço & Caixa',
    definition: 'Soma de todos os empréstimos bancários e dívidas que a empresa tem de pagar a curto e longo prazo.',
    example: 'Se a empresa deve 4 mil milhões e tem 6 mil milhões no banco, tem na verdade 2 mil milhões de caixa limpo.',
    interpretation: 'Funciona como as contas da tua casa: é o crédito da casa e os cartões de crédito. Ter alguma dívida é normal para crescer, mas se a dívida for muito superior ao dinheiro que entra, a empresa fica com a corda no pescoço se os juros subirem ou as vendas caírem.',
  },
  freeCashflow: {
    id: 'freeCashflow',
    title: 'Free Cash Flow (Dinheiro Limpo no Banco)',
    shortName: 'Free Cash Flow',
    category: 'Balanço & Caixa',
    definition: 'Dinheiro real que sobra na conta no fim do ano depois de pagar todas as despesas e obras necessárias.',
    example: 'Se a empresa faturou e pagou tudo e ainda sobraram 90 milhões livres na conta, esse é o seu Free Cash Flow.',
    interpretation: 'É o dinheiro vivo e limpo que cai de facto na conta bancária no fim do ano. Os lucros na contabilidade podem ser embelezados com regras teóricas, mas o dinheiro no banco não mente: é com ele que a empresa te paga dividendos, abate dívidas e recompra ações.',
  },
  currentRatio: {
    id: 'currentRatio',
    title: 'Current Ratio (Liquidez Imediata)',
    shortName: 'Current Ratio',
    category: 'Balanço & Caixa',
    definition: 'Compara o dinheiro que a empresa vai receber no próximo ano com as contas urgentes que tem de pagar.',
    example: 'Um rácio de 1.8 significa que tem 1,80€ para receber por cada 1,00€ de dívidas que vencem este ano.',
    interpretation: 'Compara o dinheiro que entra nos próximos 12 meses com as contas que vencem nesse prazo. Se for 1.5, tens 1,50€ para cada 1€ de faturas (estás tranquilo). Se for abaixo de 1.0, deves mais do que aquilo que tens para receber a curto prazo e podes passar por apertos para pagar as contas a tempo.',
  },
  debtToEquity: {
    id: 'debtToEquity',
    title: 'Dívida / Capital Próprio',
    shortName: 'Dívida / Capital',
    category: 'Balanço & Caixa',
    definition: 'Mede que percentagem do negócio é financiada por empréstimos dos bancos em vez de dinheiro dos acionistas.',
    example: 'Um valor de 50% significa que a dívida equivale a metade do dinheiro dos próprios donos da empresa.',
    interpretation: 'Mede o nível de recurso ao crédito bancário. Se for 50%, a empresa financia metade do que tem com empréstimos. Se passar dos 150% ou 200%, a empresa está a trabalhar com dinheiro emprestado até ao pescoço: lucra muito quando a economia vai bem, mas corre risco sério se houver uma crise.',
  },
  heldPercentInstitutions: {
    id: 'heldPercentInstitutions',
    title: 'Detenção por Grandes Fundos',
    shortName: 'Institucionais',
    category: 'Sentimento',
    definition: 'Percentagem de ações que pertence aos maiores fundos de investimento mundiais (como BlackRock ou Vanguard).',
    example: 'Se 75% da empresa pertence a fundos mundiais, indica que foi aprovada pelos maiores analistas do planeta.',
    interpretation: 'Mostra a fatia da empresa que está na mão dos "tubarões" de Wall Street (grandes fundos de pensões e ETFs globais). Se for alta (70% ou mais), tens a garantia de que a empresa é acompanhada pelos analistas mais exigentes do mundo e que é muito fácil comprar e vender ações.',
  },
  heldPercentInsiders: {
    id: 'heldPercentInsiders',
    title: 'Detenção pelos Fundadores e Gestores',
    shortName: 'Insiders',
    category: 'Sentimento',
    definition: 'Fatia das ações da empresa detida diretamente pelos fundadores, diretores executivos e chefias.',
    example: 'Se os fundadores têm 15% das ações, perdem o seu próprio dinheiro se a empresa fizer más escolhas.',
    interpretation: 'Mostra se os patrões têm a sua própria pele em jogo. Quando os administradores têm muito dinheiro do seu património pessoal nas ações da empresa, tratam o negócio como sua casa e pensam a longo prazo, porque perdem do seu bolso se cometerem disparates.',
  },
  shortPercentOfFloat: {
    id: 'shortPercentOfFloat',
    title: 'Apostas na Queda (Short Interest)',
    shortName: 'Short Interest',
    category: 'Sentimento',
    definition: 'Percentagem de ações em circulação que foram vendidas por investidores que estão a apostar que o preço vai cair.',
    example: 'Se 8% das ações estão em posições curtas, há muitos investidores a prever problemas ou queda iminente.',
    interpretation: 'Mede quantas pessoas estão a apostar dinheiro em como a ação vai descer. Menos de 2% ou 3% é o normal e sinaliza calma. Acima de 8% a 10% significa que há muita desconfiança no ar ou que muitos investidores acham que a empresa está com problemas ou cara demais.',
  },
  dividendYield: {
    id: 'dividendYield',
    title: 'Dividend Yield (Rendimento Anual)',
    shortName: 'Dividend Yield',
    category: 'Dividendos',
    definition: 'Percentagem do preço da ação que a empresa devolve anualmente aos investidores em dinheiro limpo na conta.',
    example: 'Se compras uma ação a 100€ e ela paga 4,00€ de dividendo por ano, o teu rendimento anual é de 4,00%.',
    interpretation: 'É a "renda" passiva que a ação te paga diretamente na conta sem teres de vender nada. Se custa 100€ e rende 4%, recebes 4€ por ano limpos na mão por cada ação que tens. É o equivalente a receber a renda mensal de um imóvel alugado.',
  },
  dividendRate: {
    id: 'dividendRate',
    title: 'Dividendo Anual por Ação',
    shortName: 'Dividendo Anual',
    category: 'Dividendos',
    definition: 'Montante em euros ou dólares que cada ação individual recebe ao longo de um ano completo.',
    example: 'Se a empresa paga 0,50€ a cada trimestre, o dividendo anual total é de 2,00€ por ação.',
    interpretation: 'É o valor em dinheiro vivo que cada ação tua recebe num ano. Se tens 100 ações e o dividendo anual é de 2,00€ por ação, caem 200€ brutos na tua conta bancária ao longo do ano.',
  },
  payoutRatio: {
    id: 'payoutRatio',
    title: 'Payout Ratio (Fatia do Lucro Distribuída)',
    shortName: 'Payout Ratio',
    category: 'Dividendos',
    definition: 'Que percentagem do lucro total anual a empresa entrega aos acionistas em vez de guardar para reinvestir.',
    example: 'Se a empresa lucrou 10€ por ação e pagou 4€ de dividendo, o Payout Ratio é de 40%.',
    interpretation: 'De todo o lucro que teve no ano, que fatia é que a empresa te dá em vez de guardar para crescer? Se der 40%, guarda 60% para abrir novas fábricas ou lojas (é saudável e equilibrado). Se der 90% ou 100%, está a entregar quase tudo e se vier um ano mau terá de cortar o dividendo.',
  },
  fiveYearAvgDividendYield: {
    id: 'fiveYearAvgDividendYield',
    title: 'Yield Média a 5 Anos',
    shortName: 'Yield Méd. 5A',
    category: 'Dividendos',
    definition: 'Média histórica do rendimento de dividendos pago por esta ação ao longo dos últimos cinco anos.',
    example: 'Se a média histórica era 3% e hoje a yield é 5%, a ação pode estar com um preço com bom desconto.',
    interpretation: 'É o termómetro do dividendo: compara o que a ação está a render hoje com o que costumava pagar nos últimos 5 anos. Se hoje paga 5% e o habitual era 3%, pode ser um sinal de que a ação está a bom preço ou que a empresa aumentou a distribuição aos sócios.',
  },
  exDividendDate: {
    id: 'exDividendDate',
    title: 'Data Ex-Dividendo (Dia de Corte)',
    shortName: 'Data Ex-Div',
    category: 'Dividendos',
    definition: 'O primeiro dia em que a ação passa a negociar sem dar direito a receber o próximo dividendo anunciado.',
    example: 'Se a data for 15 de Outubro, tens de ter a ação comprada até 14 de Outubro para receberes o pagamento.',
    interpretation: 'É o dia de corte. Para receberes o dividendo, tens de ser dono da ação até ao encerramento do dia útil anterior. Se comprares no próprio dia ex-dividendo ou depois, o dividendo desse trimestre vai para o investidor antigo.',
  },
  earningsDate: {
    id: 'earningsDate',
    title: 'Apresentação de Resultados',
    shortName: 'Resultados',
    category: 'Eventos',
    definition: 'Data agendada pela empresa para divulgar publicamente os lucros e contas oficiais do último trimestre.',
    example: 'No dia de resultados, o mercado descobre se a empresa superou ou falhou as metas de lucro esperadas.',
    interpretation: 'É o "dia das notas" da empresa: a liderança revela à bolsa se faturou e lucrou mais ou menos do que os analistas esperavam. Costuma ser um dia em que as cotações dão saltos ou quedas bruscas.',
  },
};

function formatNum(num?: number, symbol = '€'): string {
  if (num == null || isNaN(num)) return '-';
  const abs = Math.abs(num);
  if (abs >= 1e12) return `${(num / 1e12).toFixed(2)}T ${symbol}`;
  if (abs >= 1e9) return `${(num / 1e9).toFixed(2)}B ${symbol}`;
  if (abs >= 1e6) return `${(num / 1e6).toFixed(2)}M ${symbol}`;
  return `${num.toLocaleString('pt-PT', { maximumFractionDigits: 2 })} ${symbol}`;
}

export interface ComparisonParams {
  metricId: string;
  ticker: string;
  name?: string;
  currentPrice?: number;
  metrics: any;
  currencySymbol: string;
  isUsd: boolean;
  shares?: number;
}

export interface MetricComparisonResult {
  userContext: string;
  oppositeExample: string;
}

export function generateCustomMetricComparison({
  metricId,
  ticker,
  name,
  currentPrice,
  metrics,
  currencySymbol,
  isUsd,
  shares = 0,
}: ComparisonParams): MetricComparisonResult | null {
  if (!metrics) return null;

  const sym = ticker || name || 'ação';

  switch (metricId) {
    case 'targetPrice': {
      const target = isUsd ? (metrics.targetPrice ?? metrics.targetPriceEur) : metrics.targetPriceEur;
      if (target == null) return null;
      const upside = metrics.targetUpsidePercent;
      const priceStr = currentPrice ? `${currencySymbol}${currentPrice.toFixed(2)}` : 'preço atual';
      
      let userContext = `A tua ação ${sym} cota a ${priceStr} e o preço-alvo médio de Wall Street aponta para ${currencySymbol}${target.toFixed(2)}.`;
      let oppositeExample = '';

      if (upside != null) {
        const sign = upside > 0 ? '+' : '';
        userContext += ` Isto representa um potencial estimado de ${sign}${upside.toFixed(1)}% face à cotação atual.`;
        if (upside > 0) {
          oppositeExample = `Cenário Oposto: Imagina uma empresa XPTO que cota a 100€, mas os analistas estimam que ela só vale 80€ (-20% de potencial negativo). Nesse caso inverso, Wall Street considera que as ações subiram depressa demais e que o risco de desvalorização a 12 meses é elevado.`;
        } else {
          oppositeExample = `Cenário Oposto: Numa empresa que passou por correções excessivas, os analistas podem atribuir um preço-alvo de 100€ quando ela cota a 70€ (+43% de valorização estimada), sinalizando que o mercado antecipa uma forte recuperação do negócio.`;
        }
      } else {
        oppositeExample = `Cenário Oposto: Se uma ação cota muito acima do seu preço-alvo consensual, os analistas estão a emitir um alerta de que o preço atual não é sustentado pelos lucros futuros da empresa.`;
      }

      return { userContext, oppositeExample };
    }

    case 'recommendation': {
      const rec = metrics.recommendation;
      const mean = metrics.recommendationMean;
      if (!rec && mean == null) return null;
      const isPositive = mean != null ? mean <= 2.5 : true;
      const advice = isPositive
        ? 'indica otimismo e recomendação clara de compra por parte da maioria dos analistas'
        : 'indica uma postura prudente de manutenção ou redução de risco';
      
      const userContext = `Para a tua ação ${sym}, o consenso geral dos analistas é "${rec || 'Neutro'}"${mean != null ? ` (nota média de ${mean.toFixed(1)}/5.0)` : ''}. No contexto atual, ${advice}.`;
      
      const oppositeExample = isPositive
        ? `Cenário Oposto: Numa empresa em declínio com perda de quota de mercado, a recomendação consensual seria de 4.0 ou 5.0 ("Venda" ou "Subponderar"). Nesse caso, os analistas aconselham os clientes a saírem do investimento para evitar novas perdas.`
        : `Cenário Oposto: Numa empresa em aceleração meteórica de lucros, a recomendação média aproxima-se de 1.1 ou 1.2 ("Compra Forte"), onde praticamente todos os bancos mundiais recomendam reforçar posições sem hesitar.`;

      return { userContext, oppositeExample };
    }

    case 'pe': {
      if (metrics.pe == null) return null;
      const pe = metrics.pe;
      const userContext = `Com o P/E atual de ${pe.toFixed(2)}x na tua ação ${sym}, estás a pagar ${pe.toFixed(2)}€ por cada 1,00€ de lucro líquido gerado pela empresa nos últimos 12 meses.`;
      
      const oppositeExample = pe > 25
        ? `Cenário Oposto: Uma empresa tradicional (como um banco ou empresa de energia) pode ter um P/E de apenas 8x a 10x. Pagarias apenas 8€ a 10€ por cada 1€ de lucro, recuperando o capital muito mais depressa (em 8 a 10 anos), embora o seu negócio costume crescer mais devagar do que uma empresa com P/E elevado.`
        : `Cenário Oposto: Uma empresa tecnológica em rápida expansão (como a Nvidia ou a Amazon) costuma negociar com P/E de 50x ou 60x. Os investidores aceitam esperar 50 anos pelo lucro de hoje porque confiam que nos próximos anos o lucro vai multiplicar várias vezes.`;

      return { userContext, oppositeExample };
    }

    case 'forwardPE': {
      if (metrics.forwardPE == null) return null;
      const fpe = metrics.forwardPE;
      const pe = metrics.pe;
      const diffText = pe != null
        ? fpe < pe
          ? ` Este valor é inferior ao P/E atual (${pe.toFixed(2)}x), o que sinaliza que os analistas projetam um crescimento dos lucros da empresa no próximo ano.`
          : ` Este múltiplo é superior ao P/E atual (${pe.toFixed(2)}x), sugerindo lucros mais comprimidos ou estimativas cautelosas.`
        : '';
      const userContext = `O Forward P/E da tua ação ${sym} é de ${fpe.toFixed(2)}x.${diffText}`;

      const oppositeExample = pe != null && fpe < pe
        ? `Cenário Oposto: Numa empresa cujos custos vão subir ou que vai perder vendas, o Forward P/E sobe (ex: de 20x para 30x). Isto revela que a empresa vai lucrar menos no próximo ano, tornando a ação proporcionalmente mais cara para quem comprar hoje.`
        : `Cenário Oposto: Numa empresa prestes a lançar um produto revolucionário, o Forward P/E cai expressivamente face ao P/E atual, revelando que os lucros futuros vão dar um salto e tornar a ação uma pechincha.`;

      return { userContext, oppositeExample };
    }

    case 'pegRatio': {
      if (metrics.pegRatio == null) return null;
      const peg = metrics.pegRatio;
      const note = peg <= 1.0
        ? 'Estando abaixo ou próximo de 1.0, sugere que a ação pode estar a preço atrativo considerando a rapidez com que os seus lucros estão a crescer.'
        : 'Estando acima de 1.0, significa que o mercado já está a pagar um prémio adiantado pela taxa de crescimento esperada.';
      const userContext = `O PEG Ratio da tua ação ${sym} é de ${peg.toFixed(2)}. ${note}`;

      const oppositeExample = peg <= 1.2
        ? `Cenário Oposto: Uma ação com PEG de 2.5x está a negociar com um prémio muito caro face ao seu crescimento modesto. Estarias a pagar muito por cada cêntimo de crescimento futuro.`
        : `Cenário Oposto: Uma ação com PEG de 0.7x é uma pechincha de crescimento: a empresa está a acelerar os seus lucros a 30% ao ano, mas a cotação em bolsa ainda não refletiu esse dinamismo.`;

      return { userContext, oppositeExample };
    }

    case 'pb': {
      if (metrics.pb == null) return null;
      const pb = metrics.pb;
      const userContext = `Com um P/B de ${pb.toFixed(2)}x, estás a pagar ${pb.toFixed(2)}€ por cada 1,00€ de valor patrimonial líquido (ativos menos passivos) registado nos livros contabilísticos da ${sym}.`;

      const oppositeExample = pb > 3.0
        ? `Cenário Oposto: Um banco tradicional ou siderúrgica pode cotar com um P/B de 0.8x. Estarias a comprar a empresa por menos do que aquilo que os seus cofres e propriedades físicas valem no papel (com desconto real de património).`
        : `Cenário Oposto: Uma empresa digital de software pode cotar a um P/B de 15x, porque o seu verdadeiro valor não são fábricas ou tijolos, mas sim marcas, patentes e utilizadores fiéis.`;

      return { userContext, oppositeExample };
    }

    case 'ps': {
      if (metrics.ps == null) return null;
      const ps = metrics.ps;
      const userContext = `A tua ação ${sym} tem um P/S de ${ps.toFixed(2)}x. Ou seja, o valor de mercado total da empresa equivale a ${ps.toFixed(2)} vezes a sua faturação anual total.`;

      const oppositeExample = ps > 4.0
        ? `Cenário Oposto: Um supermercado com faturação gigantesca (como a Jerónimo Martins ou a Walmart) tem um P/S de apenas 0.6x. Pagas apenas 60 cêntimos em bolsa por cada 1 euro que passa na caixa registadora.`
        : `Cenário Oposto: Uma empresa pioneira de Inteligência Artificial pode negociar a um P/S de 25x, porque o mercado espera que as suas receitas anuais multipliquem por dez nos próximos anos.`;

      return { userContext, oppositeExample };
    }

    case 'evEbitda': {
      if (metrics.evEbitda == null) return null;
      const ev = metrics.evEbitda;
      const userContext = `O EV/EBITDA da tua ação ${sym} é de ${ev.toFixed(2)}x. Significa que a sua atividade operacional pagaria todo o valor de mercado somado às suas dívidas em cerca de ${ev.toFixed(1)} anos.`;

      const oppositeExample = ev > 14.0
        ? `Cenário Oposto: Uma fábrica bem gerida com EV/EBITDA de 6x pagaria todo o custo de compra da empresa e as suas dívidas em apenas 6 anos através dos seus lucros operacionais habituais.`
        : `Cenário Oposto: Uma multinacional de luxo com EV/EBITDA de 28x exigiria quase três décadas de lucros operacionais para devolver o custo total da sua compra aos preços atuais.`;

      return { userContext, oppositeExample };
    }

    case 'eps': {
      const val = isUsd ? (metrics.eps ?? metrics.epsEur) : metrics.epsEur;
      if (val == null) return null;
      const myEarnings = shares > 0 ? ` Tendo tu ${shares} ações no portefólio, a tua fatia correspondente no lucro gerado pela empresa no último ano foi de ${currencySymbol}${(val * shares).toFixed(2)}.` : '';
      const userContext = `A tua ação ${sym} gerou ${currencySymbol}${val.toFixed(2)} de lucro limpo por cada ação emitida nos últimos 12 meses.${myEarnings}`;

      const oppositeExample = val > 0
        ? `Cenário Oposto: Uma empresa que ainda dá prejuízo tem um EPS negativo (ex: -1,50€ por ação). Em vez de gerar lucro para os donos, a empresa está a queimar dinheiro e precisa de novos empréstimos ou emissão de ações para sobreviver.`
        : `Cenário Oposto: Uma empresa sólida e lucrativa gera um EPS elevado e crescente todos os trimestres, fortalecendo as suas finanças e permitindo pagar dividendos aos acionistas.`;

      return { userContext, oppositeExample };
    }

    case 'forwardEps': {
      const val = isUsd ? (metrics.forwardEps ?? metrics.forwardEpsEur) : metrics.forwardEpsEur;
      if (val == null) return null;
      const currentEps = isUsd ? (metrics.eps ?? metrics.epsEur) : metrics.epsEur;
      const isGrowing = currentEps ? val > currentEps : true;
      const evo = currentEps && currentEps !== 0
        ? ` (${val > currentEps ? '+' : ''}${(((val - currentEps) / Math.abs(currentEps)) * 100).toFixed(1)}% face ao EPS atual).`
        : '.';
      const userContext = `Os analistas projetam que a ${sym} gere ${currencySymbol}${val.toFixed(2)} de lucro por ação nos próximos 12 meses${evo}`;

      const oppositeExample = isGrowing
        ? `Cenário Oposto: Numa empresa com Forward EPS em queda face ao passado, os analistas antecipam que a fatia de lucro por ação vai encolher, o que costuma pressionar a cotação em bolsa para baixo.`
        : `Cenário Oposto: Numa empresa que vai acelerar os seus ganhos futuros, o Forward EPS dispara, sinalizando aos investidores que a empresa está a criar mais riqueza por ação.`;

      return { userContext, oppositeExample };
    }

    case 'beta': {
      if (metrics.beta == null) return null;
      const b = metrics.beta;
      const isVolatile = b > 1.05;
      const txt = isVolatile
        ? `é aproximadamente ${((b - 1) * 100).toFixed(0)}% mais volátil que a média do mercado, tendendo a amplificar tanto as subidas como as quedas.`
        : b < 0.95
        ? `é cerca de ${((1 - b) * 100).toFixed(0)}% mais estável e defensiva que a média geral do mercado.`
        : 'move-se praticamente com o mesmo nível de risco e oscilação que o mercado geral.';
      const userContext = `Com um Beta de ${b.toFixed(2)}, a tua ação ${sym} ${txt}`;

      const oppositeExample = isVolatile
        ? `Cenário Oposto: Uma empresa de distribuição de eletricidade ou de águas costuma ter um Beta de 0.4 a 0.6. As pessoas continuam a pagar água e luz mesmo em plena crise, por isso a cotação mal oscila quando a bolsa desaba.`
        : `Cenário Oposto: Uma ação de semicondutores ou de veículos elétricos pode ter um Beta de 1.8. Se a bolsa subir 5%, ela pode subir 9%; mas se houver pânico no mercado, a sua queda será muito mais acentuada.`;

      return { userContext, oppositeExample };
    }

    case 'profitMargins': {
      if (metrics.profitMargins == null) return null;
      const pm = metrics.profitMargins;
      const userContext = `A ${sym} tem uma margem líquida de ${pm.toFixed(2)}%. Ou seja, em cada 100€ que fatura em vendas de produtos ou serviços, retém ${pm.toFixed(2)}€ de lucro limpo no bolso.`;

      const oppositeExample = pm > 12
        ? `Cenário Oposto: Uma cadeia de supermercados ou gasolineiras opera frequentemente com margens de apenas 2% a 3%. De cada 100€ faturados, só sobram 2€ a 3€ de lucro. Precisam de vender volumes colossais e têm pouca margem de manobra se os custos subirem.`
        : `Cenário Oposto: Uma empresa de software ou farmacêutica com patentes exclusivas tem margens de 35% a 45%. Em cada 100€ de vendas, ficam 35€ a 45€ limpos, garantindo uma enorme almofada financeira perante qualquer crise.`;

      return { userContext, oppositeExample };
    }

    case 'operatingMargins': {
      if (metrics.operatingMargins == null) return null;
      const opm = metrics.operatingMargins;
      const userContext = `A margem operacional da tua ação ${sym} é de ${opm.toFixed(2)}%. Isto significa que sobram ${opm.toFixed(2)}€ de cada 100€ faturados pelo seu negócio principal antes de despesas com juros e impostos.`;

      const oppositeExample = opm > 15
        ? `Cenário Oposto: Uma companhia aérea tem custos pesadíssimos de combustível e manutenção, ficando com margens operacionais de apenas 3% a 5% em anos bons e negativas em anos fracos.`
        : `Cenário Oposto: Uma empresa digital de pagamentos pode atingir margens operacionais de 40%, convertendo uma enorme fatia de cada euro faturado em lucro direto da operação.`;

      return { userContext, oppositeExample };
    }

    case 'grossMargins': {
      if (metrics.grossMargins == null) return null;
      const gm = metrics.grossMargins;
      const userContext = `A margem bruta da ${sym} é de ${gm.toFixed(2)}%. Revela que após pagar os custos diretos de fabrico, a empresa retém ${gm.toFixed(2)}€ de cada 100€ de receita para pagar salários, lojas e investigação.`;

      const oppositeExample = gm > 50
        ? `Cenário Oposto: Uma montadora de automóveis tem uma margem bruta de apenas 15% a 20%, porque o fabrico de peças, aço e baterias absorve a quase totalidade do preço de venda do carro.`
        : `Cenário Oposto: Uma produtora de software tem margens brutas superiores a 80%, pois o custo direto de entregar mais uma licença de software a um novo utilizador é praticamente zero.`;

      return { userContext, oppositeExample };
    }

    case 'returnOnEquity': {
      if (metrics.returnOnEquity == null) return null;
      const roe = metrics.returnOnEquity;
      const userContext = `O ROE da tua ação ${sym} é de ${roe.toFixed(2)}%. Por cada 100€ de património que os acionistas mantêm na empresa, a gestão conseguiu gerar ${roe.toFixed(2)}€ de lucro líquido anual.`;

      const oppositeExample = roe > 15
        ? `Cenário Oposto: Uma empresa de autoestradas ou caminhos de ferro com ROE de apenas 4% precisa de montanhas de dinheiro imobilizado em asfalto e comboios para gerar lucros modestos.`
        : `Cenário Oposto: Empresas excecionais como a Apple ou a Visa chegam a superar 40% de ROE, gerando quantias massivas de lucro novo sem precisarem de pedir mais dinheiro aos seus investidores.`;

      return { userContext, oppositeExample };
    }

    case 'returnOnAssets': {
      if (metrics.returnOnAssets == null) return null;
      const roa = metrics.returnOnAssets;
      const userContext = `O ROA da ${sym} é de ${roa.toFixed(2)}%, gerando ${roa.toFixed(2)}€ de lucro anual por cada 100€ de ativos totais (fábricas, equipamentos, caixa e tecnologia) que possui.`;

      const oppositeExample = roa > 7
        ? `Cenário Oposto: Uma empresa pesada de mineração com ROA de apenas 2% tem biliões de euros em escavadoras e jazidas que produzem um retorno modesto face ao tamanho dos bens que detém.`
        : `Cenário Oposto: Uma empresa tecnológica sem fábricas físicas pode alcançar um ROA de 15% a 20%, extraindo grande rentabilidade de uma base de ativos muito leve e ágil.`;

      return { userContext, oppositeExample };
    }

    case 'marketCap': {
      const val = isUsd ? (metrics.marketCap ?? metrics.marketCapEur) : metrics.marketCapEur;
      if (val == null) return null;
      const isBig = val > 50e9;
      const userContext = `A tua ação ${sym} tem um valor de mercado total de ${formatNum(val, currencySymbol)}, somando o preço de todas as ações negociadas na bolsa.`;

      const oppositeExample = isBig
        ? `Cenário Oposto: Uma pequena empresa cotada ("Small-Cap") avaliada em 600 milhões de euros tem muito mais espaço para triplicar ou quintuplicar de tamanho, mas sofre oscilações muito mais bruscas e corre maior risco de negócio.`
        : `Cenário Oposto: Um colosso mundial de 2 triliões de euros oferece segurança máxima contra falências, mas já não tem capacidade matemática para duplicar de tamanho rapidamente devido à sua dimensão gigante.`;

      return { userContext, oppositeExample };
    }

    case 'totalCash': {
      const val = isUsd ? (metrics.totalCash ?? metrics.totalCashEur) : metrics.totalCashEur;
      if (val == null) return null;
      const userContext = `A empresa ${sym} tem ${formatNum(val, currencySymbol)} em reservas de caixa e depósitos bancários disponíveis para investir, atravessar crises ou remunerar acionistas.`;

      const oppositeExample = `Cenário Oposto: Uma empresa que vive sem reservas de caixa está sempre vulnerável: se houver um mês fraco ou uma crise económica, tem de recorrer a empréstimos bancários de urgência a taxas de juro elevadas para não fechar portas.`;

      return { userContext, oppositeExample };
    }

    case 'totalDebt': {
      const debt = isUsd ? (metrics.totalDebt ?? metrics.totalDebtEur) : metrics.totalDebtEur;
      const cash = isUsd ? (metrics.totalCash ?? metrics.totalCashEur) : metrics.totalCashEur;
      if (debt == null) return null;
      const hasNetCash = cash != null && cash > debt;
      const netText = cash != null
        ? hasNetCash
          ? ` Como possui ${formatNum(cash, currencySymbol)} em caixa, tem uma posição de caixa líquido positivo (tem mais dinheiro guardado do que dívidas).`
          : ` Descontando o caixa disponível (${formatNum(cash, currencySymbol)}), a sua dívida líquida real é de cerca de ${formatNum(debt - cash, currencySymbol)}.`
        : '';
      const userContext = `A dívida total contraída pela tua ação ${sym} é de ${formatNum(debt, currencySymbol)}.${netText}`;

      const oppositeExample = hasNetCash
        ? `Cenário Oposto: Uma empresa altamente endividada tem de gastar metade do seu lucro do dia a dia apenas para pagar juros ao banco. Se as receitas abrandarem, fica imediatamente em risco de incumprimento.`
        : `Cenário Oposto: Uma empresa com zero dívidas e muito dinheiro no cofre dorme tranquila e pode aproveitar momentos de crise para comprar concorrentes fragilizados a preço de saldo.`;

      return { userContext, oppositeExample };
    }

    case 'freeCashflow': {
      const val = isUsd ? (metrics.freeCashflow ?? metrics.freeCashflowEur) : metrics.freeCashflowEur;
      if (val == null) return null;
      const isPos = val > 0;
      const userContext = `A ${sym} gerou ${formatNum(val, currencySymbol)} em Free Cash Flow (dinheiro limpo que sobrou no banco) após pagar todas as operações e obras em infraestruturas (CapEx).`;

      const oppositeExample = isPos
        ? `Cenário Oposto: Uma empresa em fase pesada de obras ou de investimento pode ter Free Cash Flow negativo (-300M€). Significa que está a queimar dinheiro e precisa de recorrer a poupanças ou bancos para manter as portas abertas.`
        : `Cenário Oposto: Uma empresa madura que gera centenas de milhões em fluxo de caixa livre todos os trimestres pode recompensar diretamente os acionistas com dividendos fartos e compras de ações próprias.`;

      return { userContext, oppositeExample };
    }

    case 'currentRatio': {
      if (metrics.currentRatio == null) return null;
      const cr = metrics.currentRatio;
      const isComfortable = cr >= 1.2;
      const safe = isComfortable ? 'indica folga confortável a curto prazo' : 'sinaliza que deve ser monitorizado para evitar aperto de liquidez';
      const userContext = `O rácio de liquidez corrente da ${sym} é de ${cr.toFixed(2)}. Tem ${cr.toFixed(2)}€ de ativos a receber para cada 1,00€ de dívidas que vencem no próximo ano (${safe}).`;

      const oppositeExample = isComfortable
        ? `Cenário Oposto: Uma empresa com rácio de liquidez de 0.7 vive na corda bamba: se um cliente atrasar um pagamento importante, a empresa pode não ter liquidez para pagar as faturas que vencem no final do mês.`
        : `Cenário Oposto: Uma empresa com liquidez de 2.2 tem o dobro do dinheiro necessário para pagar qualquer despesa urgente, aguentando qualquer imprevisto sem sobressaltos.`;

      return { userContext, oppositeExample };
    }

    case 'debtToEquity': {
      if (metrics.debtToEquity == null) return null;
      const dte = metrics.debtToEquity;
      const userContext = `Na tua ação ${sym}, a dívida total equivale a ${dte.toFixed(1)}% do valor do capital próprio dos acionistas.`;

      const oppositeExample = dte > 100
        ? `Cenário Oposto: Uma empresa conservadora com apenas 15% de dívida/capital financia a sua expansão quase a 100% com os seus próprios lucros, estando totalmente imune a subidas de juros dos bancos.`
        : `Cenário Oposto: Uma empresa com 250% de rácio opera alavancada ao máximo pelo crédito bancário, multiplicando o risco para os acionistas caso o negócio atravesse um período fraco.`;

      return { userContext, oppositeExample };
    }

    case 'heldPercentInstitutions': {
      if (metrics.heldPercentInstitutions == null) return null;
      const inst = metrics.heldPercentInstitutions;
      const userContext = `Cerca de ${inst.toFixed(1)}% do capital da ${sym} pertence a grandes fundos institucionais (como Vanguard, BlackRock e fundos de pensões mundiais).`;

      const oppositeExample = inst > 60
        ? `Cenário Oposto: Numa ação onde os fundos só têm 15%, o ativo passa despercebido aos grandes investidores mundiais, tendo menor volume de negociação e movimentos de preço mais imprevisíveis.`
        : `Cenário Oposto: Quando 85% pertence aos maiores fundos do planeta, a empresa beneficia de cobertura constante pelos melhores analistas e de liquidez garantida para comprar e vender.`;

      return { userContext, oppositeExample };
    }

    case 'heldPercentInsiders': {
      if (metrics.heldPercentInsiders == null) return null;
      const ins = metrics.heldPercentInsiders;
      const userContext = `Fundadores, diretores executivos e administradores detêm diretamente ${ins.toFixed(1)}% das ações da ${sym}.`;

      const oppositeExample = ins > 8
        ? `Cenário Oposto: Numa empresa onde os gestores têm apenas 0.1% das ações, estes continuam a receber o seu ordenado chorudo mesmo que as ações caiam 50%, gerando um desalinhamento total com os pequenos investidores.`
        : `Cenário Oposto: Quando os fundadores mantêm 25% da empresa (como os criadores da Meta ou da Amazon nos primeiros anos), o seu próprio património pessoal está em jogo em cada decisão.`;

      return { userContext, oppositeExample };
    }

    case 'shortPercentOfFloat': {
      if (metrics.shortPercentOfFloat == null) return null;
      const sh = metrics.shortPercentOfFloat;
      const userContext = `${sh.toFixed(2)}% das ações em circulação da tua ação ${sym} estão atualmente emprestadas para investidores que estão a apostar na queda da cotação.`;

      const oppositeExample = sh > 4
        ? `Cenário Oposto: Numa empresa sólida com Short Interest de apenas 0.5%, o mercado confia plenamente no futuro do negócio e praticamente nenhum investidor se atreve a apostar na sua queda.`
        : `Cenário Oposto: Numa ação com 15% de posições curtas, o pessimismo é tão elevado que, se a empresa apresentar um lucro inesperado, os apostadores correm a comprar ações para estancar perdas, provocando uma subida explosiva ("short squeeze").`;

      return { userContext, oppositeExample };
    }

    case 'dividendYield': {
      if (metrics.dividendYield == null) return null;
      const dy = metrics.dividendYield;
      const divRate = isUsd ? (metrics.dividendRate ?? metrics.dividendRateEur) : metrics.dividendRateEur;
      const payoutText = shares > 0 && divRate
        ? ` Com as tuas ${shares} ações, geras aproximadamente ${currencySymbol}${(shares * divRate).toFixed(2)} por ano em dividendos brutos na tua carteira.`
        : '';
      const userContext = `A tua ação ${sym} tem um Dividend Yield de ${dy.toFixed(2)}% ao ano.${payoutText}`;

      const oppositeExample = dy > 1.5
        ? `Cenário Oposto: Empresas em aceleração tecnológica (como a Amazon ou a Tesla durante anos) pagam 0% de dividendos. Em vez de darem dinheiro aos acionistas, reinvestem cada cêntimo em novas tecnologias e fábricas para multiplicar o valor da ação a longo prazo.`
        : `Cenário Oposto: Uma empresa de telecomunicações ou de eletricidade pode pagar 6% a 7% de dividendo ao ano, oferecendo uma renda previsível e regular na tua conta bancária mesmo que o preço da ação não suba.`;

      return { userContext, oppositeExample };
    }

    case 'dividendRate': {
      const rate = isUsd ? (metrics.dividendRate ?? metrics.dividendRateEur) : metrics.dividendRateEur;
      if (rate == null) return null;
      const totalDiv = shares > 0 ? ` Com as tuas ${shares} ações, significa que recebes cerca de ${currencySymbol}${(shares * rate).toFixed(2)} brutos por ano.` : '';
      const userContext = `A ${sym} paga anualmente ${currencySymbol}${rate.toFixed(2)} por cada ação detida.${totalDiv}`;

      const oppositeExample = `Cenário Oposto: Uma empresa de puro crescimento não paga nenhum dividendo por ação (0,00€), preferindo colocar todo o capital gerado ao serviço da expansão acelerada do negócio.`;

      return { userContext, oppositeExample };
    }

    case 'payoutRatio': {
      if (metrics.payoutRatio == null) return null;
      const pr = metrics.payoutRatio;
      const userContext = `A ${sym} distribui ${pr.toFixed(1)}% do seu lucro líquido anual aos acionistas em dividendos, guardando os restantes ${(100 - pr).toFixed(1)}% para reinvestir no negócio.`;

      const oppositeExample = pr <= 65
        ? `Cenário Oposto: Uma empresa que entrega 95% do que ganha aos acionistas fica sem dinheiro de reserva para contingências. Se as vendas caírem ligeiramente, será forçada a cortar o dividendo.`
        : `Cenário Oposto: Uma empresa com Payout conservador de 25% dá uma pequena fatia aos investidores e retém 75% dos lucros para construir novos armazéns ou comprar rivais, impulsionando o crescimento futuro.`;

      return { userContext, oppositeExample };
    }

    case 'fiveYearAvgDividendYield': {
      if (metrics.fiveYearAvgDividendYield == null) return null;
      const fya = metrics.fiveYearAvgDividendYield;
      const curYield = metrics.dividendYield;
      const isAbove = curYield != null && curYield > fya;
      const comp = curYield != null
        ? isAbove
          ? ` Como a tua yield atual (${curYield.toFixed(2)}%) está acima desta média, a rentabilidade de dividendo está atualmente superior ao padrão histórico.`
          : ` Como a tua yield atual (${curYield.toFixed(2)}%) está abaixo desta média, o retorno em dividendos está temporariamente inferior ao habitual.`
        : '';
      const userContext = `A Yield média paga pela tua ação ${sym} nos últimos 5 anos foi de ${fya.toFixed(2)}%.${comp}`;

      const oppositeExample = isAbove
        ? `Cenário Oposto: Se a cotação da ação tivesse disparado nos últimos meses, a yield atual estaria abaixo da média histórica dos 5 anos, mostrando que a ação ficou mais cara face ao rendimento habitual.`
        : `Cenário Oposto: Se a cotação da ação tivesse caído por motivos temporários, o rendimento atual de dividendos subiria acima da média de 5 anos, abrindo uma oportunidade com rentabilidade acima do normal.`;

      return { userContext, oppositeExample };
    }

    case 'exDividendDate': {
      if (!metrics.exDividendDate) return null;
      const userContext = `A data ex-dividendo agendada para a ${sym} é ${metrics.exDividendDate}. Para teres direito ao próximo dividendo, deves deter a ação até ao encerramento do dia útil anterior.`;
      const oppositeExample = `Cenário Oposto: Se comprares a ação apenas um dia depois (na própria data ex-dividendo), o dinheiro desse trimestre vai para o vendedor antigo e terás de esperar pelo trimestre seguinte para ter direito a receber.`;

      return { userContext, oppositeExample };
    }

    case 'earningsDate': {
      if (!metrics.earningsDate) return null;
      const userContext = `A próxima apresentação de contas e lucros trimestrais da ${sym} está agendada para ${metrics.earningsDate}.`;
      const oppositeExample = `Cenário Oposto: Se a empresa divulgar números abaixo das estimativas dos analistas, a cotação pode sofrer uma descida brusca de 5% a 10% no próprio dia, mesmo que continue a ser uma excelente empresa a longo prazo.`;

      return { userContext, oppositeExample };
    }

    default:
      return null;
  }
}

