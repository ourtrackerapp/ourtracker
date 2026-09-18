export interface MetricExplanation {
  name: string;
  simpleMeaning: string;
  example: string;
  howToInterpret: string;
}

export const FINANCIAL_METRIC_DICTIONARY: Record<string, MetricExplanation> = {
  // Valuation
  'P/E Ratio': {
    name: 'P/E Ratio (Preço sobre Lucro)',
    simpleMeaning: 'Indica quantos euros ou dólares os investidores estão a pagar no mercado por cada 1€ de lucro líquido anual gerado pela empresa.',
    example: 'Se a ação custa 100€ e o lucro por ação é 5€, o P/E é 20x (100 / 5). Significa que pagas 20€ por cada 1€ de lucro que a empresa gera.',
    howToInterpret: 'Um P/E mais baixo pode indicar que a ação está barata ou com problemas; um P/E mais elevado indica expectativas de forte crescimento futuro ou que a ação está cara face aos lucros atuais.',
  },
  'Forward P/E': {
    name: 'Forward P/E (P/E Projetado a 12 Meses)',
    simpleMeaning: 'Compara a cotação atual com o lucro por ação estimado pelos analistas para o próximo ano.',
    example: 'Se a ação custa 100€ e os analistas esperam que o lucro suba de 5€ para 8€ no próximo ano, o Forward P/E desce para 12.5x (100 / 8).',
    howToInterpret: 'Se o Forward P/E for significativamente inferior ao P/E atual, significa que o mercado espera que a empresa aumente fortemente os seus lucros no próximo exercício fiscal.',
  },
  'EV / EBITDA': {
    name: 'EV / EBITDA (Valor da Empresa / Lucro Operacional Bruto)',
    simpleMeaning: 'Mede o custo total para comprar a empresa inteira (incluindo pagar as suas dívidas e descontar o caixa) face ao caixa operacional que o negócio gera antes de juros, impostos e depreciações.',
    example: 'Uma empresa vale 10B$ em ações e tem 2B$ de dívida líquida (EV = 12B$). Se gera 2B$ de EBITDA por ano, o múltiplo é 6.0x (12B$ / 2B$). Em 6 anos de lucro operacional recuperarias o valor de aquisição.',
    howToInterpret: 'É excelente para comparar empresas com diferentes níveis de endividamento. Valores abaixo de 10x–12x costumam ser atrativos em setores maduros.',
  },
  'EV / FCF': {
    name: 'EV / FCF (Valor da Empresa / Fluxo de Caixa Livre)',
    simpleMeaning: 'Mede o valor total da empresa em relação ao dinheiro limpo que realmente sobra no bolso dos donos após todas as contas e investimentos pagos.',
    example: 'Se o Enterprise Value é 20B$ e a empresa gera 1B$ de FCF limpo no ano, o múltiplo é 20x.',
    howToInterpret: 'Quanto menor, mais geradora de caixa livre é a empresa em relação à sua dimensão financeira global.',
  },
  'Price / FCF': {
    name: 'Price / FCF (Preço sobre Fluxo de Caixa Livre)',
    simpleMeaning: 'Semelhante ao P/E, mas usa o dinheiro vivo (FCF) em vez do lucro contabilístico.',
    example: 'Se a capitalização de mercado é 50B$ e o FCF é 2.5B$, o Price/FCF é 20x.',
    howToInterpret: 'Muitos investidores preferem o Price/FCF ao P/E porque os lucros contabilísticos podem sofrer ajustes artificiais, enquanto o caixa livre é dinheiro real que entra na conta.',
  },
  'FCF Yield': {
    name: 'FCF Yield (Rendimento de Fluxo de Caixa Livre)',
    simpleMeaning: 'A percentagem de dinheiro vivo que a empresa gera em relação ao valor total das suas ações no mercado. É como a "rentabilidade de dividendo potencial máxima".',
    example: 'Se a empresa vale 100€ por ação e gera 5€ de FCF por ação, o FCF Yield é 5.0%. Se a empresa distribuísse todo o caixa livre aos acionistas, receberias 5% ao ano.',
    howToInterpret: 'Acima de 4% a 7% é habitualmente considerado um rendimento de caixa muito atrativo e saudável.',
  },
  'PEG Ratio': {
    name: 'PEG Ratio (P/E ajustado ao Crescimento de Lucros)',
    simpleMeaning: 'Divide o rácio P/E pela taxa de crescimento percentual anual dos lucros da empresa.',
    example: 'Se o P/E é 30x e a empresa cresce os lucros a 30% ao ano, o PEG é 1.0x (30 / 30). Se o P/E for 30x mas a empresa só cresce a 10%, o PEG sobe para 3.0x.',
    howToInterpret: 'Regra geral de Peter Lynch: PEG perto ou abaixo de 1.0x indica que estás a pagar um preço muito justo pelo crescimento; acima de 2.0x sugere que o crescimento já está caro.',
  },
  'Price to Sales': {
    name: 'P/S (Preço sobre Vendas)',
    simpleMeaning: 'Indica quantos euros pagas por cada 1€ de faturação bruta da empresa.',
    example: 'Se a empresa fatura 10B$ e vale 30B$ em bolsa, o P/S é 3.0x.',
    howToInterpret: 'Útil para empresas que ainda não dão lucro líquido mas estão a expandir rapidamente as suas receitas.',
  },
  'Historical P/E Average (5Y)': {
    name: 'Média Histórica do P/E (5 Anos)',
    simpleMeaning: 'A média a que os investidores avaliaram as ações desta empresa nos últimos 5 anos de negociação.',
    example: 'Se a média de 5 anos foi 25x e hoje a ação está a 18x com fundamentos intactos, o mercado está a negociar a ação com desconto face ao padrão histórico.',
    howToInterpret: 'Ajuda a perceber se a cotação atual está esticada ou com desconto relativo à sua própria história secular.',
  },

  // Growth
  'Revenue CAGR 5Y': {
    name: 'Revenue CAGR 5Y (Crescimento Composto de Receitas a 5 Anos)',
    simpleMeaning: 'A taxa anual média de crescimento das vendas da empresa ao longo de 5 anos consecutivos.',
    example: 'Uma empresa que faturava 100M€ há 5 anos e agora fatura 161M€ cresceu a uma taxa composta (CAGR) de 10.0% ao ano.',
    howToInterpret: 'Mostra a consistência da expansão comercial da empresa ao longo dos ciclos económicos.',
  },
  'EPS CAGR 5Y': {
    name: 'EPS CAGR 5Y (Crescimento de Lucro por Ação a 5 Anos)',
    simpleMeaning: 'A taxa média anual composta a que o lucro líquido de cada ação individual cresceu nos últimos 5 anos.',
    example: 'Se o lucro por ação subiu de 1.00€ para 2.00€ em 5 anos, o EPS CAGR é cerca de 14.9% ao ano.',
    howToInterpret: 'Crescimento sustentado de EPS é o principal motor de valorização das ações no longo prazo.',
  },
  'FCF CAGR 5Y': {
    name: 'FCF CAGR 5Y (Crescimento de Fluxo de Caixa Livre a 5 Anos)',
    simpleMeaning: 'A taxa média anual a que o dinheiro vivo gerado pelo negócio aumentou nos últimos 5 anos.',
    example: 'Se o FCF passou de 500M$ para 900M$ em 5 anos, o FCF CAGR foi de aproximadamente 12.5% ao ano.',
    howToInterpret: 'Confirma se o crescimento do negócio se está a traduzir em mais dinheiro real no cofre.',
  },

  // Profitability
  'Gross Margin': {
    name: 'Gross Margin (Margem Bruta)',
    simpleMeaning: 'A percentagem de receita que sobra após subtrair apenas os custos diretos de fabricar o produto ou prestar o serviço (COGS).',
    example: 'Vendes um software por 100€ e gastas 30€ em servidores/licenças diretas. A margem bruta é de 70% (70€ / 100€).',
    howToInterpret: 'Margens brutas altas (> 50%–70%) indicam forte poder de fixação de preços (Pricing Power) e vantagem competitiva contra concorrentes.',
  },
  'Operating Margin': {
    name: 'Operating Margin (Margem Operacional)',
    simpleMeaning: 'O lucro gerado pela operação central da empresa (EBIT) como percentagem das receitas, após pagar salários, marketing e I&D, antes de juros da dívida e impostos.',
    example: 'Faturas 100M€ e, após pagar todos os custos operacionais (fábricas, salários, desenvolvimento), sobram 25M€. A margem operacional é 25%.',
    howToInterpret: 'Mede a eficiência pura do modelo de negócio. Empresas de topo operam frequentemente acima de 15% a 30%.',
  },
  'Net Margin': {
    name: 'Net Margin (Margem Líquida)',
    simpleMeaning: 'A fatia final das vendas que chega ao lucro líquido (fundo do funil) após pagar fornecedores, trabalhadores, juros bancários e impostos ao Estado.',
    example: 'Se a empresa fatura 1,000€ e o lucro líquido final é 150€, a margem líquida é 15%.',
    howToInterpret: 'Mostra quanto dinheiro limpo a empresa retém por cada euro faturado.',
  },
  'ROE': {
    name: 'ROE (Return on Equity - Retorno sobre o Capital Próprio)',
    simpleMeaning: 'Mede quantos euros de lucro a empresa gera por cada 100€ de capital investido pelos próprios acionistas.',
    example: 'Se os acionistas têm 1,000M€ de capital na empresa e ela lucra 200M€ no ano, o ROE é 20% (200 / 1000).',
    howToInterpret: 'Valores acima de 15%–20% indicam excelente capacidade de rentabilizar o dinheiro dos investidores.',
  },
  'ROIC': {
    name: 'ROIC (Return on Invested Capital - Retorno sobre o Capital Investido)',
    simpleMeaning: 'A métrica rainha de Warren Buffett: mede a rentabilidade do dinheiro total colocado no negócio (tanto dos acionistas como de empréstimos bancários).',
    example: 'Se a empresa investiu 10M€ em fábricas e tecnologia (entre capital próprio e dívida) e gera 2M€ de lucro operacional após impostos, o ROIC é 20%.',
    howToInterpret: 'Se o ROIC for superior ao custo do dinheiro (WACC, ex.: 8%), a empresa está a criar riqueza real contínua. Se for inferior, está a destruir valor.',
  },
  'ROA': {
    name: 'ROA (Return on Assets - Retorno sobre os Ativos)',
    simpleMeaning: 'Mede a eficiência com que a empresa usa todos os seus ativos físicos e intangíveis (fábricas, inventário, patentes, caixa) para gerar lucros.',
    example: 'Uma empresa com 50M€ em ativos totais que lucra 5M€ tem um ROA de 10%.',
    howToInterpret: 'Valores acima de 7%–10% são muito sólidos, especialmente em empresas com poucos ativos físicos (Asset-Light).',
  },

  // Cash Flow
  'Free Cash Flow': {
    name: 'Free Cash Flow (FCF - Fluxo de Caixa Livre)',
    simpleMeaning: 'O dinheiro real e palpável que sobra na conta bancária da empresa depois de pagar todas as despesas diárias e todos os investimentos em novos equipamentos ou tecnologia (Capex).',
    example: 'A empresa recebeu 10M€ em caixa dos clientes, gastou 6M€ a operar e 1M€ em novos computadores. Sobraram 3M€ limpos de FCF para recomprar ações, pagar dividendos ou guardar.',
    howToInterpret: 'É o oxigénio de uma empresa. Uma empresa com lucros contabilísticos mas FCF negativo constante corre sérios riscos de liquidez.',
  },
  'FCF Margin': {
    name: 'FCF Margin (Margem de Fluxo de Caixa Livre)',
    simpleMeaning: 'A percentagem de cada euro de venda que se converte diretamente em dinheiro vivo limpo.',
    example: 'Se faturas 100€ e geras 20€ de FCF, a margem de FCF é de 20%.',
    howToInterpret: 'Margens de FCF superiores a 15%–20% colocam a empresa no escalão superior de máquinas de geração de capital.',
  },
  'Cash Conversion Rate': {
    name: 'Taxa de Conversão de Lucro em Caixa',
    simpleMeaning: 'Indica que percentagem do lucro contabilístico reportado se transforma de facto em dinheiro vivo no banco.',
    example: 'Se a empresa reporta 100M€ de lucro líquido e gera 95M€ de FCF, a taxa de conversão é 95%.',
    howToInterpret: 'Valores próximos ou superiores a 85%–100% comprovam que a contabilidade é limpa e não inflacionada por faturas não pagas.',
  },

  // Debt & Balance Sheet
  'Cash & Equivalents': {
    name: 'Caixa e Equivalentes de Caixa',
    simpleMeaning: 'O montante total de dinheiro disponível imediatamente no banco ou em depósitos/obrigações soberanas de curtíssimo prazo.',
    example: 'A Apple tem cerca de 60B$ em caixa e títulos líquidos disponíveis para emergências ou compras estratégicas.',
    howToInterpret: 'Garante que a empresa sobrevive a crises, recessões e subidas abruptas de taxas de juro sem precisar de resgates.',
  },
  'Net Debt / EBITDA': {
    name: 'Net Debt / EBITDA (Dívida Líquida sobre Lucro Operacional)',
    simpleMeaning: 'Indica quantos anos seriam necessários para a empresa pagar toda a sua dívida líquida (Dívida Total menos o Caixa), usando o seu EBITDA atual.',
    example: 'A empresa tem 300M€ de dívida e 100M€ em caixa (Dívida Líquida = 200M€). Se gera 100M€ de EBITDA por ano, o rácio é 2.0x (200 / 100). Em 2 anos liquidaria a dívida toda.',
    howToInterpret: 'Abaixo de 2.0x–2.5x é considerado saudável e seguro; acima de 3.5x–4.0x acende sinais de alerta sobre risco de endividamento e encargos de juros.',
  },
  'Interest Coverage': {
    name: 'Interest Coverage (Cobertura de Juros da Dívida)',
    simpleMeaning: 'Mede quantas vezes o lucro operacional da empresa (EBIT) consegue pagar os juros anuais dos empréstimos bancários.',
    example: 'Se a empresa ganha 100M€ de lucro operacional e paga 10M€ de juros ao banco no ano, a cobertura é de 10.0x.',
    howToInterpret: 'Acima de 5x a 8x oferece grande tranquilidade; abaixo de 2.5x–3.0x a empresa fica vulnerável se as receitas caírem.',
  },
  'Shares Outstanding (5Y Change)': {
    name: 'Evolução de Ações em Circulação a 5 Anos (Diluição vs Recompras)',
    simpleMeaning: 'Mostra se a empresa reduziu o número de ações (através de recompras benéficas) ou se emitiu novas ações (diluindo a percentagem dos acionistas).',
    example: 'Se a empresa tinha 100 milhões de ações e recomprou 10 milhões, restam 90 milhões (-10%). Cada ação passa a ter direito a uma fatia maior dos lucros futuros.',
    howToInterpret: 'Variações negativas (-%) significam recompras líquidas que aumentam o teu valor por ação; variações positivas (+%) mostram diluição que pode prejudicar o investidor.',
  },

  // DCF & Valuation Model
  'DCF Base Case': {
    name: 'DCF Base Case (Valor Intrínseco pelo Fluxo de Caixa Descontado)',
    simpleMeaning: 'O valor real estimado de cada ação hoje, calculado somando todo o dinheiro vivo que a empresa vai gerar no futuro e trazendo esse dinheiro para o valor do presente.',
    example: 'Se o modelo DCF calcula que todo o dinheiro futuro da empresa trazido para hoje vale 200€ por ação e ela transaciona a 150€ em bolsa, existe uma margem de segurança de 33% (upside de +33%).',
    howToInterpret: 'Compara o preço de mercado com o valor económico real da empresa baseado na sua capacidade comprovada de gerar caixa.',
  },
  'WACC': {
    name: 'WACC (Weighted Average Cost of Capital - Custo Médio Ponderado de Capital)',
    simpleMeaning: 'A taxa mínima de retorno que a empresa tem de gerar para compensar o risco exigido pelos credores (dívida) e pelos acionistas (capital próprio). É a taxa de desconto usada para trazer os fluxos de caixa futuros para o presente.',
    example: 'Se o WACC é 8.5%, 100€ que a empresa vá receber daqui a 1 ano valem hoje 92.17€ (100 / 1.085).',
    howToInterpret: 'Quanto mais arriscado ou volátil for o negócio, maior é o WACC e menor será o valor intrínseco resultante.',
  },
  'Beta': {
    name: 'Beta (Volatilidade face ao Mercado Geral)',
    simpleMeaning: 'Mede quanto a cotação desta ação oscila em comparação com o índice de mercado geral (ex.: S&P 500, cujo Beta é 1.0).',
    example: 'Um Beta de 1.5 significa que se o mercado subir 10%, a ação tende historicamente a subir 15%; mas se o mercado cair 10%, a ação tende a cair 15%. Um Beta de 0.6 oscila muito menos que o mercado.',
    howToInterpret: 'Betas acima de 1.3 indicam ações de maior volatilidade e sensibilidade ao ciclo; Betas abaixo de 0.9 indicam ativos mais defensivos e estáveis.',
  },
};

