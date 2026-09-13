# BUSINESS MODEL

Este documento descreve o modelo comercial e operacional da PUB ECOM.

## 1. PUB ECOM como Operador Central

A PUB ECOM não atua como um SaaS passivo de lojas independentes. Ela opera a cadeia central de comércio.

Responsabilidades da PUB ECOM:
- catálogo mestre;
- relacionamento e operação com fornecedores;
- estoque/abastecimento central;
- tecnologia e infraestrutura;
- checkout e pagamentos;
- tracking e atribuição;
- aquisição e remarketing;
- operação de pedidos;
- fulfillment e acompanhamento de entrega;
- financeiro operacional;
- programas de afiliados e creators.

Quando um cliente compra em uma Store, o MASTER identifica a loja, produto e fornecedor. A PUB ECOM executa a compra operacional junto ao fornecedor e encaminha os dados necessários para que o produto seja entregue ao cliente final.

## 2. Mentor / Lojista

O mentorado opera uma Store como sua superfície comercial.

Responsabilidades:
- divulgar e operar a loja;
- acompanhar catálogo, preços e pedidos da sua superfície;
- desenvolver aquisição e vendas quando aplicável.

Não é necessário que o mentorado:
- mantenha estoque físico próprio;
- negocie diretamente com fornecedores;
- execute o fulfillment da cadeia central.

## 3. Store

A Store é a superfície comercial onde o cliente compra.

Ela possui:
- identidade e domínio/slug;
- catálogo comercial derivado do catálogo mestre;
- preços e ofertas;
- páginas de produtos;
- SEO próprio dentro das regras da plataforma;
- carrinho, checkout e pedidos.

## 4. Cliente Final

O cliente compra na Store e é o destinatário final do fulfillment.

A plataforma preserva a relação entre cliente, sessão, produto, loja, origem de aquisição e pedido para fins de operação e atribuição.

## 5. Fornecedor

O fornecedor é uma parte operacional da cadeia central.

Recebe da PUB ECOM as solicitações de compra/fulfillment e atualiza:
- disponibilidade;
- processamento;
- envio;
- rastreio;
- status de entrega.

O fornecedor não precisa conhecer a estrutura comercial do mentorado além do necessário para executar a operação.

## 6. Funil de Aquisição

A PUB ECOM trabalha com um funil unificado:

1. Page View
2. Add to Cart
3. Add Payment Info
4. Purchase

Cada etapa gera públicos personalizados de remarketing e pode ser segmentada por loja, produto, campanha, afiliado, influencer e origem UTM.

Purchase muda o objetivo para retenção, recompra, cross-sell e upsell.

## 7. Afiliados

Afiliados são parceiros de performance.

Modelo:
- não existe pagamento fixo pelo trabalho na regra-base;
- o afiliado recebe um link/código de atribuição;
- vendas atribuídas geram comissão percentual;
- a porcentagem é configurável por regra comercial;
- cliques, carrinhos, checkouts, vendas e comissões ficam disponíveis no painel do afiliado.

## 8. Influencers / Creators

Influencers são parceiros de performance com distribuição própria por audiência e produção de conteúdo.

Modelo-base definido pela PUB ECOM:
- não existe pagamento fixo pelo trabalho;
- vendas são atribuídas por link, código ou mecanismo equivalente;
- o influencer recebe **50% do lucro líquido** gerado pelas vendas atribuídas, sujeito ao acordo comercial ativo.

Cálculo:

`Venda Bruta - Custo do Produto - Frete - Taxas de Pagamento - Reembolsos - Descontos - Outros Custos Dedutíveis = Lucro Líquido`

`Repasse do Influencer = Lucro Líquido × Participação do Influencer`

O percentual deve ser armazenado como regra configurável, mesmo que 50% seja o padrão comercial atual.

## 9. Central Financeira

O MASTER consolida o desempenho das Stores.

Indicadores:
- lojas cadastradas;
- faturamento total;
- faturamento por loja;
- pedidos por loja;
- ticket médio;
- custo de produto;
- frete;
- taxas;
- descontos/reembolsos;
- resultado operacional;
- comissões de afiliados;
- repasses de influencers.

A Central Financeira é uma visão operacional. Liquidação contábil e pagamentos efetivos devem seguir o ledger/transações e as regras financeiras implementadas.

## 10. Rankings e Incentivos

### Ranking de Stores
Ranking mensal configurável por:
- faturamento;
- pedidos;
- conversão;
- crescimento;
- qualidade operacional.

### Ranking de Afiliados
Ranking por vendas atribuídas, receita, pedidos e comissão.

### Ranking de Influencers
Ranking por vendas atribuídas, lucro líquido gerado e repasse.

### Premiações
O MASTER poderá configurar:
- premiação mensal de Stores;
- campanhas temporárias;
- metas;
- bônus;
- regras de pontuação.

## 11. Live Shop

O MASTER terá uma visão em tempo real da atividade comercial:
- visitantes online;
- produtos visualizados;
- carrinhos abertos;
- checkouts ativos;
- vendas simultâneas;
- faturamento em tempo real;
- feed de pedidos;
- loja responsável pela venda.

## 12. Ads, SEO e Remarketing

A PUB ECOM deve centralizar a aquisição em uma camada de tracking própria e provider-neutral.

Integrações-alvo:
- Meta Ads / Pixel;
- Google Ads;
- Google Merchant Center;
- Meta Catalog;
- UTMify-compatible tracking;
- SEO e indexação de produtos;
- gateways de pagamento.

O catálogo mestre alimenta páginas de produto, sitemap e feeds de catálogo.

## 13. Checkout e Pagamentos

O checkout deve ser transparente e preservar atribuição/UTMs até a confirmação da venda.

A camada de pagamento deve abstrair gateways para evitar acoplamento com um único provedor.

A confirmação de `purchase` deve depender do estado de pagamento autoritativo, normalmente via webhook/server-side confirmation.

## 14. Princípio Econômico Central

Toda venda deve conectar:

`Cliente → Store → Produto → Origem → Afiliado/Influencer → Pedido → Pagamento → Custos → Lucro → Comissão/Repasse → Fornecedor → Fulfillment`

Isso permite à PUB ECOM operar o comércio como uma cadeia única, mensurável e escalável.

## 15. Gaps de Implementação

Este documento define o modelo de produto. A existência do modelo não significa que todas as capacidades estejam implementadas no código atual.

A implementação deve evoluir sobre a fundação congelada 00001-00015, usando novas migrations a partir de `00016` quando persistência adicional for necessária.
