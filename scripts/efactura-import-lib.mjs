import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newToken, tokenHash, encryptToken } from '../src/lib/b2b/crypto.ts';
import { contactKey } from '../src/lib/b2b/contact.ts';

export const mappings = {
  EBN000121963: ['Pushkin 52','1024600065442',800000],
  EBN000388741: ['Bosco','1017608001710',320000],
  EBN000152086: ['DRAFT CENTRU','1010600015699',480000],
  EBN000152084: ['DRAFT CIOCANA','1010600015699',800000],
  EBN000152080: ['DRAFT BOTANICA','1010600015699',880000],
  EBN000152081: ['DRAFT PIETONALA','1010600015699',520000],
  EBN000152079: ['DRAFT RISCANOVCA','1010600015699',520000],
  EBN000152083: ['KAMORA VIBE','1015600026706',480000],
  EBN000152085: ['KAMORA PRIVATE','1015600026706',480000],
  EBN000152082: ['IMPERATOR','1015600026706',560000],
};
const additions = {
  'Pushkin 52': {address:'Pushkin 52',contact:'Andrei',phone:'@drussik'},
  Bosco: {address:'Alba-Iulia 75',contact:'Sergiu',phone:''},
};
const normalize = value => value.toLowerCase().replace(/\(200g\)/g,'').replace(/[^a-z0-9]/g,'');
export function invoiceKey(invoice) {
  const namespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8','hex');
  const name = `https://kaja-platform.vercel.app/import/efactura/${invoice.supplierIdno}/${invoice.buyerIdno}/${invoice.series}/${invoice.number}`;
  const bytes = createHash('sha1').update(namespace).update(name).digest().subarray(0,16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function prepareImport(db, source) {
  const existing = await db.query('select id,name,address,contact,phone,company_name,idno,access_group_id,details_version from b2b_locations order by id');
  const products = await db.query('select id,name,flavor,grams,price from b2b_products order by id');
  const [member] = await db.query("select id,name from members where slug='patrick'");
  assert(member,'Patrick missing');
  assert.equal(source.invoices.length,10);
  assert.equal(new Set(source.invoices.map(x=>x.series+x.number)).size,10);
  const locations = new Map();
  const orders = source.invoices.map(invoice => {
    assert.equal(invoice.supplierIdno,'1024600022757');
    const reference = invoice.series + invoice.number;
    const mapping = mappings[reference]; assert(mapping,'Unexpected invoice '+reference);
    const [name,idno,total] = mapping;
    assert.equal(invoice.buyerIdno,idno); assert.equal(invoice.total,total);
    const matches = existing.filter(x=>x.name.trim().toLowerCase()===name.toLowerCase());
    assert(matches.length<=1,'Ambiguous location '+name);
    const location = matches[0];
    if(location) assert.equal(location.idno,idno,'Legal company mismatch for '+name);
    const extra = additions[name];
    if(extra && location) for(const key of ['address','contact','phone']) assert.equal(location[key],extra[key],'Existing location differs: '+name+' '+key);
    assert(location || extra,'Missing location '+name);
    if(!locations.has(name)) {
      const expected = location ? Object.fromEntries(['name','address','contact','phone','company_name','idno','access_group_id','details_version'].map(key=>[key,location[key]])) : null;
      locations.set(name, {name,id:location?.id ?? null,expected,...(extra||{}),companyName:invoice.buyerName+', '+invoice.legalAddress,idno});
    }
    const lines = invoice.lines.map(line=>{
      const matches = products.filter(p=>normalize(p.name)===normalize(line.name));
      assert.equal(matches.length,1,'Unknown/ambiguous product '+line.name);
      const p = matches[0];assert.equal(p.grams,200);assert.equal(line.price,40000);assert(line.quantity>0 && Number.isInteger(line.quantity));
      return {productId:p.id,name:p.name,flavor:p.flavor,grams:p.grams,price:line.price,quantity:line.quantity};
    }).sort((a,b)=>a.productId-b.productId);
    assert.equal(new Set(lines.map(x=>x.productId)).size,lines.length,'Duplicate invoice product');
    assert.equal(lines.reduce((sum,x)=>sum+x.price*x.quantity,0),total,'Invoice line sum mismatch');
    const fingerprint=createHash('sha256').update(JSON.stringify({reference,supplierIdno:invoice.supplierIdno,buyerIdno:idno,issuedAt:invoice.issuedAt,total,lines})).digest('hex');
    return {reference,location:name,requestKey:invoiceKey(invoice),total,issuedAt:invoice.issuedAt,lines,
      invoice:{series:invoice.series,number:invoice.number,supplierIdno:invoice.supplierIdno,buyerIdno:idno,issuedAt:invoice.issuedAt,sourceSha256:source.sourceSha256,fingerprint}};
  }).sort((a,b)=>Date.parse(a.issuedAt)-Date.parse(b.issuedAt)||a.reference.localeCompare(b.reference));
  assert.equal(orders.reduce((sum,o)=>sum+o.total,0),5840000);
  assert.equal(orders.reduce((sum,o)=>sum+o.lines.reduce((s,l)=>s+l.quantity,0),0),146);
  return {member,locations:[...locations.values()],orders,products};
}

// A session-local function keeps the entire import and every verification in one transaction.
// Stock is reserved for historical rows before their triggers run, then restored exactly.
export const importFunction = `CREATE OR REPLACE FUNCTION pg_temp.import_efactura_batch(data jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE loc jsonb; ord jsonb; ln jsonb; current_loc b2b_locations%ROWTYPE;
 loc_id integer; group_id integer; imported_order_id integer; existing_order b2b_orders%ROWTYPE;
 stocks jsonb; original_orders jsonb; after_orders jsonb; original_ids integer[];
 notification_count bigint; cashback_count bigint; saved_locations jsonb := '{}'::jsonb;
 created_locations integer := 0; created_orders integer := 0; skipped_orders integer := 0; result jsonb := '[]'::jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(1792586000);
 PERFORM pg_advisory_xact_lock(1793700001);
 SELECT jsonb_agg(jsonb_build_object('id',id,'stock',stock,'stock_version',stock_version) ORDER BY id) INTO stocks FROM b2b_products;
 SELECT array_agg(id),jsonb_agg(to_jsonb(o) ORDER BY id) INTO original_ids,original_orders FROM b2b_orders o;
 SELECT count(*) INTO notification_count FROM b2b_notifications;
 SELECT count(*) INTO cashback_count FROM b2b_cashback;
 FOR loc IN SELECT value FROM jsonb_array_elements(data->'locations') LOOP
  IF loc->>'id' IS NOT NULL THEN
   SELECT * INTO STRICT current_loc FROM b2b_locations WHERE id=(loc->>'id')::int FOR SHARE;
   IF jsonb_build_object('name',current_loc.name,'address',current_loc.address,'contact',current_loc.contact,'phone',current_loc.phone,'company_name',current_loc.company_name,'idno',current_loc.idno,'access_group_id',current_loc.access_group_id,'details_version',current_loc.details_version) IS DISTINCT FROM loc->'expected' THEN RAISE EXCEPTION 'Location changed: %',loc->>'name'; END IF;
   loc_id := current_loc.id;
  ELSE
   IF EXISTS(SELECT 1 FROM b2b_locations WHERE lower(btrim(name))=lower(loc->>'name') OR idno=loc->>'idno') THEN RAISE EXCEPTION 'Location already exists; repeat dry run: %',loc->>'name'; END IF;
   INSERT INTO b2b_access_groups(contact_key,token_hash,token_cipher) VALUES(loc->>'contactKey',loc->>'tokenHash',loc->>'tokenCipher') RETURNING id INTO group_id;
   INSERT INTO b2b_locations(name,address,contact,phone,company_name,idno,access_group_id,token_hash,token_cipher,created_by,updated_by)
   VALUES(loc->>'name',loc->>'address',loc->>'contact',loc->>'phone',loc->>'companyName',loc->>'idno',group_id,loc->>'tokenHash',loc->>'tokenCipher',(data->'member'->>'id')::int,(data->'member'->>'id')::int) RETURNING id INTO loc_id;
   created_locations := created_locations+1;
  END IF;
  saved_locations := saved_locations || jsonb_build_object(loc->>'name',loc_id);
 END LOOP;
 -- Credit only the historical quantities that will be inserted, so zero stock also works.
 UPDATE b2b_products p SET stock=p.stock+credits.quantity FROM (
  SELECT (line->>'productId')::int AS id,sum((line->>'quantity')::int)::int AS quantity
  FROM jsonb_array_elements(data->'orders') o CROSS JOIN LATERAL jsonb_array_elements(o->'lines') line
  WHERE NOT EXISTS(SELECT 1 FROM b2b_orders existing WHERE existing.request_key=(o->>'requestKey')::uuid)
  GROUP BY (line->>'productId')::int
 ) credits WHERE p.id=credits.id;
 FOR ord IN SELECT value FROM jsonb_array_elements(data->'orders') LOOP
  loc_id := (saved_locations->>(ord->>'location'))::int;
  SELECT * INTO existing_order FROM b2b_orders WHERE request_key=(ord->>'requestKey')::uuid;
  IF FOUND THEN
   IF existing_order.location_id<>loc_id OR existing_order.total<>(ord->>'total')::int OR existing_order.status<>'confirmed' OR existing_order.location_snapshot->'invoice'->>'fingerprint' IS DISTINCT FROM ord->'invoice'->>'fingerprint' THEN RAISE EXCEPTION 'Existing invoice differs: %',ord->>'reference'; END IF;
   imported_order_id := existing_order.id; skipped_orders := skipped_orders+1;
  ELSE
   INSERT INTO b2b_orders(location_id,location_snapshot,author,author_member_id,request_key,status,total,confirmed_by,created_at,updated_at,confirmed_at)
   SELECT id,jsonb_build_object('name',name,'address',address,'contact',contact,'phone',phone,'invoice',ord->'invoice'),
    (data->'member'->>'name')||' (import e-Factura)',(data->'member'->>'id')::int,(ord->>'requestKey')::uuid,'confirmed',(ord->>'total')::int,(data->'member'->>'id')::int,(ord->>'issuedAt')::timestamptz,(ord->>'issuedAt')::timestamptz,(ord->>'issuedAt')::timestamptz
   FROM b2b_locations WHERE id=loc_id RETURNING id INTO imported_order_id;
   FOR ln IN SELECT value FROM jsonb_array_elements(ord->'lines') LOOP
    IF NOT EXISTS(SELECT 1 FROM b2b_products WHERE id=(ln->>'productId')::int AND name=ln->>'name' AND grams=(ln->>'grams')::int) OR (ln->>'quantity')::int<=0 OR (ln->>'price')::int<=0 THEN RAISE EXCEPTION 'Invalid product'; END IF;
    INSERT INTO b2b_order_items(order_id,product_id,name,flavor,grams,price,quantity) VALUES(imported_order_id,(ln->>'productId')::int,ln->>'name',ln->>'flavor',(ln->>'grams')::int,(ln->>'price')::int,(ln->>'quantity')::int);
   END LOOP;
   created_orders := created_orders+1;
  END IF;
  IF (SELECT jsonb_agg(jsonb_build_object('productId',i.product_id,'name',i.name,'flavor',i.flavor,'grams',i.grams,'price',i.price,'quantity',i.quantity) ORDER BY i.product_id) FROM b2b_order_items i WHERE i.order_id=imported_order_id) IS DISTINCT FROM ord->'lines' THEN RAISE EXCEPTION 'Order lines differ: %',ord->>'reference'; END IF;
  IF (SELECT sum(i.price::bigint*i.quantity) FROM b2b_order_items i WHERE i.order_id=imported_order_id)<>(ord->>'total')::bigint THEN RAISE EXCEPTION 'Order total differs'; END IF;
  result := result || jsonb_build_array(jsonb_build_object('invoice',ord->>'reference','orderId',imported_order_id,'location',ord->>'location','total',(ord->>'total')::int));
 END LOOP;
 UPDATE b2b_products p SET stock=s.stock,stock_version=s.stock_version FROM jsonb_to_recordset(stocks) AS s(id integer,stock integer,stock_version integer) WHERE p.id=s.id AND (p.stock,p.stock_version) IS DISTINCT FROM (s.stock,s.stock_version);
 IF (SELECT jsonb_agg(jsonb_build_object('id',id,'stock',stock,'stock_version',stock_version) ORDER BY id) FROM b2b_products) IS DISTINCT FROM stocks THEN RAISE EXCEPTION 'Stock changed'; END IF;
 SELECT jsonb_agg(to_jsonb(o) ORDER BY id) INTO after_orders FROM b2b_orders o WHERE id=ANY(original_ids);
 IF after_orders IS DISTINCT FROM original_orders THEN RAISE EXCEPTION 'Existing orders changed'; END IF;
 IF (SELECT count(*) FROM b2b_notifications)<>notification_count OR (SELECT count(*) FROM b2b_cashback)<>cashback_count THEN RAISE EXCEPTION 'Notifications or cashback changed'; END IF;
 RETURN jsonb_build_object('createdLocations',created_locations,'createdOrders',created_orders,'skippedOrders',skipped_orders,'orders',result,'stockUnchanged',true,'notificationsUnchanged',true,'cashbackUnchanged',true);
END $$`;

export async function applyImport(db, prepared, schema) {
  const payload=structuredClone(prepared);
  for(const location of payload.locations) if(!location.id) {
    const token=newToken(),hash=tokenHash(token);
    Object.assign(location,{tokenHash:hash,tokenCipher:encryptToken(token),contactKey:location.phone?contactKey(location.contact,location.phone):'missing|'+hash});
  }
  const queries=[];
  if(schema){assert(/^kaja_efactura_test_[a-f0-9]{12}$/.test(schema));queries.push(db.query(`set local search_path to ${schema}, public`));}
  queries.push(db.query("set local lock_timeout='15s'"),db.query(importFunction),db.query('select pg_temp.import_efactura_batch($1::jsonb) as result',[JSON.stringify(payload)]),db.query('drop function pg_temp.import_efactura_batch(jsonb)'));
  const results=await db.transaction(queries);
  return results.at(-2)[0].result;
}
