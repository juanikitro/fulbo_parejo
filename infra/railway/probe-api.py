"""Read-only API equivalence probes. Never log tokens or row contents."""
import base64, hashlib, hmac, json, os, subprocess, time, urllib.request, urllib.error

base = 'http://api.railway.internal:8080'
anon = os.environ['ANON_KEY']
secret = os.environ['JWT_SECRET'].encode()
def jwt(sub):
    def enc(value):
        return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
    msg=enc({'alg':'HS256','typ':'JWT'})+b'.'+enc({'sub':sub,'role':'authenticated','aud':'authenticated','exp':int(time.time())+120})
    return (msg+b'.'+base64.urlsafe_b64encode(hmac.new(secret,msg,hashlib.sha256).digest()).rstrip(b'=')).decode()
def get(path, headers=None):
    req=urllib.request.Request(base+path,headers=headers or {})
    try:
        with urllib.request.urlopen(req,timeout=15) as response:
            return response.status,response.read()
    except urllib.error.HTTPError as error:
        return error.code,error.read()
def check(name,actual,expected):
    assert actual==expected, f'{name}: expected {expected}, got {actual}'
    print(json.dumps({'message':'API_CHECK','check':name,'result':'pass','status':actual}),flush=True)
check('health',get('/healthz')[0],200)
check('auth_health',get('/auth/v1/health')[0],200)
check('missing_api_key',get('/rest/v1/rosters')[0],401)
check('invalid_jwt',get('/rest/v1/rosters',{'apikey':anon,'Authorization':'Bearer invalid','Accept-Profile':'fulbo_parejo'})[0],401)
headers={'apikey':anon,'Authorization':'Bearer '+jwt('00000000-0000-0000-0000-000000000000'),'Accept-Profile':'fulbo_parejo'}
for table in ['rosters','players']:
    status,data=get('/rest/v1/'+table+'?select=id',headers)
    check('unrelated_user_'+table+'_status',status,200)
    check('unrelated_user_'+table+'_rows',len(json.loads(data)),0)
check('metrics_requires_user',get('/functions/v1/admin-metrics',{'apikey':anon})[0],401)
print(json.dumps({'message':'API_READ_ONLY_PROBES_PASSED'}),flush=True)
