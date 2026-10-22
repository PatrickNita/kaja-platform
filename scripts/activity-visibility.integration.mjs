import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import ts from "typescript";
import {neon} from "@neondatabase/serverless";
import {PgDialect} from "drizzle-orm/pg-core";
import {sql} from "drizzle-orm";
const require=createRequire(import.meta.url);
const compile=p=>ts.transpileModule(readFileSync(p,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const schema={},visibility={};
new Function("exports","require",compile("src/lib/schema.ts"))(schema,require);
new Function("exports","require",compile("src/lib/activity-visibility.ts"))(visibility,n=>n==="./schema"?schema:require(n));
const db=neon(process.env.DATABASE_URL),dialect=new PgDialect();
const requests=[];
for(const slug of [null,"patrick","ionut","andrei","igor"]) for(const source of ["internal","deleted"]) {
 const where=visibility.activityVisibility(slug,source);
 const q=dialect.sqlToQuery(sql`select id from activity where ${where} order by id desc limit 6`);
 requests.push({slug,source,q});
}
const results=await db.transaction([
 db.query("create temporary table activity(id integer,action text,entity_type text,entity_id integer,brand text) on commit drop"),
 ...["updates","tasks","attachments"].map(t=>db.query("create temporary table "+t+"(id integer,brand text,deleted_at timestamptz) on commit drop")),
 db.query("create temporary table workspace_items(id integer,brand text,section text,deleted_at timestamptz) on commit drop"),
 db.query("insert into pg_temp.updates values(1,'kaja',null),(2,'kaja',now())"),
 db.query("insert into pg_temp.tasks values(3,'kaja',null),(4,'kaja',now())"),
 db.query("insert into pg_temp.attachments values(5,'kaja',null),(6,'kaja',now())"),
 db.query("insert into pg_temp.workspace_items values(7,'kaja','catalogue',null),(8,'kaja','catalogue',now())"),
 db.query("insert into pg_temp.activity values (1,'created','update',1,'kaja'),(2,'edited','task',3,'kaja'),(3,'created','attachment',5,'kaja'),(4,'edited','catalogue',7,'kaja'),(5,'created','update',2,'kaja'),(6,'edited','task',4,'kaja'),(7,'created','attachment',6,'kaja'),(8,'edited','catalogue',8,'kaja'),(9,'created','update',999,'kaja')"),
 db.query("insert into pg_temp.activity select i,case when i%3=0 then 'deleted' when i%3=1 then 'comment_deleted' else 'image_deleted' end,'update',2,'kaja' from generate_series(10,250) i"),
 ...requests.map(({q})=>db.query(q.sql,q.params)),
]);
for(const [i,{slug,source}] of requests.entries()) {
 const ids=results.at(i-requests.length).map(r=>r.id);
 assert.deepEqual(ids,slug===null?[]:source==="deleted"?(slug==="patrick"?[250,249,248,247,246,245]:[]):[4,3,2,1],slug+" "+source);
}
console.log("PASS: actual SQL excludes deleted/missing targets before LIMIT for all four roles, all three deletion actions only for Patrick, anonymous denied; public tables untouched.");