/**
 * Função de procura flexível para mapear nomes de métricas nos cartões para o dicionário explicativo
 */
export function getMetricExplanation(metricKeyOrName: string): MetricExplanation | null {
  if (!metricKeyOrName) return null;
  const clean = metricKeyOrName.trim();

  if (FINANCIAL_METRIC_DICTIONARY[clean]) {
    return FINANCIAL_METRIC_DICTIONARY[clean];
  }

  const lower = clean.toLowerCase();
  for (const [key, explanation] of Object.entries(FINANCIAL_METRIC_DICTIONARY)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return explanation;
    }
  }

  if (lower.includes('pe') || lower.includes('p/e')) return FINANCIAL_METRIC_DICTIONARY['P/E Ratio'];
  if (lower.includes('forward')) return FINANCIAL_METRIC_DICTIONARY['Forward P/E'];
  if (lower.includes('ebitda')) return FINANCIAL_METRIC_DICTIONARY['EV / EBITDA'];
  if (lower.includes('fcf yield') || lower.includes('yield')) return FINANCIAL_METRIC_DICTIONARY['FCF Yield'];
  if (lower.includes('free cash') || lower.includes('fcf')) return FINANCIAL_METRIC_DICTIONARY['Free Cash Flow'];
  if (lower.includes('gross') || lower.includes('bruta')) return FINANCIAL_METRIC_DICTIONARY['Gross Margin'];
  if (lower.includes('operating') || lower.includes('operacional')) return FINANCIAL_METRIC_DICTIONARY['Operating Margin'];
  if (lower.includes('net margin') || lower.includes('líquida')) return FINANCIAL_METRIC_DICTIONARY['Net Margin'];
  if (lower.includes('roe')) return FINANCIAL_METRIC_DICTIONARY['ROE'];
  if (lower.includes('roic')) return FINANCIAL_METRIC_DICTIONARY['ROIC'];
  if (lower.includes('roa')) return FINANCIAL_METRIC_DICTIONARY['ROA'];
  if (lower.includes('debt') || lower.includes('dívida')) return FINANCIAL_METRIC_DICTIONARY['Net Debt / EBITDA'];
  if (lower.includes('interest') || lower.includes('juros')) return FINANCIAL_METRIC_DICTIONARY['Interest Coverage'];
  if (lower.includes('revenue') || lower.includes('receita') || lower.includes('cagr')) return FINANCIAL_METRIC_DICTIONARY['Revenue CAGR 5Y'];
  if (lower.includes('eps')) return FINANCIAL_METRIC_DICTIONARY['EPS CAGR 5Y'];
  if (lower.includes('dcf') || lower.includes('intrínseco') || lower.includes('intrinsico')) return FINANCIAL_METRIC_DICTIONARY['DCF Base Case'];
  if (lower.includes('wacc')) return FINANCIAL_METRIC_DICTIONARY['WACC'];
  if (lower.includes('beta')) return FINANCIAL_METRIC_DICTIONARY['Beta'];
  if (lower.includes('ações') || lower.includes('diluição') || lower.includes('shares')) return FINANCIAL_METRIC_DICTIONARY['Shares Outstanding (5Y Change)'];
  if (lower.includes('caixa') || lower.includes('cash')) return FINANCIAL_METRIC_DICTIONARY['Cash & Equivalents'];

  return {
    name: clean,
    simpleMeaning: `Métrica fundamentalista usada para avaliar a saúde financeira, rentabilidade operacional ou valuation de ${clean}.`,
    example: `Valores consistentes ao longo dos trimestres demonstram estabilidade e previsibilidade no modelo de negócio.`,
    howToInterpret: `Deve ser comparada com a média histórica da empresa e com os principais concorrentes do mesmo setor.`,
  };
}
