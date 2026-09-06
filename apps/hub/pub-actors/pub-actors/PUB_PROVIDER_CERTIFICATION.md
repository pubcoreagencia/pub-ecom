# PUB Provider Certification Matrix

Este documento rastreia o nível oficial de certificação e prontidão técnica de cada fonte de dados e provedor de extração do ecossistema PUB.

---

## 📊 Matriz Oficial de Certificação

| Provedor / Marketplace | Status Oficial | Método de Extração | Dados Reais Comprovados | Custo Médio | Bloqueio / Limitação |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **Google Maps (`google-maps-leads`)** | 🟢 **LIVE_PROVEN** | Playwright + Apify Proxy BR | ✅ **SIM** | `$0.0020` / busca | Totalmente funcional com extração de leads reais (nome, telefone, rating, coordenadas, placeId). |
| **Generic E-commerce (`generic-opengraph`)** | 🟢 **LIVE_PROVEN** | HTTP / JSON-LD / OpenGraph | ✅ **SIM** | `$0.0001` / produto | Rápido e universal para lojas abertas e catálogos e-commerce. |
| **Mercado Livre (`mercadolivre-core`)** | 🛑 **BLOCKED** | SSR / API Pública / Playwright | ❌ **NÃO** | `$0.0011` / run | Web redireciona para `/gz/account-verification`. API oficial exige OAuth App (`PolicyAgent 403`). |
| **Shopee Brasil (`shopee-core`)** | 🛑 **BLOCKED** | Playwright Stealth / Residencial | ❌ **NÃO** | `$0.0049` / run | Redirecionamento de borda TLS/JA4 para `/verify/traffic/error?type=4`. |
| **Amazon Brasil (`amazon-core`)** | 🟡 **EXPERIMENTAL** | SSR / HTML Parser | ⚠️ **CONDICIONAL** | `$0.0001` / run | Sujeito a desafios de CAPTCHA quando sem rotação de IPs. |
| **TikTok Shop (`tiktokshop-core`)** | 🟡 **EXPERIMENTAL** | Hydration Data / Official API | ⚠️ **EXPERIMENTAL** | `$0.0000` *(API)* / `$0.0001` *(Web)* | Web entrega shell SPA; API Oficial exige Seller OAuth ou Partner Affiliate. |

---

## 📱 TikTok Shop — Investigação Oficial da Open API (Fase 11)

### 1. Documentação Oficial Consultada
* **Portal de Desenvolvedores / Parceiros**: `https://partner.tiktokshop.com` / `https://developer.tiktokshop.com`
* **Especificação de Produtos (v202309 / v202407)**: Endpoints `/product/202309/products/{product_id}` e `/product/202309/products/search`.
* **Affiliate Open Platform API**: `/affiliate/202405/products/{product_id}` e `/affiliate_partner/202409/products/search`.

### 2. Requisitos de Autenticação e Modelo de Autorização
* **Partner App**: Exige registro de empresa aprovado no TikTok Shop Partner Center, declaração de uso e seleção de categoria de App (Custom App ou Public App).
* **Autenticação Seller-Scoped**: Todos os endpoints de produtos da Seller API exigem dois parâmetros obrigatórios:
  1. `x-tts-access-token`: Token OAuth2 emitido após consentimento explícito do lojista proprietário do produto.
  2. `shop_cipher`: Identificador criptográfico da loja autorizada obtido via `/authorization/202309/shops`.
* **Consulta de Produtos de Terceiros sem Autorização**: **NÃO PERMITIDA** na Seller Open API. A Seller API foi desenhada exclusivamente para ERPs e integradores gerenciarem o inventário da própria loja parceira.

### 3. Endpoints Relevantes de Produto
* `GET /product/202309/products/{product_id}`: Retorna `title`, `description`, `main_images`, `skus` (variantes, atributos de venda, preços de custo/tabela), `category_list`, `brand`, `package_dimensions_and_weight`.
* `POST /product/202309/products/search`: Busca paginada de produtos cadastrados na loja autorizada.
* `GET /affiliate/202405/products/{product_id}`: Retorna dados de vitrine pública para parceiros de afiliados homologados.

### 4. Regiões, Taxas e Sandbox
* **Mercados Suportados**: Estados Unidos (US), Reino Unido (UK), Sudeste Asiático (ID, MY, TH, VN, PH, SG), México (MX). Brasil (BR) em fase de expansão/piloto.
* **Custos da API**: Gratuita para parceiros homologados.
* **Rate Limits**: 5 a 20 QPS por endpoint com base na classificação do App.
* **Ambiente de Testes**: Partner Center oferece Sandbox Shops com dados simulados.

### 5. Conclusão & Decisão GO / NO-GO

| Rota Técnica | Decisão | Justificativa Técnica |
| :--- | :---: | :--- |
| **Seller Open API (Lojas Próprias/Autorizadas)** | 🟢 **GO (Adapter Pronto)** | Excelente para conectar lojas sob gestão direta da PUB via `TikTokShopOfficialProvider`. |
| **Importação de URLs de Terceiros Arbitrárias via Seller API** | 🛑 **NO-GO** | A política de segurança da TikTok Shop Open API bloqueia consultas anônimas sem o consentimento OAuth do vendedor (`shop_cipher`). |
| **Affiliate Open API (Vitrine Pública)** | 🟡 **EXPERIMENTAL** | Viável a longo prazo mediante homologação de conta TikTok Shop Affiliate Partner. |

---

## 🧪 Auditoria de Homologação Web TikTok Shop (Fase 10)

| URL Testada | Status HTTP | URL Final | Dados Extraídos | Campos Ausentes | Duração | Custo | Diagnóstico |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| `shop.tiktok.com/view/product/1729482910485729104` | `200 OK` | Mesma URL | `productId` | `title`, `price`, `images`, `description` | 470ms | $0.0001 | Shell SSR sem hidratação inline de dados de produto. |
| `www.tiktok.com/view/product/1729584729104857291` | `200 OK` | Mesma URL | `productId` | `title`, `price`, `images`, `description` | 395ms | $0.0001 | Metatags OpenGraph ausentes na rota estática. |
| `shop.tiktok.com/view/product/1729683920194857291` | `200 OK` | Mesma URL | `productId` | `title`, `price`, `images`, `description` | 406ms | $0.0001 | Resposta sem bloqueio, porém dados profundos pendentes. |

---

## 🏷️ Definição dos Níveis de Certificação

* **`LIVE_PROVEN`**: O provedor extraiu dados reais comprovados em múltiplas execuções reais, com preços, imagens e identificadores consistentes, aprovados em testes unitários e de integração de ponta a ponta sem qualquer mock.
* **`EXPERIMENTAL`**: A arquitetura do provedor e os schemas estão 100% implementados e testados unitariamente, mas dependem de validação empírica em ambientes de produção com pools de proxies específicos.
* **`BLOCKED`**: O marketplace impõe barreiras de borda ativas (TLS fingerprinting, redirecionamentos forçados ou CAPTCHAs intransponíveis sem unblockers comerciais dedicados).
* **`NOT_IMPLEMENTED`**: Provedor mapeado no roadmap, mas ainda sem código implementado.

---

## 🔒 Regras de Segurança e Tolerância Zero a Mocks

1. **Nenhum Mock em Produção**: Qualquer item marcado com `_mock: true` ou contendo dados sintéticos é sumariamente rejeitado pelo `CanonicalNormalizer`.
2. **Isolamento Total**: O frontend nunca recebe chaves de API nem segredos. Toda a comunicação ocorre via backend com o contrato unificado `PubEcomProduct`.
