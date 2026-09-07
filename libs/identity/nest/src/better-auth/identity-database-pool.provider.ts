import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
@Injectable()
export class IdentityDatabasePool implements OnModuleDestroy {
  private database?: Pool;
  get connection(): Pool { this.database ??= new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: true } : undefined }); return this.database; }
  async onModuleDestroy() { const database = this.database; this.database = undefined; await database?.end(); }
}
