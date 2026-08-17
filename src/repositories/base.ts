import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import type { RequestContext } from '../lib/context/request';

export abstract class BaseRepository {
  protected readonly db: SupabaseClient<Database>;
  protected readonly context: RequestContext;

  constructor(db: SupabaseClient<Database>, context: RequestContext) {
    this.db = db;
    this.context = context;
  }
}
