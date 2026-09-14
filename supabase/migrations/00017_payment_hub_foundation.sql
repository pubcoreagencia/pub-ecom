-- 00017_PAYMENT_HUB_FOUNDATION: MULTI-GATEWAY ARCHITECTURE & ATOMIC SETTLEMENT

-- ============================================================
-- 1. TABELA: gateway_providers (Catálogo de Provedores)
-- ============================================================
CREATE TABLE public.gateway_providers (
    id text PRIMARY KEY,
    display_name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Catálogo estrutural mantido sem providers operacionais na fundação
-- Provedores concretos serão homologados e ativados em migrations dedicadas futuras.

-- ============================================================
-- 2. TABELA: gateway_connections (Instâncias de Credenciais)
-- ============================================================
CREATE TABLE public.gateway_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
    store_id uuid NULL,
    provider_id text NOT NULL REFERENCES public.gateway_providers(id) ON DELETE RESTRICT,
    environment text NOT NULL CHECK (environment IN ('SANDBOX', 'PRODUCTION')),
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    is_global_default boolean NOT NULL DEFAULT false,
    encrypted_credentials text NOT NULL,
    webhook_secret_encrypted text NULL,
    public_key text NULL,
    metadata jsonb NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Integridade Multi-Tenant Composta de Loja
    FOREIGN KEY (store_id, organization_id) 
        REFERENCES public.stores(id, organization_id) 
        ON DELETE RESTRICT,

    -- Restrição de Escopos Válidos (GLOBAL vs ORGANIZATION vs STORE)
    CONSTRAINT chk_gateway_connection_scope CHECK (
        (organization_id IS NULL AND store_id IS NULL AND is_global_default = true)
        OR
        (organization_id IS NOT NULL AND store_id IS NULL AND is_global_default = false)
        OR
        (organization_id IS NOT NULL AND store_id IS NOT NULL AND is_global_default = false)
    )
);

-- Índices parciais de unicidade: no máximo 1 ACTIVE por scope/provider/environment
CREATE UNIQUE INDEX uq_gateway_conn_global_active 
ON public.gateway_connections (environment, provider_id) 
WHERE is_global_default = true AND status = 'ACTIVE';

CREATE UNIQUE INDEX uq_gateway_conn_org_active 
ON public.gateway_connections (organization_id, environment, provider_id) 
WHERE store_id IS NULL AND is_global_default = false AND status = 'ACTIVE';

CREATE UNIQUE INDEX uq_gateway_conn_store_active 
ON public.gateway_connections (store_id, environment, provider_id) 
WHERE store_id IS NOT NULL AND is_global_default = false AND status = 'ACTIVE';

-- ============================================================
-- 3. TABELA: gateway_webhook_events (Deduplicação e Auditoria)
-- ============================================================
CREATE TABLE public.gateway_webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_connection_id uuid NOT NULL REFERENCES public.gateway_connections(id) ON DELETE RESTRICT,
    event_dedup_key text NOT NULL,
    provider_resource_id text NOT NULL,
    event_type text NOT NULL,
    raw_payload jsonb NOT NULL,
    processing_status text NOT NULL DEFAULT 'PENDING' 
        CHECK (processing_status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED')),
    processing_error text NULL,
    received_at timestamptz DEFAULT now(),
    processed_at timestamptz NULL,

    CONSTRAINT uq_gateway_webhook_events_dedup UNIQUE (gateway_connection_id, event_dedup_key)
);

-- ============================================================
-- 4. MODIFICAÇÕES NA TABELA: payment_transactions
-- ============================================================
ALTER TABLE public.payment_transactions 
    ADD COLUMN gateway_connection_id uuid NOT NULL REFERENCES public.gateway_connections(id) ON DELETE RESTRICT,
    ADD COLUMN raw_response jsonb NULL,
    ADD COLUMN error_message text NULL,
    DROP CONSTRAINT payment_transactions_provider_idempotency_key_key,
    ADD CONSTRAINT uq_payment_transactions_connection_idempotency UNIQUE (gateway_connection_id, idempotency_key),
    ADD CONSTRAINT uq_payment_transactions_triplet UNIQUE (id, payment_id, gateway_connection_id);

