import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate, countedMs, textFeatures, summarizePages } from "../../shared/reader.js";
import { visitInput, passageInput } from "../src/reader-schema.js";
import { analyzePassage } from "../src/reader-model.js";
test("Stable reading locations preserve text across pages and chapters",()=>{
 const chapters=[{title:"One",text:"A short paragraph. ".repeat(200).trim()},{title:"Two",text:"中文测试。".repeat(300)}];
 const pages=paginate(chapters);
 for(const chapter of chapters){const selected=pages.filter(p=>p.chapter===chapter.title);assert.equal(selected.map(p=>p.text).join(""),chapter.text);for(const p of selected){assert.equal(chapter.text.slice(p.start,p.end),p.text);assert.ok(p.text.length<=1000);}}
 assert.equal(textFeatures("The book is open. Read it slowly!").sentences,2);
 assert.equal(textFeatures("你好世界。").hasCjk,true);
});
test("Dwell clock excludes hidden, paused, sleep gaps and idle overflow",()=>{
 assert.equal(countedMs(1000,2000,1000,true,false),1000);
 assert.equal(countedMs(1000,2000,1000,false,false),0);
 assert.equal(countedMs(1000,2000,1000,true,true),0);
 assert.equal(countedMs(1000,120000,1000,true,false),0);
 assert.equal(countedMs(90000,92000,1000,true,false),1000);
});
test("Reader events enforce timing, consent, and no private text field",()=>{
 const now=Date.now();const v={sessionId:"test",documentId:"a".repeat(64),page:0,chapter:"One",start:0,end:20,textHash:"b".repeat(64),startedAt:now-2000,endedAt:now,activeMs:1500,words:4,characters:18,reaction:"Enjoyed"};
 assert.ok(visitInput.safeParse(v).success);
 assert.ok(!visitInput.safeParse({...v,activeMs:6000}).success);
 assert.ok(!visitInput.safeParse({...v,text:"Private book text"}).success);
 assert.ok(!passageInput.safeParse({page:0,text:"Test",consent:false}).success);
 const pages=summarizePages([{id:"a",...visitInput.parse(v)},{id:"b",...visitInput.parse(v)}]);
 assert.equal(pages[0].activeMs,3000);assert.equal(pages[0].visits,2);
});
test("Passage model rejects invented quotes and malformed output",async t=>{
 let quote="book";
 t.mock.method(globalThis,"fetch",async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({observations:["vocabulary","sentences","abstraction","density","literary","pacing"].map(dimension=>({dimension,explanation:"Limited excerpt.",quote})),possibleReasons:[],interestSignals:[],nextStep:"Read again.",uncertainty:"One short visit."})}}]})));
 assert.equal((await analyzePassage("Read the book",{},"test-key")).observations.length,6);
 quote="invented";await assert.rejects(analyzePassage("Read the book",{},"test-key"),/TINKER_INVALID_RESPONSE/);
});
