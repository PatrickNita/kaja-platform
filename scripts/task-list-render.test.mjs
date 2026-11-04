import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {groupTaskList,taskDescriptionPreview,taskMemberInitial} from '../src/lib/task-list.ts';
const require=createRequire(import.meta.url);
// Render the real TasksSection implementation with isolated fixture data and inert modal wrappers.
const source=readFileSync('src/app/page.tsx','utf8');
const section=source.slice(source.indexOf('function TasksSection('),source.indexOf('\nfunction CatalogueSection('));
const compile=(code)=>ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function load(path,overrides={}){const module={exports:{}};new Function('require','module','exports',compile(readFileSync(path,'utf8')))((name)=>overrides[name]??require(name),module,module.exports);return module.exports;}
const {NavigationIcon}=load('src/app/navigation-icon.tsx');
const {ProductTable}=load('src/app/product-table.tsx',{'./horizontal-scroll-hints':{HorizontalScrollHints:({children,className,label})=>React.createElement('div',{className:'horizontal-scroll-hints'},React.createElement('div',{className,role:'region','aria-label':label},children))}});
const props={groupTaskList,taskDescriptionPreview,taskMemberInitial,ProductTable,NavigationIcon,
 taskViews:[{key:'all',label:'Toate sarcinile'},{key:'mine',label:'Sarcinile mele'},{key:'history',label:'Istoric sarcini'}],
 FilterLink:({children,href})=>React.createElement('a',{href},children),BrandFilterNav:()=>null,
 PageHeading:({title,count})=>React.createElement('h2',null,title,' (',count,')'),pageTitle:()=> 'Sarcini',
 Composer:()=>null,TaskComposer:()=>null,initialBrand:x=>x,
 ModalEntryGrid:({children})=>React.createElement('div',{className:'modal-entry-grid-shell'},React.createElement('div',{className:'items card-grid modal-entry-grid'},children)),
 EntryCard:({rowPreview,title})=>React.createElement('div',{className:'entry-card-preview',role:'button','aria-label':title},rowPreview),
 TaskResponsibilityProvider:({children})=>children,TaskAssigneeManager:()=>null,hasAttention:()=>false,recordEditConfig:()=>null,updateTask:()=>{},selectedBrandLabel:x=>({kaja:'KAJA',hexenwerk:'HEXENWERK',virginia:'LUMEN'}[x]),
};
const module={exports:{}};new Function('require','module','exports',...Object.keys(props),compile(section+'\nexport {TasksSection};'))(require,module,module.exports,...Object.values(props));
const {TasksSection}=module.exports;
const members=[{id:1,name:'Andrei',slug:'andrei'},{id:2,name:'Igor',slug:'igor'},{id:3,name:'Patrick',slug:'patrick'},{id:4,name:'Ionut',slug:'ionut'}];
const data={members,tasks:[],taskAssignees:[],comments:[],reactions:[],attention:[]};
for(const [id,ids,completed,brand] of [[1,[2,1],[1],'kaja'],[2,[1,2],[],'kaja'],[3,[2,3],[2,3],'hexenwerk'],[4,[3],[],'virginia'],[5,[2],[],'kaja'],[6,[1,2,3,4],[1,3],'kaja']]){
 data.tasks.push({task:{id,brand,title:id===2?'Vizită 🥝 — '+ 'Denumire foarte lungă fără scurtarea informației '.repeat(12):'Sarcina '+id,body:id===2?'Descriere lungă 😀 '.repeat(30)+'FINAL_INVIZIBIL':'Descriere scurtă '+id,createdAt:new Date(id*1000)},author:'Patrick',authorSlug:'patrick'});
 for(const memberId of ids){const m=members.find(m=>m.id===memberId);data.taskAssignees.push({assignment:{taskId:id,memberId,completed:completed.includes(memberId)},memberName:m.name,memberSlug:m.slug});}
}
data.comments=[{comment:{entityType:'task',entityId:1}},{comment:{entityType:'task',entityId:1}},{comment:{entityType:'task',entityId:3}}];
const render=(taskView,brandFilter='all',memberSlug='patrick',fixture=data)=>renderToStaticMarkup(React.createElement(TasksSection,{data:fixture,memberSlug,taskView,brandFilter}));
const all=render('all');assert(all.includes('Sarcini primite împreună de Andrei și Igor'));assert(all.includes('Andrei: finalizat'));assert(all.includes('Igor: nefinalizat'));assert(all.includes('Descriere scurtă 1'));assert(!all.includes('task-list-member-mark'));for(const initials of ['A','IG','P','IO'])assert(all.includes('>'+initials+'</span>'));assert(!all.includes('FINAL_INVIZIBIL'));assert(all.includes('...'));assert(!all.includes('Sarcina 3'));assert.equal((all.match(/Denumire foarte lungă fără scurtarea informației/g)||[]).length,24);
const mine=render('mine','all','igor');assert(mine.includes('împreună de Andrei și Igor'));assert(!mine.includes('Sarcina 4'));assert.equal((mine.match(/Sarcina 1/g)||[]).length,2); // label plus cell, one row
const history=render('history');assert(history.includes('Igor: finalizat'));assert(history.includes('Patrick: finalizat'));assert(history.includes('Sarcina 3'));assert(!history.includes('Sarcina 1'));
const brand=render('all','virginia');assert(brand.includes('Sarcina 4'));assert(!brand.includes('Sarcina 1'));
const empty=render('all','all','patrick',{...data,tasks:[],taskAssignees:[]});assert(empty.includes('Nu există sarcini'));assert(!empty.includes('role="table"'));
mkdirSync('tmp',{recursive:true});
writeFileSync('tmp/task-list-fixture.html',all);
console.log('Real TasksSection fixture: joint groups, partial/done states, comments, long titles, mine, brand and history filters, empty list passed.');

