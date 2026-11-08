"""Cross-user community tests. Refuses to post unless the server is in its isolated test namespace."""
import json
import os
import ssl
import time
import uuid
import urllib.error
import urllib.request
from cloud import ROOT, PROJECT, api as google_api

base = os.environ.get('BACKEND_URL', 'http://localhost:8082')
namespace = os.environ.get('COMMUNITY_NAMESPACE', 'community_test_hackathon')
assert namespace.startswith('community_test_')
config = json.loads((ROOT / '.local/firebase-config.json').read_text())
context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
def request(path, token=None, body=None, method='GET', expected=200):
    url = path if path.startswith('https://') else base + path
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=35, context=context) as response: status, data = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        status = error.code
        data = json.loads(error.read())
    assert status == expected, f'Expected {expected}, got {status}: {data}'
    return data
def remove_tree(path):
    for coll in google_api(path + ':listCollectionIds', {}, 'POST').get('collectionIds', []):
        for doc in google_api(path + '/' + coll).get('documents', []):
            remove_tree('firestore.googleapis.com/v1/' + doc['name'])
    google_api(path, method='DELETE')

users, posts = [], []
root = f'firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
try:
    for _ in range(3):
        users.append(request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + config['apiKey'], body={'returnSecureToken': True}, method='POST'))
    a, b, outsider = [u['idToken'] for u in users]
    assert request('/v1/community', a)['testMode'], 'Refusing to publish tests into live circles.'
    for token in [a, b]:
        for _ in range(2): request('/v1/community/circles/fiction/membership', token, {'active': True}, 'PUT')
    assert next(c for c in request('/v1/community', a)['circles'] if c['id']=='fiction')['memberCount'] >= 2
    book_id, session_id, post_id = [uuid.uuid4().hex for _ in range(3)]
    request('/v1/books/' + book_id, a, {'title':'Community test book','author':'Test','unit':'pages','totalPages':100,'baselinePosition':0,'status':'Reading','topics':[]}, 'PUT')
    now = int(time.time()*1000)
    session = {'bookId':book_id,'startedAt':now-1200000,'endedAt':now,'durationSeconds':1200,'startPosition':20,'endPosition':36,'unit':'pages','location':'Library','reaction':'Liked it','stopReason':'','topics':[],'note':'PRIVATE_NOTE_NEVER_SHARE','source':'manual'}
    request('/v1/sessions/' + session_id, a, session, 'PUT')
    payload = {'circleId':'fiction','displayName':'Test Reader A','kind':'checkin','sessionId':session_id,'includeDuration':False,'includeProgress':True,'body':'Synthetic isolated test post.'}
    request('/v1/community/posts/'+post_id, outsider, payload, 'PUT', expected=403)
    request('/v1/community/posts/'+post_id, b, payload, 'PUT', expected=404)
    post = request('/v1/community/posts/'+post_id, a, payload, 'PUT'); posts.append(post_id)
    request('/v1/community/posts/'+post_id, a, payload, 'PUT')
    assert post['reading']=={'progress':{'start':20,'end':36,'unit':'pages'}}
    assert not any(value in json.dumps(post) for value in ['PRIVATE_NOTE_NEVER_SHARE','Library',session_id,'startedAt'])
    path='/v1/community/circles/fiction/posts/'+post_id
    feed=request('/v1/community/circles/fiction/posts',b)['posts']
    assert len([p for p in feed if p['id']==post_id])==1
    for _ in range(2): request(path+'/encouragement',b,{'active':True},'PUT')
    assert request(path,a)['encouragementCount']==1
    reply_id=uuid.uuid4().hex
    for _ in range(2): request(path+'/comments/'+reply_id,b,{'displayName':'Test Reader B','body':'A synthetic test reply.'},'PUT')
    assert request(path,a)['commentCount']==1
    assert len(request(path+'/comments',a)['comments'])==1
    request(path, b, method='DELETE', expected=403)
    request(path+'/report',b,{'reason':'Other'},'PUT')
    request('/v1/community/blocks/'+users[0]['localId'],b,{'active':True,'displayName':'Test Reader A'},'PUT')
    assert all(p['id']!=post_id for p in request('/v1/community/circles/fiction/posts',b)['posts'])
    request(path,b,expected=404)
    request(path+'/comments/'+uuid.uuid4().hex,b,{'displayName':'Test Reader B','body':'Blocked reply'},'PUT',expected=404)
    assert request(path+'/comments',a)['comments']==[]
    request('/v1/community/blocks/'+users[0]['localId'],b,{'active':False},'PUT')
    assert len(request(path+'/comments',a)['comments'])==1
    direct=f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{namespace}/fiction/posts/{post_id}'
    request(direct, a, expected=403)
    for content in [
        {'kind':'question','title':'One book or several?','body':'Synthetic question'},
        {'kind':'recommendation','bookTitle':'A demo book','bookAuthor':'Test Author','body':'Synthetic recommendation'}
    ]:
        extra_id=uuid.uuid4().hex
        result=request('/v1/community/posts/'+extra_id,a,{'circleId':'fiction','displayName':'Test Reader A',**content},'PUT')
        posts.append(extra_id)
        assert result['kind']==content['kind'] and result['reading'] is None
        if content['kind']=='recommendation': assert result['book']['title']=='A demo book'
    ebook_id = uuid.uuid4().hex
    request('/v1/books/' + ebook_id, a, {'title':'Original excerpt fixture','author':'Test author','unit':'pages','totalPages':3,'baselinePosition':0,'status':'Reading','topics':[], 'reader':{'documentId':'a'*64,'pageCount':3}}, 'PUT')
    reflection = {'circleId':'fiction','displayName':'Test Reader A','kind':'reflection','bookId':ebook_id,'quote':'The lamp was still warm.','page':1,'body':'This image makes the library feel welcoming.'}
    reflection_id=uuid.uuid4().hex
    request('/v1/community/posts/'+reflection_id,b,reflection,'PUT',expected=404)
    request('/v1/community/posts/'+reflection_id,a,{**reflection,'page':3},'PUT',expected=404)
    reflected=request('/v1/community/posts/'+reflection_id,a,reflection,'PUT'); posts.append(reflection_id)
    request('/v1/community/posts/'+reflection_id,a,reflection,'PUT')
    assert reflected['excerpt']=={'quote':reflection['quote'],'page':1}
    assert reflected['book']['title']=='Original excerpt fixture' and reflected['reading'] is None
    assert ebook_id not in json.dumps(reflected) and 'documentId' not in json.dumps(reflected)
    reflected_path='/v1/community/circles/fiction/posts/'+reflection_id
    assert request(reflected_path,b)['body']==reflection['body']
    request(reflected_path,a,method='DELETE')
    removed=google_api(root+'/'+namespace+'/fiction/posts/'+reflection_id)
    assert removed['fields']['excerpt'].get('nullValue') is None
    request(reflected_path,b,expected=404)
    print('PASS: excerpt publishing, book ownership, page bounds, retry deduplication, feed rendering data and deletion redaction.',flush=True)
    request(path,a,method='DELETE')
    request(path,b,expected=404)
    assert request('/v1/data',a)['sessions'][0]['note']=='PRIVATE_NOTE_NEVER_SHARE'
    print('PASS: join/post/reaction/comment retries, cross-user sharing, private-field omission, owner-only removal, reporting, bilateral blocking, and direct Firestore denial.',flush=True)
finally:
    for post_id in posts:
        remove_tree(f'{root}/{namespace}/fiction/posts/{post_id}')
        for u in users: google_api(f'{root}/{namespace}_reports/fiction_{post_id}_{u["localId"]}',method='DELETE')
    for u in users:
        try: request('/v1/community/circles/fiction/membership',u['idToken'],{'active':False},'PUT')
        finally:
            remove_tree(f'{root}/users/{u["localId"]}')
            request('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+config['apiKey'],body={'idToken':u['idToken']},method='POST')
    print('Removed disposable test users and their posts.',flush=True)
