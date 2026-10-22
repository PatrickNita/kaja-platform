import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";

// Called only inside b2b-access.integration's disposable schema.
export async function verifyInventory({db,api,load,setMember,base,stockMigration}) {
  const stock = async id => (await db.query('select stock,stock_version as version from b2b_products where id=$1',[id]))[0];
  const reset = () => db.query('update b2b_products set stock=100,stock_version=stock_version+1');
  const create = quantities => ({mode:"admin",operation:"saveOrder",locationId:2,requestKey:randomUUID(),quantities});
  const line = (productId,quantity) => ({productId,quantity});
  await reset();
  // Installing/reapplying the migration never subtracts historical orders or resets stock.
  await db.transaction(stockMigration.map(q => db.query(q)));
  assert.equal((await stock(1)).stock,100);
  const payload=create([line(1,30),line(2,10)]), first=await api(payload), id=first.result.id;
  assert.equal((await stock(1)).stock,70); assert.equal((await stock(2)).stock,90);
  await api(payload); assert.equal((await stock(1)).stock,70);
  const edit = (version,quantities) => api({mode:"admin",operation:"saveOrder",locationId:2,orderId:id,version,quantities});
  await edit(1,[line(1,20),line(3,5)]);
  assert.equal((await stock(1)).stock,80); assert.equal((await stock(2)).stock,100); assert.equal((await stock(3)).stock,95);
  const before=await stock(1);
  await edit(2,[line(1,20),line(3,5)]); assert.deepEqual(await stock(1),before);
  await api({mode:"admin",operation:"saveOrder",locationId:2,orderId:id,version:2,quantities:[line(1,1)]},409);
  assert.deepEqual(await stock(1),before);
  await api({mode:"admin",operation:"status",orderId:id,version:3,status:"confirmed"});
  await api({mode:"admin",operation:"status",orderId:id,version:4,status:"paid"});
  assert.deepEqual(await stock(1),before);
  const counts = async () => (await db.query('select (select count(*)::int from b2b_orders) as orders,(select count(*)::int from b2b_notifications) as notifications'))[0];
  const oldCounts=await counts(), oldStock=await stock(2);
  const rejected=await api(create([line(2,3),line(3,101)]),409);
  assert.equal(rejected.errorCode,"stock"); assert.deepEqual(await counts(),oldCounts); assert.deepEqual(await stock(2),oldStock);
  await reset();
  // Competing orders cannot both consume the same units; the failed order rolls back completely.
  const responses=await Promise.all([create([line(1,80),line(2,10)]),create([line(1,80),line(2,10)])].map(async p => {
    const route=load("src/app/api/b2b/route.ts");
    const res=await route.POST(new Request(base+"/api/b2b",{method:"POST",headers:{origin:base,host:"localhost:3000","content-type":"application/json"},body:JSON.stringify(p)}));
    return res.status;
  }));
  assert.deepEqual(responses.sort(),[200,409]); assert.equal((await stock(1)).stock,20); assert.equal((await stock(2)).stock,90);
  await db.transaction(stockMigration.map(q => db.query(q))); assert.equal((await stock(1)).stock,20);
  const stockRoute=load("src/app/api/b2b/stock/route.ts");
  const post = body => stockRoute.POST(new Request(base+"/api/b2b/stock",{method:"POST",headers:{origin:base,"content-type":"application/json"},body:JSON.stringify(body)}));
  for(const slug of ["patrick","ionut"]) {setMember({slug,name:slug});const res=await stockRoute.GET();assert.equal(res.status,200);assert((await res.json()).products.every(p=>p.brand==="kaja"));}
  for(const slug of ["igor","andrei"]) {setMember({slug,name:slug});assert.equal((await stockRoute.GET()).status,403);assert.equal((await post({id:1,quantity:10,version:1})).status,403);}
  setMember(null);assert.equal((await stockRoute.GET()).status,401);assert.equal((await post({id:1,quantity:10,version:1})).status,401);
  setMember({slug:"patrick",name:"Patrick"});
  const version=(await stock(1)).version;
  for(const quantity of [-1,1.5,1000001]) assert.equal((await post({id:1,quantity,version})).status,400);
  assert.equal((await stockRoute.POST(new Request(base+"/api/b2b/stock",{method:"POST",headers:{origin:"https://other.example"}}))).status,403);
  assert.equal((await post({id:1,quantity:50,version})).status,200);assert.equal((await stock(1)).stock,50);
  const conflict=await post({id:1,quantity:500,version}); assert.equal(conflict.status,409);assert.equal((await conflict.json()).product.stock,50);
  // A new order changes the version, so an old manual editor cannot overwrite its movement.
  const current=await stock(1);await api(create([line(1,50)]));assert.equal((await stock(1)).stock,0);
  assert.equal((await post({id:1,quantity:100,version:current.version})).status,409);
  await api(create([line(1,1)]),409);
  console.log("PASS: inventory initialization, idempotent retries, edit deltas/removals, no-op/status suppression, atomic rollback, concurrent orders, manual conflicts, role authorization and input validation.");
}
