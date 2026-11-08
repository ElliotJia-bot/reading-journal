"""Exercise real discovery and atomic feedback with disposable private accounts."""
import json,os,secrets,ssl,time,uuid,urllib.request,urllib.error
from cloud import ROOT,PROJECT,api as google_api
base=os.environ.get('BACKEND_URL','http://127.0.0.1:8082')
context=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
config=json.loads((ROOT/'.local/firebase-config.json').read_text())
fixture=ROOT/'.local/for-you-qa.json'
users=[]
def request(path,token=None,body=None,method='GET',expected=200):
 url=path if path.startswith('https://') else base+path
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,context=context,timeout=80) as r:status,data=r.status,json.load(r)
 except urllib.error.HTTPError as e:status,data=e.code,json.loads(e.read())
 assert status==expected,f'{method} {path.split("?")[0]}: {status}; {data}'
 return data
root=f'firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
def remove_tree(path):
 for coll in google_api(path+':listCollectionIds',{},'POST').get('collectionIds',[]):
  for doc in google_api(path+'/'+coll).get('documents',[]):remove_tree('firestore.googleapis.com/v1/'+doc['name'])
 google_api(path,method='DELETE')
def clean(u):
 assert u['email'].startswith('for-you-qa-') and u['email'].endswith('@example.com')
 remove_tree(root+'/users/'+u['localId'])
 request('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+config['apiKey'],body={'idToken':u['idToken']},method='POST')
if os.environ.get('CLEAN_QA')=='1':
 u=json.loads(fixture.read_text());fresh=request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+config['apiKey'],body={'email':u['email'],'password':u['password'],'returnSecureToken':True},method='POST');u.update(fresh);clean(u);fixture.unlink();print('For You test account removed.');raise SystemExit
keep=os.environ.get('KEEP_QA')=='1';passed=False
try:
 for _ in range(2):
  email='for-you-qa-'+uuid.uuid4().hex+'@example.com';password=secrets.token_urlsafe(24)
  u=request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+config['apiKey'],body={'email':email,'password':password,'returnSecureToken':True},method='POST');u.update(email=email,password=password);users.append(u)
 a,b=(u['idToken'] for u in users)
 request('/v1/recommendations',expected=401)
 request('/v1/profile',a,{'goal':'Explore more books','timezone':'America/New_York','topics':['Fantasy','Adventure'],'language':'eng'},'PUT')
 request('/v1/books/qa-seed',a,{'title':'The Hobbit','author':'J. R. R. Tolkien','totalPages':310,'unit':'pages','baselinePosition':40,'status':'Reading','topics':['Fantasy','Adventure'],'language':'eng'},'PUT')
 print('Loading real catalog shelves…',flush=True)
 feed=request('/v1/recommendations',a)
 print('Shelf counts: '+json.dumps({k:len(feed[k]) for k in ['personal','explore','peers']}),flush=True)
 assert all(len(feed[k])==6 for k in ['personal','explore','peers'])
 allbooks=feed['personal']+feed['explore']+feed['peers'];assert len({x['id'] for x in allbooks})==18
 assert all(x['language']=='eng' for x in allbooks)
 assert feed['peerSource']=='popular' and feed['experience'] is None
 yes,maybe,no=feed['personal'][:3]
 request('/v1/recommendations/'+yes['id']+'/feedback',b,{'value':'yes'},'PUT',404)
 request('/v1/recommendations/OL999999999W/feedback',a,{'value':'yes'},'PUT',404)
 cold=request('/v1/recommendations',b)
 assert all(len(cold[k])==6 for k in ['personal','explore','peers']) and cold['experience'] is None
 request('/v1/recommendations/'+yes['id']+'/feedback',a,{'value':'yes','uid':users[1]['localId']},'PUT',400)
 for _ in range(2):request('/v1/recommendations/'+yes['id']+'/feedback',a,{'value':'yes'},'PUT')
 books=request('/v1/data',a)['books'];added=[x for x in books if x.get('catalogId')==yes['id']];assert len(added)==1 and added[0]['status']=='Want to Read'
 for book,value in [(maybe,'maybe'),(no,'no')]:request('/v1/recommendations/'+book['id']+'/feedback',a,{'value':value},'PUT')
 newer=request('/v1/recommendations',a);ids=[x['id'] for k in ['personal','explore','peers'] for x in newer[k]]
 assert yes['id'] not in ids and no['id'] not in ids and maybe['id'] in ids
 assert all(len(newer[k])==6 for k in ['personal','explore','peers'])
 assert request('/v1/data',b)['books']==[]
 request('/v1/recommendations/preferences',a,{'experience':'Experienced'},'PUT')
 assert request('/v1/recommendations',a)['experience']=='Experienced'
 print('Checking actual AI explanation…',flush=True)
 detail=request('/v1/recommendations/'+maybe['id']+'/details',a)
 assert detail['reasonSource']=='ai' and detail['reason']
 assert request('/v1/recommendations/'+maybe['id']+'/details',a)==detail
 print('PASS: 3×6 real books, verified language, atomic/idempotent Like, persistent Maybe/dislike, account isolation, saved experience, actual AI reason and cached repeat.',flush=True)
 if keep:
  fixture.write_text(json.dumps(users[0]));fixture.chmod(0o600)
 passed=True
finally:
 for i,u in enumerate(users):
  if i==0 and passed and keep:continue
  clean(u)
 print('Test data cleaned; first account retained for browser QA.' if passed and keep else 'Test data cleaned.',flush=True)
