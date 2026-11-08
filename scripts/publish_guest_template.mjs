/** Run after building the backend with project-scoped admin credentials.
 * Copies a fixed, private snapshot of the owner-authorized test journal.
 * Never exports credentials, memberships, posts, device tokens or quotas. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {auth,database,userRef} from '../backend/dist/backend/src/store.js';
import {guestProfile,guestRecord} from '../backend/dist/backend/src/guest-template.js';
const account=await auth.getUserByEmail('test@remarked.example');
assert.equal(account.uid,'remarked-test-24b27d6e-0dae-47d9-b720-7a6b29cc1ec9');
const source=userRef(account.uid), records=[];
const profile=(await source.get()).data();assert(profile);
async function addCollection(path){
 const docs=await source.collection(path).get();
 for(const d of docs.docs)records.push({path:path+'/'+d.id,data:guestRecord(path+'/'+d.id,d.data())});
 return docs.docs;
}
const books=await addCollection('books');
for(const c of ['sessions','insights','discoveryFeedback','recommendationDetails'])await addCollection(c);
for(const b of books)for(const c of ['readerVisits','readerReports'])await addCollection('books/'+b.id+'/'+c);
for(const id of ['demo-reading-features','discovery-feed','discovery-preferences']){
 const d=await source.collection('private').doc(id).get();
 if(d.exists)records.push({path:'private/'+id,data:guestRecord('private/'+id,d.data())});
}
const saved=new Set(records.filter(r=>r.path.startsWith('sessions/')&&r.data.source==='bookmark').map(r=>r.path.split('/')[1]));
for(const id of saved){
 const d=await source.collection('bookmarkSessions').doc(id).get();
 if(d.exists){records.push({path:'bookmarkSessions/'+id,data:guestRecord('bookmarkSessions/'+id,d.data())});await addCollection('bookmarkSessions/'+id+'/visits');}
}
assert(records.length>100&&records.length<=10000);
const version='test-'+Date.now(),target=database.collection('guestTemplates').doc(version);
const writer=database.bulkWriter();
const jobs=records.map(r=>writer.create(target.collection('records').doc(createHash('sha256').update(r.path).digest('hex')),r));
await Promise.all([...jobs,writer.close()]);
await target.create({ready:true,count:records.length,profile:guestProfile(profile),createdAt:Date.now(),sourceUid:account.uid});
await database.collection('guestTemplates').doc('current').set({version,publishedAt:Date.now()});
console.log(JSON.stringify({version,records:records.length,books:books.length,sessions:records.filter(r=>/^sessions\//.test(r.path)).length,readerVisits:records.filter(r=>r.path.includes('/readerVisits/')).length}));