-- Invariante de Concorrência: No máximo 1 transação em status PROCESSING por aggregate de pagamento
CREATE UNIQUE INDEX uq_payment_tx_single_processing
ON public.payment_transactions (payment_id)
WHERE status = 'PROCESSING';

-- ============================================================
-- 5. MODIFICAÇÕES NA TABELA: payments
-- ============================================================
ALTER TABLE public.payments 
    ADD COLUMN settled_gateway_connection_id uuid NULL REFERENCES public.gateway_connections(id) ON DELETE RESTRICT,
    ADD COLUMN settled_transaction_id uuid NULL,
    ADD COLUMN payment_method text NOT NULL DEFAULT 'PIX',
    ADD COLUMN payment_method_details jsonb NULL,
    ADD CONSTRAINT uq_payments_order_id UNIQUE (order_id),
    ADD CONSTRAINT chk_payments_settled_connection CHECK (
        (status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK') AND settled_gateway_connection_id IS NULL AND settled_transaction_id IS NULL)
        OR
        (status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK') AND settled_gateway_connection_id IS NOT NULL AND settled_transaction_id IS NOT NULL)
    ),
    ADD CONSTRAINT fk_payments_settled_winner_triplet 
        FOREIGN KEY (settled_transaction_id, id, settled_gateway_connection_id) 
        REFERENCES public.payment_transactions (id, payment_id, gateway_connection_id) 
        ON DELETE RESTRICT;

-- ============================================================
-- 6. ÍNDICES DE PERFORMANCE RELACIONAIS
-- ============================================================
CREATE INDEX idx_payments_order_id ON public.payments(order_id);
CREATE INDEX idx_payment_transactions_payment_id ON public.payment_transactions(payment_id);
CREATE INDEX idx_payment_transactions_connection_id ON public.payment_transactions(gateway_connection_id);
CREATE INDEX idx_payment_transactions_ext_id ON public.payment_transactions(gateway_connection_id, transaction_id_external);
CREATE INDEX idx_gateway_webhook_events_lookup ON public.gateway_webhook_events(gateway_connection_id, provider_resource_id);

-- ============================================================
-- 7. ATOMIC SETTLEMENT RPC (settle_payment_transaction)
-- ============================================================
CREATE OR REPLACE FUNCTION public.settle_payment_transaction(
    p_payment_id uuid,
    p_transaction_id uuid,
    p_connection_id uuid,
    p_transaction_id_external text,
    p_verified_amount numeric(15,2),
    p_verified_currency text,
    p_gateway_fee numeric(15,2),
    p_net_amount numeric(15,2),
    p_verified_outcome text -- 'SUCCESS' ou 'REJECTED'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment record;
    v_tx record;
    v_order record;
BEGIN
    -- 1. Bloqueio Transacional Ordenado (Prevenção de Deadlock: payments -> payment_transactions -> orders)
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND'; END IF;

    SELECT * INTO v_tx FROM public.payment_transactions WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'; END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = v_payment.order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

    -- 2. Integridade Estrutural do Vínculo
    IF v_tx.payment_id != v_payment.id THEN
        RAISE EXCEPTION 'TRANSACTION_PAYMENT_MISMATCH';
    END IF;

    IF v_tx.gateway_connection_id != p_connection_id THEN
        RAISE EXCEPTION 'TRANSACTION_CONNECTION_MISMATCH';
    END IF;

    -- 3. Validação da Máquina de Estados do Aggregate: Tentativa Vencedora é Imutável
    IF v_payment.status IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK') THEN
        IF p_verified_outcome = 'SUCCESS' AND v_payment.settled_transaction_id = p_transaction_id THEN
            -- Idempotência limpa da MESMA transação vencedora
            RETURN true;
        ELSE
            -- Rejeição explícita: transação diferente tentando sobrescrever ordem já liquidada
            RAISE EXCEPTION 'PAYMENT_ALREADY_SETTLED_BY_ANOTHER_TRANSACTION';
        END IF;
    END IF;

    -- 4. Validação Invariante Econômica
    IF p_verified_amount != v_payment.gross_amount OR p_verified_amount != v_order.total_amount THEN
        RAISE EXCEPTION 'PAYMENT_AMOUNT_MISMATCH';
    END IF;

    IF p_verified_currency != v_payment.currency OR p_verified_currency != v_order.currency THEN
        RAISE EXCEPTION 'PAYMENT_CURRENCY_MISMATCH';
    END IF;

    -- 5. Validação da Máquina de Estados da Transação: Somente PROCESSING pode avançar
    IF v_tx.status != 'PROCESSING' THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_IN_PROCESSING';
    END IF;

    -- 6. Execução Determinística do Desfecho
    IF p_verified_outcome = 'SUCCESS' THEN
        -- Atualiza a Transação Individual para SUCCESS
        UPDATE public.payment_transactions
        SET status = 'SUCCESS',
            transaction_id_external = p_transaction_id_external
        WHERE id = p_transaction_id;

        -- Consolida Aggregate de Pagamento
        UPDATE public.payments
        SET status = 'PAID',
            gateway_fee = p_gateway_fee,
            net_amount = p_net_amount,
            settled_gateway_connection_id = p_connection_id,
            settled_transaction_id = p_transaction_id,
            updated_at = NOW()
        WHERE id = p_payment_id;

        -- Transiciona Pedido para PAID
        UPDATE public.orders
        SET status = 'PAID',
            updated_at = NOW()
        WHERE id = v_payment.order_id;

        RETURN true;

    ELSIF p_verified_outcome = 'REJECTED' THEN
        -- Atualiza Transação Individual para FAILED
        UPDATE public.payment_transactions
        SET status = 'FAILED',
            transaction_id_external = p_transaction_id_external
        WHERE id = p_transaction_id;

        -- O aggregate passa para FAILED (retryable), ordem permanece PENDING_PAYMENT
        UPDATE public.payments
        SET status = 'FAILED',
            updated_at = NOW()
        WHERE id = p_payment_id;

        RETURN false;
    ELSE
        RAISE EXCEPTION 'INVALID_OUTCOME';
    END IF;
END;
$$;

-- ============================================================
-- 8. SEGURANÇA: RLS & GRANTS
-- ============================================================
ALTER TABLE public.gateway_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_webhook_events ENABLE ROW LEVEL SECURITY;

-- gateway_providers: Leitura para autenticados e acesso total para service_role
REVOKE ALL ON public.gateway_providers FROM PUBLIC;
REVOKE ALL ON public.gateway_providers FROM anon;
REVOKE ALL ON public.gateway_providers FROM authenticated;
GRANT SELECT ON public.gateway_providers TO authenticated;
GRANT ALL ON public.gateway_providers TO service_role;
CREATE POLICY "gp_sel_auth" ON public.gateway_providers FOR SELECT TO authenticated USING (is_active = true);

-- gateway_connections: Bloqueio total a anon/authenticated (Backend-Only Access)
REVOKE ALL ON public.gateway_connections FROM PUBLIC;
REVOKE ALL ON public.gateway_connections FROM anon;
REVOKE ALL ON public.gateway_connections FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gateway_connections TO service_role;

-- gateway_webhook_events: Restrito exclusivamente a service_role
REVOKE ALL ON public.gateway_webhook_events FROM PUBLIC;
REVOKE ALL ON public.gateway_webhook_events FROM anon;
REVOKE ALL ON public.gateway_webhook_events FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gateway_webhook_events TO service_role;

-- settle_payment_transaction: Execução restrita a service_role
REVOKE ALL ON FUNCTION public.settle_payment_transaction(uuid, uuid, uuid, text, numeric, text, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_payment_transaction(uuid, uuid, uuid, text, numeric, text, numeric, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.settle_payment_transaction(uuid, uuid, uuid, text, numeric, text, numeric, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment_transaction(uuid, uuid, uuid, text, numeric, text, numeric, numeric, text) TO service_role;
