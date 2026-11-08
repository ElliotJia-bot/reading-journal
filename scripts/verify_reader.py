"""Verify and clean only the disposable reader-qa account created for browser QA."""
import json,sys,ssl,urllib.request,urllib.error
from cloud import ROOT, PROJECT, api as google_api
cfg=json.loads((ROOT/'.local/firebase-config.json').read_text())
account_file=ROOT/'.local/reader-test-account.json'
a=json.loads(account_file.read_text())
assert a['email'].startswith('reader-qa-') and a['email'].endswith('@example.invalid')
ctx=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
def request(url,body=None,method=None,token=None,status=200):
 headers={'Content-Type':'application/json'}
 if token: headers['Authorization']='Bearer '+token
 req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,context=ctx,timeout=85) as r: code=r.status; result=json.load(r)
 except urllib.error.HTTPError as e: code=e.code; result=json.loads(e.read())
 assert code==status, f'Unexpected status {code}; expected {status}'
 return result
login=request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+cfg['apiKey'],{'email':a['email'],'password':a['password'],'returnSecureToken':True})
assert login['localId']==a['uid']
token=login['idToken'];base=(ROOT/'.local/backend-url').read_text().strip()
if '--cleanup' in sys.argv:
 def remove(path):
  for collection in google_api(path+':listCollectionIds',{},'POST').get('collectionIds',[]):
   for doc in google_api(path+'/'+collection).get('documents',[]): remove('firestore.googleapis.com/v1/'+doc['name'])
  google_api(path,method='DELETE')
 remove(f'firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users/{a["uid"]}')
 request('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+cfg['apiKey'],{'idToken':token})
 account_file.unlink();print('Reader test account and nested private records removed.')
else:
 data=request(base+'/v1/data',token=token)
 book=next(b for b in data['books'] if b['title']=='Lantern EPUB Test')
 path=base+'/v1/reader/books/'+book['id']
 visits=request(path+'/visits',token=token)['visits'];assert visits
 v=visits[0];payload={k:value for k,value in v.items() if k!='id'}
 request(path+'/visits/'+v['id'],payload,'PUT',token)
 assert len(request(path+'/visits',token=token)['visits'])==len(visits)
 request(path+'/visits/'+v['id'],{**payload,'reaction':'Rereading' if v['reaction']!='Rereading' else 'Enjoyed'},'PUT',token,409)
 request(path+'/analyze',{'page':v['page'],'text':'not the recorded page','consent':False},'POST',token,400)
 request(path+'/analyze',{'page':v['page'],'text':'not the recorded page','consent':True},'POST',token,400)
 other=request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+cfg['apiKey'],{'returnSecureToken':True})
 try:
  request(path+'/visits',token=other['idToken'],status=404)
  request(path+'/visits/'+v['id'],payload,'PUT',other['idToken'],404)
 finally: request('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+cfg['apiKey'],{'idToken':other['idToken']})
 assert all('text' not in v for v in visits)
 print('PASS: reader event persistence, retry deduplication, immutable events, consent, excerpt matching and cross-user isolation.')
 print('Saved reader sessions:',sum(s['source']=='reader' for s in data['sessions']))
