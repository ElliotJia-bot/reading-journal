"""Synthetic-only probe of the structured insight response. Never prints secrets."""
import os
import subprocess
from cloud import ROOT

env = dict(os.environ, TINKER_API_KEY=(ROOT / '.local/tinker.key').read_text().strip())
source = r'''
import { generateInsights } from './dist/backend/src/tinker.js';
const original = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const r = await original(...args);
  const data = await r.clone().json();
  console.log(JSON.stringify({status:r.status,usage:data.usage,finishReason:data.choices?.[0]?.finish_reason}));
  return r;
};
try {
  const result = await generateInsights([
    {id:'summary',text:'1 session, 20 total minutes, 1 reading day, average 20 minutes'},
    {id:'locations',text:'Library: 1 session, 20 minutes'},
    {id:'times',text:'Afternoon: 20 minutes'},
    {id:'topics',text:'Fiction and Design: 10 minutes each, one explicitly liked session'}
  ], 'Build a reading habit');
  console.log(JSON.stringify({valid:true,cards:result.cards.length}));
} catch (e) { console.log(JSON.stringify({valid:false,error:e.message})); process.exitCode=1; }
'''
subprocess.run(['/Users/elliotjia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node', '--input-type=module', '-e', source], env=env, cwd=ROOT/'backend', check=True)
