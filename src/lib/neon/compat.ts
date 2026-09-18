import { Pool, type QueryResultRow } from 'pg';
import { createVerify, createPublicKey, constants } from 'node:crypto';

type DbError = { code?: string; message: string };

type QueryResponse<T> = {
  data: T | null;
  error: DbError | null;
};

type Filter = {
  kind: 'eq' | 'neq' | 'is' | 'in';
  column: string;
  value: unknown;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
});

function ident(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('Unsafe SQL identifier.');
  }
  return '"' + value + '"';
}

function base64UrlJson(value: string): any {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function derEncodeInteger(bytes: Buffer): Buffer {
  let b = Buffer.from(bytes);
  while (b.length > 1 && b[0] === 0) b = b.subarray(1);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return Buffer.concat([Buffer.from([0x02, b.length]), b]);
}

function joseEcSignatureToDer(signature: Buffer): Buffer {
  const half = signature.length / 2;
  const r = derEncodeInteger(signature.subarray(0, half));
  const s = derEncodeInteger(signature.subarray(half));
  const body = Buffer.concat([r, s]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]);
}

function verifySignature(
  alg: string,
  data: Buffer,
  signature: Buffer,
  jwk: JsonWebKey,
): boolean {
  const key = createPublicKey({ key: jwk as any, format: 'jwk' });
  if (alg === 'RS256') {
    const verify = createVerify('RSA-SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(key, signature);
  }
  if (alg === 'PS256') {
    const verify = createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(
      { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 },
      signature,
    );
  }
  if (alg === 'ES256') {
    const verify = createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(key, joseEcSignatureToDer(signature));
  }
  if (alg === 'ES384') {
    const verify = createVerify('SHA384');
    verify.update(data);
    verify.end();
    return verify.verify(key, joseEcSignatureToDer(signature));
  }
  if (alg === 'ES512') {
    const verify = createVerify('SHA512');
    verify.update(data);
    verify.end();
    return verify.verify(key, joseEcSignatureToDer(signature));
  }
  if (alg === 'EdDSA') {
    return require('node:crypto').verify(null, data, key, signature);
  }
  return false;
}

async function verifyJwt(token: string): Promise<Record<string, any>> {
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
  if (!jwksUrl) throw new Error('NEON_AUTH_JWKS_URL is required for authenticated requests.');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid bearer token.');

  const header = base64UrlJson(parts[0]) as { alg?: string; kid?: string };
  const payload = base64UrlJson(parts[1]) as Record<string, any>;
  if (!header.alg || !header.kid || !payload.sub) {
    throw new Error('Invalid bearer token claims.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined && Number(payload.exp) <= now) {
    throw new Error('Bearer token expired.');
  }
  if (payload.nbf !== undefined && Number(payload.nbf) > now) {
    throw new Error('Bearer token is not active yet.');
  }

  const response = await fetch(jwksUrl);
  if (!response.ok) throw new Error('Failed to retrieve authentication keys.');
  const jwks = await response.json() as { keys?: JsonWebKey[] };
  const jwk = (jwks.keys || []).find(k => (k as any).kid === header.kid);
  if (!jwk) throw new Error('Authentication key not found.');

  const verified = verifySignature(
    header.alg,
    Buffer.from(parts[0] + '.' + parts[1]),
    Buffer.from(parts[2], 'base64url'),
    jwk,
  );
  if (!verified) throw new Error('Invalid bearer token signature.');

  return payload;
}

function mapError(error: any): DbError {
  return {
    code: error?.code,
    message: error?.message || 'Database operation failed.',
  };
}

class NeonQueryBuilder<T = any> implements PromiseLike<QueryResponse<T>> {
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns = '*';
  private filters: Filter[] = [];
  private orderBy?: { column: string; ascending: boolean };
  private rowLimit?: number;
  private payload: any;
  private expectSingle = false;
  private expectMaybeSingle = false;

  constructor(private readonly table: string) {}

  select(columns = '*'): this {
    this.columns = columns;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ kind: 'eq', column, value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ kind: 'neq', column, value });
    return this;
  }

  is(column: string, value: null): this {
    this.filters.push({ kind: 'is', column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: 'in', column, value: values });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number): this {
    this.rowLimit = value;
    return this;
  }

  insert(payload: any): this {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any): this {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  single(): this {
    this.expectSingle = true;
    this.expectMaybeSingle = false;
    return this;
  }

  maybeSingle(): this {
    this.expectMaybeSingle = true;
    this.expectSingle = false;
    return this;
  }

  async execute(): Promise<QueryResponse<T>> {
    try {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required.');
      }

      if (this.operation === 'select') {
        const result = await pool.query(this.buildSelectSql());
        if (this.expectSingle || this.expectMaybeSingle) {
          if (result.rows.length === 0) {
            return this.expectMaybeSingle
              ? { data: null, error: null }
              : { data: null, error: { code: 'PGRST116', message: 'No rows found.' } };
          }
          if (result.rows.length > 1) {
            return {
              data: null,
              error: { code: 'PGRST117', message: 'Multiple rows found where one was expected.' },
            };
          }
          return { data: result.rows[0] as T, error: null };
        }
        return { data: result.rows as T, error: null };
      }

      if (this.operation === 'insert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
        const keys = Object.keys(rows[0] || {});
        if (keys.length === 0) throw new Error('Insert payload is empty.');
        const values: unknown[] = [];
        const tuples = rows.map(row => {
          const placeholders = keys.map(key => {
            values.push(row[key]);
            return '$' + values.length;
          });
          return '(' + placeholders.join(', ') + ')';
        });
        const returning = this.returningColumns();
        const sql = 'INSERT INTO ' + ident(this.table) +
          ' (' + keys.map(ident).join(', ') + ')' +
          ' VALUES ' + tuples.join(', ') +
          ' RETURNING ' + returning;
        const result = await pool.query(sql, values);
        return this.formatRows(result);
      }

      if (this.operation === 'update') {
        const keys = Object.keys(this.payload || {});
        if (keys.length === 0) throw new Error('Update payload is empty.');
        const values: unknown[] = [];
        const assignments = keys.map(key => {
          values.push(this.payload[key]);
          return ident(key) + ' = $' + values.length;
        });
        const where = this.buildWhere(values);
        const returning = this.returningColumns();
        const sql = 'UPDATE ' + ident(this.table) +
          ' SET ' + assignments.join(', ') +
          where.sql +
          ' RETURNING ' + returning;
        const result = await pool.query(sql, values);
        return this.formatRows(result);
      }

      const values: unknown[] = [];
      const where = this.buildWhere(values);
      const returning = this.columns !== '*' ? this.returningColumns() : '';
      const sql = 'DELETE FROM ' + ident(this.table) + where.sql +
        (returning ? ' RETURNING ' + returning : '');
      const result = await pool.query(sql, values);
      if (returning) return this.formatRows(result);
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: mapError(error) };
    }
  }

  then<TResult1 = QueryResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private returningColumns(): string {
    const nested = /\b([A-Za-z_][A-Za-z0-9_]*)\(\*\)/.exec(this.columns);
    if (nested) {
      return '*';
    }
    return this.columns || '*';
  }

  private formatRows(result: { rows: QueryResultRow[] }): QueryResponse<any> {
    if (this.expectSingle || this.expectMaybeSingle) {
      if (result.rows.length === 0) {
        return this.expectMaybeSingle
          ? { data: null, error: null }
          : { data: null, error: { code: 'PGRST116', message: 'No rows found.' } };
      }
      if (result.rows.length > 1) {
        return {
          data: null,
          error: { code: 'PGRST117', message: 'Multiple rows found where one was expected.' },
        };
      }
      return { data: result.rows[0], error: null };
    }
    return { data: result.rows, error: null };
  }

  private buildSelectSql(): string {
    const cols = this.columns.includes('(') ? '*' : this.columns;
    const values: unknown[] = [];
    const where = this.buildWhere(values);
    const order = this.orderBy
      ? ' ORDER BY ' + ident(this.orderBy.column) + (this.orderBy.ascending ? ' ASC' : ' DESC')
      : '';
    const limit = this.rowLimit !== undefined ? ' LIMIT ' + Math.max(0, Math.floor(this.rowLimit)) : '';
    return 'SELECT ' + cols + ' FROM ' + ident(this.table) + where.sql + order + limit;
  }

  private buildWhere(values: unknown[]): { sql: string } {
    if (this.filters.length === 0) return { sql: '' };
    const clauses = this.filters.map(filter => {
      const column = ident(filter.column);
      if (filter.kind === 'is') {
        return column + (filter.value === null ? ' IS NULL' : ' IS NOT NULL');
      }
      if (filter.kind === 'in') {
        const arr = Array.isArray(filter.value) ? filter.value : [];
        if (arr.length === 0) return 'FALSE';
        const ph = arr.map(v => {
          values.push(v);
          return '$' + values.length;
        });
        return column + ' IN (' + ph.join(', ') + ')';
      }
      values.push(filter.value);
      return column + (filter.kind === 'eq' ? ' = ' : ' <> ') + '$' + values.length;
    });
    return { sql: ' WHERE ' + clauses.join(' AND ') };
  }
}

