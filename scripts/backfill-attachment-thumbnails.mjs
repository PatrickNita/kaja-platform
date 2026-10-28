import { neon } from '@neondatabase/serverless';
import { ensureProductImageVariants } from '../src/lib/product-image-variants.ts';
if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) throw Error('Credentials required');
const db=neon(process.env.DATABASE_URL);
const rows=await db`select id,pathname,url from attachments where content_type='image/png' and deleted_at is null order by id`;
let total=0;
for(const row of rows){const variants=await ensureProductImageVariants(row);total+=variants.find(v=>v.variant==='thumb').size;console.log('Verified attachment',row.id);}
console.log(JSON.stringify({files:rows.length,thumbBytes:total}));
