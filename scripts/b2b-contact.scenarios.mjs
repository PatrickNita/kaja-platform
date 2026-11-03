import assert from 'node:assert/strict';
export async function verifyOptionalContacts({api,db,setMember}) {
 setMember({slug:'patrick',name:'Patrick'});
 const fields={name:'Bosco test',address:'Alba-Iulia 75',contact:'Sergiu',phone:''};
 await api({mode:'admin',operation:'createLocation',...fields,phone:'1234'},400);
 const create=async(value)=>(await api({mode:'admin',operation:'createLocation',...value})).result.id;
 const first=await create(fields),second=await create({...fields,name:'Another blank contact'});
 const [a]=await db.query('select * from b2b_locations where id=$1',[first]);
 const [b]=await db.query('select * from b2b_locations where id=$1',[second]);
 assert.notEqual(a.access_group_id,b.access_group_id);
 await api({mode:'admin',operation:'editLocation',...fields,address:'Updated address',locationId:first,version:a.details_version});
 const [updated]=await db.query('select * from b2b_locations where id=$1',[first]);
 assert.equal(updated.access_group_id,a.access_group_id);assert.equal(updated.phone,'');
 await api({mode:'admin',operation:'editLocation',...fields,contact:'Other Sergiu',locationId:first,version:updated.details_version},409);
 const handle=await create({name:'Pushkin test',address:'Pushkin 52',contact:'Andrei',phone:'@drussik'});
 const numeric=await create({name:'Numeric Andrei',address:'Test',contact:'Andrei',phone:'068694838'});
 const ids=await db.query('select access_group_id from b2b_locations where id in ($1,$2)',[handle,numeric]);
 assert.equal(new Set(ids.map(x=>x.access_group_id)).size,2);
 console.log('PASS optional contacts: blank phones isolated, unchanged edit preserves access, changed contact requires confirmation, handle separate from numeric contact.');
}