export class NeonCompatClient {
  readonly auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null }; error: DbError | null }>;
  };

  constructor(private readonly accessToken = '') {
    this.auth = {
      getUser: async () => {
        if (!this.accessToken) return { data: { user: null }, error: null };
        try {
          const claims = await verifyJwt(this.accessToken);
          return { data: { user: { id: String(claims.sub) } }, error: null };
        } catch (error: any) {
          return { data: { user: null }, error: mapError(error) };
        }
      },
    };
  }

  from(table: string): NeonQueryBuilder {
    return new NeonQueryBuilder(table);
  }

  async rpc(functionName: string, params: Record<string, unknown>): Promise<QueryResponse<any>> {
    try {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(functionName)) {
        throw new Error('Unsafe function identifier.');
      }
      const keys = Object.keys(params);
      const placeholders = keys.map((key, index) => '$' + (index + 1));
      const values = keys.map(key => params[key]);
      const sql = 'SELECT public.' + ident(functionName) + '(' + placeholders.join(', ') + ') AS result';
      const result = await pool.query(sql, values);
      return { data: result.rows[0]?.result ?? null, error: null };
    } catch (error) {
      return { data: null, error: mapError(error) };
    }
  }
}

export function createNeonClient(accessToken = ''): NeonCompatClient {
  return new NeonCompatClient(accessToken);
}
