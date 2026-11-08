"""Remarked 1.0 isolated integration checks; never publish fixtures to live community."""
import json, os, ssl, time, uuid, urllib.request, urllib.error, secrets
from cloud import ROOT, PROJECT, api as google_api
base=os.environ.get('BACKEND_URL','http://127.0.0.1:8082')
namespace=os.environ.get('COMMUNITY_NAMESPACE','community_test_v1')
assert namespace.startswith('community_test_')
config=json.loads((ROOT/'.local/firebase-config.json').read_text())
context=ssl.create_default_context(cafile='/etc/ssl/cert.pem')
users=[]
def request(path,token=None,body=None,method='GET',expected=200):
 url=path if path.startswith('https://') else base+path
 headers={'Content-Type':'application/json'}
 if token: headers['Authorization']='Bearer '+token
 req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,context=context,timeout=85) as r: status,data=r.status,json.load(r)
 except urllib.error.HTTPError as e: status,data=e.code,json.loads(e.read())
 assert status==expected, f'{method} {path.split("?")[0]}: {status}, expected {expected}: {data}'
 return data
def remove_tree(path):
 for coll in google_api(path+':listCollectionIds',{},'POST').get('collectionIds',[]):
  for doc in google_api(path+'/'+coll).get('documents',[]):remove_tree('firestore.googleapis.com/v1/'+doc['name'])
 google_api(path,method='DELETE')
root=f'firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
circle='qa-'+uuid.uuid4().hex
keep=os.environ.get('KEEP_QA')=='1'
passed=False
try:
 for n in range(2):
  email=f'remarked-qa-{uuid.uuid4().hex}@example.com';password=secrets.token_urlsafe(24)
  data=request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+config['apiKey'],body={'email':email,'password':password,'returnSecureToken':True},method='POST');data.update(email=email,password=password);users.append(data)
 a,b=(u['idToken'] for u in users)
 assert request('/v1/community',a)['testMode']
 assert request('/v1/bookmark',a)['trackingAvailable'] is False
 request('/v1/discovery/readers',expected=401)
 assert not request('/v1/discovery/readers',a)['participation']['active']
 book={'title':'The Little Prince','author':'Antoine de Saint-Exupéry','totalPages':100,'unit':'pages','baselinePosition':0,'status':'Want to Read','topics':['Friendship','Adventure'],'catalogId':'OL27318W','language':'eng'}
 request('/v1/books/qa-book',a,book,'PUT')
 now=int(time.time()*1000)
 original={'bookId':'qa-book','startedAt':now-181123,'endedAt':now-1123,'durationSeconds':81,'startPosition':2,'endPosition':7,'unit':'pages','location':'Library','reaction':'Liked it','stopReason':'Time was up','topics':[],'note':'Private QA reflection','source':'manual'}
 saved=request('/v1/sessions/qa-exact',a,original,'PUT')
 assert request('/v1/data',a)['books'][0]['status']=='Reading'
 saved=request('/v1/sessions/qa-exact',a,{**original,'note':'Edited reflection'},'PUT')
 assert (saved['durationSeconds'],saved['startedAt'],saved['endedAt'])==(81,original['startedAt'],original['endedAt'])
 request('/v1/sessions/qa-exact',b,original,'PUT',404)
 dropped=request('/v1/books/qa-book',a,{**book,'status':'Dropped','dropReason':'Not the right time'},'PUT');assert dropped['position']==7 and dropped['droppedAt']
 resumed=request('/v1/books/qa-book',a,{**book,'status':'Reading'},'PUT');assert resumed['position']==7 and resumed['dropReason']=='Not the right time'
 for index,days in enumerate([0,1,3,5,9,20]):
  date=now-days*86400000-3600000;duration=900+index*120
  request('/v1/sessions/qa-history-'+str(index),a,{**original,'startedAt':date,'endedAt':date+duration*1000,'durationSeconds':duration,'startPosition':10+index*6,'endPosition':16+index*6,'note':'A fixture for chart testing'},'PUT')
 seven=request('/v1/stats?days=7&timezone=America%2FNew_York',a);thirty=request('/v1/stats?days=30&timezone=America%2FNew_York',a);assert thirty['sessionCount']>seven['sessionCount']
 feedback={'value':'maybe','book':{'title':'A test recommendation','authors':['QA Author'],'cover':'','subjects':['Friendship'],'language':'eng','pageCount':200}}
 request('/v1/discovery/feedback/OL99W',a,feedback,'PUT');assert request('/v1/discovery/feedback',a)['saved'][0]['title']=='A test recommendation'
 assert request('/v1/discovery/feedback',b)['votes']=={}
 request('/v1/discovery/participation',a,{'active':True,'displayName':'QA Reader','tier':'Beginner'},'PUT')
 peer=request('/v1/discovery/readers',b)['readers'];own=next(r for r in peer if r['id']==users[0]['localId'])
 assert not any(k in json.dumps(own) for k in ['Private QA reflection','Library','qa-book','qa-exact',users[0]['email']])
 request('/v1/discovery/participation',a,{'active':False,'displayName':'QA Reader','tier':'Beginner'},'PUT')
 assert all(r['id']!=users[0]['localId'] for r in request('/v1/discovery/readers',b)['readers'])
 request('/v1/community/circles/missing-circle/membership',a,{'active':True},'PUT',404)
 circleInput={'name':'QA Reading Circle','description':'An isolated circle used to verify the app.','tags':['Fiction']}
 for _ in range(2):request('/v1/community/circles/'+circle,a,circleInput,'PUT')
 circles=request('/v1/community',a)['circles'];assert next(c for c in circles if c['id']==circle)['memberCount']==1
 request('/v1/community/circles/'+circle,b,circleInput,'PUT',409)
 for active in [True,True,False]:request('/v1/community/circles/'+circle+'/membership',b,{'active':active},'PUT')
 assert next(c for c in request('/v1/community',a)['circles'] if c['id']==circle)['memberCount']==1
 request('/v1/community/circles/'+circle+'/membership',a,{'active':False},'PUT')
 for uid in [users[0]['localId'],users[1]['localId']]:
  request(f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{namespace}_readers/{uid}',b,expected=403)
 print('PASS: precise edits, manual page range, status history, 7/30-day statistics, private synced feedback, opt-in/opt-out privacy, custom circle creation/join/leave, and cross-user isolation.',flush=True)
 if keep:
  fixture={'uid':users[0]['localId'],'email':users[0]['email'],'password':users[0]['password'],'token':a,'namespace':namespace,'circle':circle,'original':original}
  file=ROOT/'.local/remarked-v1-qa.json';file.write_text(json.dumps(fixture));file.chmod(0o600)
 passed=True
finally:
 for i,u in enumerate(users):
  if i==0 and keep and passed:continue
  remove_tree(root+'/users/'+u['localId']);google_api(root+'/'+namespace+'_readers/'+u['localId'],method='DELETE')
  request('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+config['apiKey'],body={'idToken':u['idToken']},method='POST')
 if not(keep and passed):remove_tree(root+'/'+namespace+'/'+circle)
 print('Disposable data cleaned; first QA account retained for UI checks.' if keep and passed else 'Disposable data cleaned.',flush=True)
