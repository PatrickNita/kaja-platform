// Shared atomic statements: production route and isolated database tests use the same implementation.
import { sql } from "drizzle-orm";
export function assignLocation(
  fields: { name: string; address: string; contact: string; phone: string },
  key: string,
  hash: string,
  cipher: string,
  memberId: number,
  edit?: { id: number; version: number; confirmed: boolean },
) {
  const target = edit
    ? sql`select * from b2b_locations where id=${edit.id} and details_version=${edit.version} for update`
    : sql`select 1 as ok`;
  return sql`with target as materialized (${target}), allowed as materialized (
   select t.* from target t ${edit ? sql`where ${edit.confirmed} or exists(select 1 from b2b_access_groups g where g.id=t.access_group_id and g.contact_key=${key})` : sql``}
 ), access_group as (
   insert into b2b_access_groups(contact_key,token_hash,token_cipher)
   select ${key},${hash},${cipher} from allowed
   on conflict(contact_key) do update set contact_key=excluded.contact_key returning id
 ) ${edit ? sql`update b2b_locations l set name=${fields.name},address=${fields.address},contact=${fields.contact},phone=${fields.phone},access_group_id=g.id,updated_by=${memberId},updated_at=now(),details_version=l.details_version+1 from access_group g,allowed t where l.id=t.id returning l.id` : sql`insert into b2b_locations(name,address,contact,phone,token_hash,token_cipher,created_by,updated_by,access_group_id) select ${fields.name},${fields.address},${fields.contact},${fields.phone},${hash},${cipher},${memberId},${memberId},g.id from access_group g returning id`}`;
}
