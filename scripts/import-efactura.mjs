import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { prepareImport, applyImport } from './efactura-import-lib.mjs';
const args=process.argv.slice(2);
const file=args.find(arg=>arg.endsWith('.xml') || arg.endsWith('.json'));
if(!file) throw Error('Supply the XML or parsed JSON path; default is dry-run. Add --apply to import.');
const project=JSON.parse(readFileSync(new URL('../.vercel/project.json',import.meta.url),'utf8'));
if(project.projectId!=='prj_Ip1P7MnHAcBYOkIfs5gzLehy7575') throw Error('Unexpected project');
const source=file.endsWith('.json') ? JSON.parse(readFileSync(file,'utf8')) : JSON.parse(execFileSync(process.env.PYTHON_EXECUTABLE||'python',[fileURLToPath(new URL('./parse-efactura.py',import.meta.url)),file],{encoding:'utf8',maxBuffer:1024*1024}));
if(args.includes('--apply') && process.env.VERCEL && (process.env.VERCEL_ENV!=='production' || process.env.KAJA_EFACTURA_IMPORT!==source.sourceSha256)) throw Error('Explicit production import required');
const db=neon(process.env.DATABASE_URL);
const plan=await prepareImport(db,source);
const summary={mode:args.includes('--apply')?'apply':'dry-run',invoices:plan.orders.length,totalMDL:plan.orders.reduce((s,o)=>s+o.total,0)/100,units:plan.orders.reduce((s,o)=>s+o.lines.reduce((n,l)=>n+l.quantity,0),0),newLocations:plan.locations.filter(l=>!l.id).map(l=>l.name),orders:plan.orders.map(o=>({invoice:o.reference,location:o.location,totalMDL:o.total/100,date:o.issuedAt}))};
console.log(JSON.stringify(summary,null,2));
if(args.includes('--apply')) {
 const result=await applyImport(db,plan);
 console.log(JSON.stringify(result,null,2));
 const report=args.indexOf('--report');
 if(report>=0)writeFileSync(args[report+1],JSON.stringify({sourceSha256:source.sourceSha256,...summary,...result},null,2));
}
