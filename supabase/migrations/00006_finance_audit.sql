-- 00006_FINANCE_AUDIT
CREATE TABLE financial_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    model_type text NOT NULL,
    config_payload jsonb NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT NOT NULL,
    provider text NOT NULL,
    gross_amount numeric(15,2) NOT NULL,
    net_amount numeric(15,2),
    gateway_fee numeric(15,2),
    currency char(3) DEFAULT 'BRL',
    status payment_status DEFAULT 'PENDING',
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid REFERENCES payments(id) ON DELETE RESTRICT NOT NULL,
    provider text NOT NULL,
    transaction_id_external text,
    idempotency_key text NOT NULL,
    type text NOT NULL,
    amount numeric(15,2) NOT NULL,
    status text NOT NULL,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(provider, idempotency_key)
);

CREATE TABLE merchant_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT NOT NULL,
    currency char(3) DEFAULT 'BRL',
    balance numeric(15,2) DEFAULT 0.00,
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE merchant_ledger_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_account_id uuid REFERENCES merchant_accounts(id) ON DELETE RESTRICT NOT NULL,
    entry_type ledger_entry_type NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency char(3) DEFAULT 'BRL',
    -- Idempotency constraint architecture fix
    source_transaction_id uuid NOT NULL,
    description text,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE(merchant_account_id, source_transaction_id)
);

CREATE TABLE domain_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Composite FK for tenant integrity
    store_id uuid,
    organization_id uuid,
    FOREIGN KEY (store_id, organization_id) REFERENCES stores(id, organization_id) ON DELETE CASCADE,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    provider text,
    idempotency_key text,
    processed_at timestamptz,
    created_at timestamptz DEFAULT NOW(),
    UNIQUE NULLS NOT DISTINCT (provider, idempotency_key)
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
    organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamptz DEFAULT NOW()
);

-- Trigger de Conta Corrente (Apenas soma saldos)
CREATE OR REPLACE FUNCTION update_merchant_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE merchant_accounts
    SET balance = balance + NEW.amount, updated_at = NOW()
    WHERE id = NEW.merchant_account_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_merchant_balance
AFTER INSERT ON merchant_ledger_entries
FOR EACH ROW EXECUTE PROCEDURE update_merchant_balance();
