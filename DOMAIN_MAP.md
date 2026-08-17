# DOMAIN MAP

Este documento lista estritamente as entidades de negócio persistidas no banco e suas divisões conceituais ativas. 

Entidades "Hipotéticas" não devem ser desenhadas neste mapa até que se tornem um fato em migração.

## IDENTITY
- `users`: Registro central da sessão autenticada.

## TENANCY
- `organizations`: Root tenant node.
- `memberships`: Vínculos de função (role) entre User e Organization.
- `stores`: Node filho de uma organização, atua como Loja.
- `store_domains`: Domínios web customizados anexos à Store.

## CATALOG (Master Catalog)
- `master_products`: O SKU Pai original gerido pela Plataforma.
- `master_product_variants`: As variações do produto Pai.
- `suppliers`: Fornecedores do produto Master.

## INVENTORY (Central Inventory)
- `master_inventory`: Estado em tempo real do saldo de cada master_variant.
- `inventory_movements`: Log apendicular mutável de chegadas/reservas de estoque.

## COMMERCE (Commercial Offering / Distribution)
- `store_products`: Representação front-end de um Master Product na vitrine do Tenant.
- `store_product_variants`: Preço de venda comercial local para a variante mestre.
- `customers`: Consumidores amarrados à uma Organização (Store).

## ORDERS
- `carts`: Carrinho efêmero do customer/guest.
- `cart_items`: Itens selecionados e bloqueados comercialmente.
- `orders`: Confirmação da intenção de compra amarrando saldos.
- `order_items`: Desmembramento da Order em itens consumidos.

## SHIPPING
- `shipping_snapshots`: Fotografia imutável dos fretes calculados.

## FINANCE
- `financial_transactions`: Pagamentos, splits de gateway e faturas.

## AUDIT
- `audit_logs`: Tabela de gatilho para versionamento de metadados críticos.
