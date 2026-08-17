import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { BaseService } from './base';
import type { RequestContext } from '../lib/context/request';
import type { TenantContext } from '../lib/context/tenant';
import { CatalogRepository } from '../repositories/catalog';
import { AppError } from '../lib/errors/model';
import type { AuthorizationBoundary } from '../lib/authorization/boundary';
import { requireAuthenticated } from '../lib/authorization/boundary';
import type { AuthContext } from '../lib/auth/context';

export interface StoreCatalogItemDTO {
  storeProductId: string;
  masterProductId: string;
  title: string;
  slug: string;
  status: string | null;
}

export interface StoreVariantDTO {
  storeVariantId: string;
  masterVariantId: string;
  sku: string;
  salePrice: number;
  compareAtPrice: number | null;
  isActive: boolean;
  inventory: {
    onHand: number;
    reserved: number;
    committed: number;
    available: number;
  };
}

export interface StoreProductDetailDTO {
  storeProductId: string;
  masterProductId: string;
  title: string;
  slug: string;
  status: string | null;
  seoData: any;
  masterData: {
    baseSku: string;
    description: string | null;
    supplierId: string | null;
  };
  variants: StoreVariantDTO[];
}

export class CatalogService extends BaseService {
  private readonly db: SupabaseClient<Database>;
  private readonly repo: CatalogRepository;
  private readonly tenant: TenantContext;
  private readonly auth: AuthContext;

  constructor(db: SupabaseClient<Database>, context: RequestContext, auth: AuthContext, tenant: TenantContext) {
    super(context);
    this.db = db;
    this.repo = new CatalogRepository(db, context);
    this.tenant = tenant;
    this.auth = auth;
  }

  protected getAuthorizationBoundary(): AuthorizationBoundary {
    return {
      auth: this.auth,
      tenant: this.tenant
    };
  }

  /**
   * Retrieves the catalog of products made available for the current store.
   */
  async resolveStoreCatalog(): Promise<StoreCatalogItemDTO[]> {

    if (!this.tenant.isResolved || !this.tenant.storeId) {
      throw new AppError({
        code: 'TENANT_ACCESS_ERROR',
        publicMessage: 'Invalid store context.',
        internalMessage: 'Store catalog requires a resolved store context.',
        httpStatus: 403,
        retryable: false,
        requestId: this.context.requestId,
        correlationId: this.context.correlationId
      });
    }

    try {
      const storeProducts = await this.repo.getStoreProducts(this.tenant.storeId);
      
      return storeProducts.map(p => ({
        storeProductId: p.id,
        masterProductId: p.master_product_id,
        title: p.title,
        slug: p.slug,
        status: p.status
      }));
    } catch (error) {
      this.logger.error('Error resolving store catalog', { requestId: this.context.requestId, storeId: this.tenant.storeId }, { error });
      throw new AppError({
        code: 'INTERNAL_ERROR',
        publicMessage: 'Failed to load catalog.',
        internalMessage: 'DB error resolving store catalog.',
        httpStatus: 500,
        retryable: true,
        requestId: this.context.requestId,
        cause: error
      });
    }
  }

  /**
   * Resolves the full commercial representation of a product in the store,
   * including the underlying master variant attributes and inventory state.
   */
  async resolveStoreProduct(storeProductId: string): Promise<StoreProductDetailDTO> {

    if (!this.tenant.isResolved || !this.tenant.storeId) {
      throw new AppError({
        code: 'TENANT_ACCESS_ERROR',
        publicMessage: 'Invalid store context.',
        internalMessage: 'Store product resolution requires a resolved store context.',
        httpStatus: 403,
        retryable: false,
        requestId: this.context.requestId
      });
    }

    const details = await this.repo.getStoreProductDetail(storeProductId, this.tenant.storeId);
    if (!details) {
      throw new AppError({
        code: 'VALIDATION_ERROR', // Safe public error to indicate missing product
        publicMessage: 'Product not found or unavailable in this store.',
        internalMessage: `StoreProduct ${storeProductId} not found for store ${this.tenant.storeId}`,
        httpStatus: 404,
        retryable: false,
        requestId: this.context.requestId
      });
    }

    const { product, variants: storeVariants } = details;

    // Load master product to enrich payload
    const masterProduct = await this.repo.getMasterProduct(product.master_product_id);
    if (!masterProduct) {
      throw new AppError({
        code: 'CONFLICT',
        publicMessage: 'Product data is incomplete.',
        internalMessage: `MasterProduct ${product.master_product_id} missing for StoreProduct ${product.id}`,
        httpStatus: 409,
        retryable: false,
        requestId: this.context.requestId
      });
    }

    // Load master variants to get base attributes like SKU and to map inventory
    const masterVariants = await this.repo.getMasterVariants(product.master_product_id);
    const masterVariantIds = storeVariants.map(v => v.master_variant_id);
    const inventories = await this.repo.getInventory(masterVariantIds);

    const mappedVariants: StoreVariantDTO[] = storeVariants.map(sv => {
      const mv = masterVariants.find(m => m.id === sv.master_variant_id);
      const inv = inventories.find(i => i.master_variant_id === sv.master_variant_id);

      const onHand = inv?.on_hand || 0;
      const reserved = inv?.reserved || 0;
      const committed = inv?.committed || 0;
      const available = onHand - reserved - committed;

      return {
        storeVariantId: sv.id,
        masterVariantId: sv.master_variant_id,
        sku: mv?.sku || 'UNKNOWN',
        salePrice: sv.sale_price,
        compareAtPrice: sv.compare_at_price,
        isActive: sv.is_active ?? true,
        inventory: {
          onHand,
          reserved,
          committed,
          available: available > 0 ? available : 0
        }
      };
    });

    return {
      storeProductId: product.id,
      masterProductId: product.master_product_id,
      title: product.title,
      slug: product.slug,
      status: product.status,
      seoData: product.seo_data,
      masterData: {
        baseSku: masterProduct.base_sku,
        description: masterProduct.description,
        supplierId: masterProduct.supplier_id
      },
      variants: mappedVariants
    };
  }
}
