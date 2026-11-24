import os,tempfile,io,json,base64,unittest
from PIL import Image
from pathlib import Path
T=tempfile.TemporaryDirectory();os.environ['CONNECT_DB']=str(Path(T.name)/'test.sqlite3');os.environ['CONNECT_SECURE_COOKIE']='0';os.environ['CONNECT_PREFIX']='/connect';os.environ['CONNECT_PUBLIC_URL']='https://example.test/connect'
import app
class Flow(unittest.TestCase):
 def request(self,path,body=None,cookie='',csrf='',origin=''):
    output={};p,_,q=path.partition('?');raw=json.dumps(body).encode() if body is not None else b''
    env={'REQUEST_METHOD':'POST' if body is not None else 'GET','PATH_INFO':'/connect'+p,'QUERY_STRING':q,'REMOTE_ADDR':'127.0.0.1','CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(raw)),'wsgi.input':io.BytesIO(raw),'HTTP_COOKIE':cookie,'HTTP_X_CSRF_TOKEN':csrf,'HTTP_ORIGIN':origin}
    def start(s,h):output.update(status=int(s.split()[0]),headers=dict(h))
    data=b''.join(app.application(env,start));return output,data
 def test_full(self):
    with app.db() as c:c.execute('INSERT INTO admins VALUES(?,?)',('secretaria',app.password_hash('test-password-123')))
    pic=io.BytesIO();Image.new('RGB',(240,135),'navy').save(pic,'PNG');banner='data:image/png;base64,'+base64.b64encode(pic.getvalue()).decode()
    d=dict(student='Aluno teste privado',name='Empresa teste',category='Alimentação',description='Café',whatsapp='5511999999999',instagram='teste',banner=banner,consent=True)
    self.assertEqual(self.request('/api/admin')[0]['status'],401)
    self.assertEqual(self.request('/api/businesses',dict(d,consent=False))[0]['status'],400)
    self.assertEqual(self.request('/api/businesses',dict(d,banner='bad'))[0]['status'],400)
    self.assertEqual(self.request('/api/businesses',d,origin='https://attacker.test')[0]['status'],403)
    r,b=self.request('/api/businesses',d);self.assertEqual(r['status'],201);bid=json.loads(b)['id']
    self.assertEqual(self.request('/api/businesses',d)[0]['status'],409)
    rows=json.loads(self.request('/api/businesses')[1]);self.assertEqual(rows[0]['id'],bid);self.assertNotIn('student',rows[0]);self.assertEqual(self.request('/banner/'+bid)[0]['status'],200)
    self.assertIn(b'og:image',self.request('/?negocio='+bid)[1]);self.assertEqual(self.request('/api/admin/banner/'+bid)[0]['status'],401)
    self.assertEqual(self.request('/api/report',{'id':bid,'reason':'Teste'})[0]['status'],201)
    self.assertEqual(self.request('/api/login',{'username':'secretaria','password':'wrong'})[0]['status'],401)
    r,_=self.request('/api/login',{'username':'secretaria','password':'test-password-123'});self.assertEqual(r['status'],200);cookie=r['headers']['Set-Cookie'].split(';')[0]
    state=json.loads(self.request('/api/admin',cookie=cookie)[1]);csrf=state['csrf'];self.assertEqual(state['businesses'][0]['student'],d['student']);rid=state['reports'][0]['id']
    self.assertEqual(self.request('/api/admin/status',{'id':bid,'active':False},cookie)[0]['status'],403)
    self.assertEqual(self.request('/api/admin/status',{'id':bid,'active':False},cookie,csrf)[0]['status'],200)
    self.assertEqual(json.loads(self.request('/api/businesses')[1]),[]);self.assertEqual(self.request('/banner/'+bid)[0]['status'],404)
    self.assertEqual(self.request('/api/admin/banner/'+bid,cookie=cookie)[0]['status'],200)
    self.assertEqual(self.request('/api/admin/edit',dict(d,id=bid,name='Novo'),cookie,csrf)[0]['status'],200)
    self.assertEqual(self.request('/api/admin/status',{'id':bid,'active':True},cookie,csrf)[0]['status'],200)
    self.assertEqual(json.loads(self.request('/api/businesses')[1])[0]['name'],'Novo')
    self.assertEqual(self.request('/api/admin/report',{'id':rid},cookie,csrf)[0]['status'],200)
    self.assertEqual(self.request('/api/admin/delete',{'id':bid},cookie,csrf)[0]['status'],200)
    self.assertEqual(json.loads(self.request('/api/businesses')[1]),[])
    self.assertEqual(self.request('/api/logout',{},cookie,csrf)[0]['status'],200);self.assertEqual(self.request('/api/admin',cookie=cookie)[0]['status'],401)
    self.assertEqual(self.request('/admin')[0]['status'],200)
    app.REVIEW=True
    r,b=self.request('/api/businesses',dict(d,name='Em análise'));self.assertEqual(r['status'],201);self.assertTrue(json.loads(b)['pending']);self.assertEqual(json.loads(self.request('/api/businesses')[1]),[])
    app.CODE='abc';self.assertEqual(self.request('/api/businesses',dict(d,name='Sem código'))[0]['status'],400)
if __name__=='__main__':unittest.main(verbosity=2)
