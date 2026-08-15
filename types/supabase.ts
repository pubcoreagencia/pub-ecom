export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string | null
          customer_id: string | null
          guest_token_hash: string | null
          id: string
          status: string | null
          store_id: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          guest_token_hash?: string | null
          id?: string
          status?: string | null
          store_id: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          guest_token_hash?: string | null
          id?: string
          status?: string | null
          store_id?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          cart_id: string
          created_at: string | null
          id: string
          status: string | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string | null
          id?: string
          status?: string | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string | null
          id?: string
          status?: string | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_cart_id_store_id_fkey"
            columns: ["cart_id", "store_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          document: string | null
          email: string
          full_name: string | null
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          document?: string | null
          email: string
          full_name?: string | null
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          document?: string | null
          email?: string
          full_name?: string | null
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          created_at: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          organization_id: string | null
          payload: Json
          processed_at: string | null
          provider: string | null
          store_id: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          created_at?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          organization_id?: string | null
          payload: Json
          processed_at?: string | null
          provider?: string | null
          store_id?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          created_at?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_store_id_organization_id_fkey"
            columns: ["store_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      financial_models: {
        Row: {
          config_payload: Json
          created_at: string | null
          id: string
          model_type: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          config_payload: Json
          created_at?: string | null
          id?: string
          model_type: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          config_payload?: Json
          created_at?: string | null
          id?: string
          model_type?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_models_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillments: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          provider: string
          status: Database["public"]["Enums"]["fulfillment_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          provider: string
          status?: Database["public"]["Enums"]["fulfillment_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["fulfillment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          id: string
          master_variant_id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          master_variant_id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          master_variant_id?: string
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_master_variant_id_fkey"
            columns: ["master_variant_id"]
            isOneToOne: false
            referencedRelation: "master_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          checkout_id: string
          created_at: string | null
          expires_at: string
          id: string
          master_variant_id: string
          quantity: number
          released_at: string | null
          status: Database["public"]["Enums"]["reservation_status"] | null
        }
        Insert: {
          checkout_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          master_variant_id: string
          quantity: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
        }
        Update: {
          checkout_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          master_variant_id?: string
          quantity?: number
          released_at?: string | null
          status?: Database["public"]["Enums"]["reservation_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_master_variant_id_fkey"
            columns: ["master_variant_id"]
            isOneToOne: false
            referencedRelation: "master_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_inventory: {
        Row: {
          committed: number
          id: string
          master_variant_id: string | null
          on_hand: number
          reserved: number
          updated_at: string | null
        }
        Insert: {
          committed?: number
          id?: string
          master_variant_id?: string | null
          on_hand?: number
          reserved?: number
          updated_at?: string | null
        }
        Update: {
          committed?: number
          id?: string
          master_variant_id?: string | null
          on_hand?: number
          reserved?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_inventory_master_variant_id_fkey"
            columns: ["master_variant_id"]
            isOneToOne: true
            referencedRelation: "master_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      master_product_variants: {
        Row: {
          cost_price: number
          created_at: string | null
          id: string
          master_product_id: string | null
          sku: string
          updated_at: string | null
          weight_grams: number | null
        }
        Insert: {
          cost_price?: number
          created_at?: string | null
          id?: string
          master_product_id?: string | null
          sku: string
          updated_at?: string | null
          weight_grams?: number | null
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          id?: string
          master_product_id?: string | null
          sku?: string
          updated_at?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "master_product_variants_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
        ]
      }
      master_products: {
        Row: {
          base_sku: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          status: string | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          base_sku: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          base_sku?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_accounts: {
        Row: {
          balance: number | null
          created_at: string | null
          currency: string | null
          id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_ledger_entries: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          merchant_account_id: string
          source_transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          merchant_account_id: string
          source_transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          merchant_account_id?: string
          source_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_ledger_entries_merchant_account_id_fkey"
            columns: ["merchant_account_id"]
            isOneToOne: false
            referencedRelation: "merchant_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addresses: {
        Row: {
          city: string
          complement: string | null
          country: string | null
          created_at: string | null
          id: string
          neighborhood: string | null
          number: string
          order_id: string
          phone: string | null
          postal_code: string
          recipient_name: string
          state: string
          street: string
        }
        Insert: {
          city: string
          complement?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          neighborhood?: string | null
          number: string
          order_id: string
          phone?: string | null
          postal_code: string
          recipient_name: string
          state: string
          street: string
        }
        Update: {
          city?: string
          complement?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          neighborhood?: string | null
          number?: string
          order_id?: string
          phone?: string | null
          postal_code?: string
          recipient_name?: string
          state?: string
          street?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_addresses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cost_price: number
          created_at: string | null
          discount: number | null
          id: string
          master_variant_id: string | null
          merchant_margin: number
          order_id: string
          pub_margin: number
          quantity: number
          sale_price: number
          snapshot_name: string
          snapshot_sku: string
          store_product_variant_id: string | null
        }
        Insert: {
          cost_price: number
          created_at?: string | null
          discount?: number | null
          id?: string
          master_variant_id?: string | null
          merchant_margin: number
          order_id: string
          pub_margin: number
          quantity: number
          sale_price: number
          snapshot_name: string
          snapshot_sku: string
          store_product_variant_id?: string | null
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          discount?: number | null
          id?: string
          master_variant_id?: string | null
          merchant_margin?: number
          order_id?: string
          pub_margin?: number
          quantity?: number
          sale_price?: number
          snapshot_name?: string
          snapshot_sku?: string
          store_product_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_master_variant_id_fkey"
            columns: ["master_variant_id"]
            isOneToOne: false
            referencedRelation: "master_product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_product_variant_id_fkey"
            columns: ["store_product_variant_id"]
            isOneToOne: false
            referencedRelation: "store_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_shipping_lines: {
        Row: {
          actual_shipping_cost: number | null
          carrier: string
          charged_shipping_cost: number
          created_at: string | null
          estimated_days: number | null
          id: string
          order_id: string
          service_name: string
        }
        Insert: {
          actual_shipping_cost?: number | null
          carrier: string
          charged_shipping_cost: number
          created_at?: string | null
          estimated_days?: number | null
          id?: string
          order_id: string
          service_name: string
        }
        Update: {
          actual_shipping_cost?: number | null
          carrier?: string
          charged_shipping_cost?: number
          created_at?: string | null
          estimated_days?: number | null
          id?: string
          order_id?: string
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_shipping_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          checkout_id: string | null
          created_at: string | null
          currency: string | null
          customer_id: string
          id: string
          order_number: string
          organization_id: string
          status: Database["public"]["Enums"]["order_status"] | null
          store_id: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          checkout_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id: string
          id?: string
          order_number: string
          organization_id: string
          status?: Database["public"]["Enums"]["order_status"] | null
          store_id: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          checkout_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string
          id?: string
          order_number?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          store_id?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_organization_id_fkey"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "orders_store_id_organization_id_fkey"
            columns: ["store_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          document: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          idempotency_key: string
          payment_id: string
          provider: string
          status: string
          transaction_id_external: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          idempotency_key: string
          payment_id: string
          provider: string
          status: string
          transaction_id_external?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          idempotency_key?: string
          payment_id?: string
          provider?: string
          status?: string
          transaction_id_external?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string | null
          currency: string | null
          gateway_fee: number | null
          gross_amount: number
          id: string
          net_amount: number | null
          order_id: string
          provider: string
          status: Database["public"]["Enums"]["payment_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          gateway_fee?: number | null
          gross_amount: number
          id?: string
          net_amount?: number | null
          order_id: string
          provider: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          gateway_fee?: number | null
          gross_amount?: number
          id?: string
          net_amount?: number | null
          order_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string
          created_at: string | null
          fulfillment_id: string
          id: string
          shipping_cost: number | null
          status: string | null
          tracking_code: string | null
          updated_at: string | null
        }
        Insert: {
          carrier: string
          created_at?: string | null
          fulfillment_id: string
          id?: string
          shipping_cost?: number | null
          status?: string | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string
          created_at?: string | null
          fulfillment_id?: string
          id?: string
          shipping_cost?: number | null
          status?: string | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "fulfillments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_profiles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_quotes: {
        Row: {
          carrier: string
          checkout_id: string
          created_at: string | null
          estimated_days: number | null
          id: string
          price: number
          service_name: string
        }
        Insert: {
          carrier: string
          checkout_id: string
          created_at?: string | null
          estimated_days?: number | null
          id?: string
          price: number
          service_name: string
        }
        Update: {
          carrier?: string
          checkout_id?: string
          created_at?: string | null
          estimated_days?: number | null
          id?: string
          price?: number
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_quotes_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
        ]
      }
      store_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          is_primary: boolean | null
          ssl_status: string | null
          store_id: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          is_primary?: boolean | null
          ssl_status?: string | null
          store_id?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          is_primary?: boolean | null
          ssl_status?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_domains_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_variants: {
        Row: {
          compare_at_price: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          master_variant_id: string
          sale_price: number
          store_product_id: string
          updated_at: string | null
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          master_variant_id: string
          sale_price: number
          store_product_id: string
          updated_at?: string | null
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          master_variant_id?: string
          sale_price?: number
          store_product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_variants_master_variant_id_fkey"
            columns: ["master_variant_id"]
            isOneToOne: false
            referencedRelation: "master_product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_variants_store_product_id_fkey"
            columns: ["store_product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          master_product_id: string
          seo_data: Json | null
          slug: string
          status: string | null
          store_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          master_product_id: string
          seo_data?: Json | null
          slug: string
          status?: string | null
          store_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          master_product_id?: string
          seo_data?: Json | null
          slug?: string
          status?: string | null
          store_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_products_master_product_id_fkey"
            columns: ["master_product_id"]
            isOneToOne: false
            referencedRelation: "master_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string | null
          id: string
          name: string
          organization_id: string
          slug: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_email: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: { p_organization_id: string; p_roles: string[] }
        Returns: boolean
      }
      reserve_stock_atomic: {
        Args: {
          p_checkout_id: string
          p_master_variant_id: string
          p_quantity: number
          p_ttl_minutes?: number
        }
        Returns: boolean
      }
      service_reserve_stock_atomic: {
        Args: {
          p_checkout_id: string
          p_master_variant_id: string
          p_quantity: number
          p_ttl_minutes?: number
        }
        Returns: boolean
      }
    }
    Enums: {
      fulfillment_status:
        | "PENDING"
        | "PROCESSING"
        | "READY"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
      inventory_movement_type:
        | "RECEIPT"
        | "RESERVE"
        | "RELEASE"
        | "COMMIT"
        | "SHIPMENT"
        | "RETURN"
        | "LOSS"
      ledger_entry_type:
        | "SALE_CREDIT"
        | "PRODUCT_COST"
        | "SHIPPING_COST"
        | "GATEWAY_FEE"
        | "PUB_FEE"
        | "REFUND_DEBIT"
        | "CHARGEBACK_DEBIT"
        | "CHARGEBACK_FEE"
        | "PAYOUT"
        | "ADJUSTMENT"
      order_status:
        | "PENDING_PAYMENT"
        | "PAID"
        | "PROCESSING"
        | "PARTIALLY_FULFILLED"
        | "FULFILLED"
        | "SHIPPED"
        | "DELIVERED"
        | "CANCELLED"
        | "REFUNDED"
      payment_status:
        | "PENDING"
        | "AUTHORIZED"
        | "PAID"
        | "FAILED"
        | "CANCELLED"
        | "REFUNDED"
        | "PARTIALLY_REFUNDED"
        | "CHARGEBACK"
      reservation_status:
        | "ACTIVE"
        | "COMMITTED"
        | "RELEASED"
        | "EXPIRED"
        | "CANCELLED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      fulfillment_status: [
        "PENDING",
        "PROCESSING",
        "READY",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
      ],
      inventory_movement_type: [
        "RECEIPT",
        "RESERVE",
        "RELEASE",
        "COMMIT",
        "SHIPMENT",
        "RETURN",
        "LOSS",
      ],
      ledger_entry_type: [
        "SALE_CREDIT",
        "PRODUCT_COST",
        "SHIPPING_COST",
        "GATEWAY_FEE",
        "PUB_FEE",
        "REFUND_DEBIT",
        "CHARGEBACK_DEBIT",
        "CHARGEBACK_FEE",
        "PAYOUT",
        "ADJUSTMENT",
      ],
      order_status: [
        "PENDING_PAYMENT",
        "PAID",
        "PROCESSING",
        "PARTIALLY_FULFILLED",
        "FULFILLED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
      ],
      payment_status: [
        "PENDING",
        "AUTHORIZED",
        "PAID",
        "FAILED",
        "CANCELLED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
        "CHARGEBACK",
      ],
      reservation_status: [
        "ACTIVE",
        "COMMITTED",
        "RELEASED",
        "EXPIRED",
        "CANCELLED",
      ],
    },
  },
} as const

