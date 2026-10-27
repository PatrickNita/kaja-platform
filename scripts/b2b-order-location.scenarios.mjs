import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyOrderLocation({db,api,route,base,crypto,setCookie,setMember}) {
  setMember({slug:'patrick',name:'Patrick'});
  const ids=[];
  for(const name of ['Transfer A','Transfer B','Transfer Other']) {
    await api({mode:'admin',operation:'createLocation',name,address:'Adresă test '+name,contact:name==='Transfer Other'?'Other':'Transfer',phone:name==='Transfer Other'?'069111112':'069111111'});
    ids.push((await db.query('select id from b2b_locations where name=$1',[name]))[0].id);
  }
  const [a,b,other]=ids;
  const [group]=await db.query('select g.* from b2b_access_groups g join b2b_locations l on l.access_group_id=g.id where l.id=$1',[a]);
  setCookie(crypto.sessionValue(group.id,group.version));
  await db.query('update b2b_products set stock=100 where id=1');
  const created=await api({mode:'portal',operation:'saveOrder',locationId:a,requestKey:randomUUID(),quantities:[{productId:1,quantity:2}]});
  const orderId=created.result.id;
  const get=async()=> (await db.query('select * from b2b_orders where id=$1',[orderId]))[0];
  const before=await get(),stock=await db.query('select id,stock,stock_version from b2b_products order by id'),items=await db.query('select * from b2b_order_items where order_id=$1',[orderId]);
  const move={mode:'portal',operation:'changeOrderLocation',locationId:a,destinationLocationId:b,orderId,version:before.version};
  await api({...move,destinationLocationId:other},409);
  await api({...move,destinationLocationId:a},409);
  await api({...move,mode:'admin'},403);
  await api({...move,version:999999},409);
  const result=await api(move),after=await get();
  assert.equal(after.location_id,b);assert.equal(after.id,before.id);assert.equal(after.total,before.total);assert.equal(after.status,'placed');assert.equal(new Date(after.created_at).getTime(),new Date(before.created_at).getTime());assert.equal(after.version,before.version+1);
  assert.equal(result.result.order.location_name,'Transfer B');assert.equal(result.result.order.items[0].quantity,2);
  assert.deepEqual(await db.query('select * from b2b_order_items where order_id=$1',[orderId]),items);
  assert.deepEqual(await db.query('select id,stock,stock_version from b2b_products order by id'),stock);
  await api(move,409);
  const notifications=await db.query('select payload from b2b_notifications where order_id=$1 order by id',[orderId]);
  assert.equal(notifications.length,2);assert.equal(notifications[1].payload.previousLocation.name,'Transfer A');assert.equal(notifications[1].payload.location.name,'Transfer B');
  const race=[{...move,locationId:b,destinationLocationId:a,version:after.version},{mode:'admin',operation:'status',orderId,version:after.version,status:'confirmed'}];
  const responses=await Promise.all(race.map(body=>route.POST(new Request(base+'/api/b2b',{method:'POST',headers:{host:'localhost:3000',origin:base,'content-type':'application/json'},body:JSON.stringify(body)}))));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  let current=await get();
  if(current.status==='placed'){await api({mode:'admin',operation:'status',orderId,version:current.version,status:'confirmed'});current=await get();}
  await api({...move,locationId:current.location_id,destinationLocationId:current.location_id===a?b:a,version:current.version},409);
  await api({mode:'admin',operation:'status',orderId,version:current.version,status:'paid'});current=await get();
  await api({...move,locationId:current.location_id,destinationLocationId:current.location_id===a?b:a,version:current.version},409);
  assert.deepEqual(await db.query('select id,stock,stock_version from b2b_products order by id'),stock);
  setCookie(crypto.sessionValue(group.id,group.version+1));await api(move,401);
  console.log('PASS: location transfer, scope, status, stale version, replay, confirmation race, snapshots, unchanged lines/stock and notification deduplication.');
}
