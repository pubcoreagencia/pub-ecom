# BUSINESS MODEL

Este documento descreve exclusivamente o modelo de negócios operante no contexto da plataforma.

## A Dinâmica do Ecossistema
A PUB ECOM opera como o provedor e **Operador Central** do E-Commerce.
Os lojistas não mantêm operações de retaguarda, nem estoques, nem negociações com fornecedores.

### 1. PUB ECOM como Operador Central
- É proprietário do Catálogo Mestre.
- Coordena fornecedores.
- Realiza a gestão do estoque físico no "Central Inventory".
- Garante fulfillment, infraestrutura, estabilidade de dados e arranjos de pagamento.

### 2. Mentor / Representante Comercial
- Entra no sistema sob uma `organization` através do vínculo via `memberships`.
- Atua ativamente como uma superfície de vendas e marketing.
- O mentor não cadastra SKUs mestres nem interage com suppliers.

### 3. Store (Superfície de Distribuição)
- Trata-se do local onde os `store_products` são veiculados. 
- Cada Store é ancorada a uma Organização.
- Carrega URLs, Slugs, Status e SEO próprios daquela instância representativa.

### 4. Customer (Cliente Final)
- Clientes realizam compras na Store.
- O cliente interage com a "Vitrine do Representante", mas a transação do lado do banco flui atrelada de ponta a ponta.

### Gaps Intencionais (FUTURO)
**Aviso:** Atualmente não há infraestrutura modelada em código para comissões explícitas, repasses automáticos (splits complexos), metas de vendas ou rankings de performance de mentores. 
Futuras iterações de "Self-Service" para lojistas ou de "Financial Splits" poderão vir a existir, mas **não devem ser inferidas** neste snapshot.
