"""UNITEKE Connect — WSGI application; deploy behind HTTPS."""
import os, json, sqlite3, secrets, hashlib, hmac, time, re, io, base64, html, argparse, getpass
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlsplit
from PIL import Image, ImageOps
ROOT=Path(__file__).resolve().parent
DB=Path(os.getenv('CONNECT_DB',str(ROOT/'data'/'connect.sqlite3')))
PREFIX=os.getenv('CONNECT_PREFIX','').rstrip('/')
PUBLIC=os.getenv('CONNECT_PUBLIC_URL','').rstrip('/')
SECURE=os.getenv('CONNECT_SECURE_COOKIE','1')=='1'
REVIEW=os.getenv('CONNECT_REVIEW','0')=='1'
CODE=os.getenv('CONNECT_STUDENT_CODE','')
CATS=['Alimentação','Beleza e estética','Comércio','Construção e reformas','Educação','Eventos','Moda e acessórios','Saúde e bem-estar','Serviços profissionais','Tecnologia','Transporte','Outros']
Image.MAX_IMAGE_PIXELS=20_000_000

class ClosingConnection(sqlite3.Connection):
    def __exit__(self, *args):
        try:return super().__exit__(*args)
        finally:self.close()

def db():
    DB.parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(DB,timeout=15,factory=ClosingConnection);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c

def init():
    with db() as c:
        c.executescript('''PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS businesses(id TEXT PRIMARY KEY,student TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,whatsapp TEXT NOT NULL,instagram TEXT NOT NULL,banner BLOB NOT NULL,created INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1,consent_at INTEGER);
        CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,reason TEXT NOT NULL,created INTEGER NOT NULL,resolved INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS admins(username TEXT PRIMARY KEY,password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,username TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,start INTEGER NOT NULL,count INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,username TEXT NOT NULL,action TEXT NOT NULL,subject TEXT,created INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS ix_active ON businesses(active,created);
        ''')
        for table,col,typ in [('businesses','consent_at','INTEGER'),('reports','resolved','INTEGER NOT NULL DEFAULT 0')]:
            if col not in [r[1] for r in c.execute('PRAGMA table_info('+table+')')]: c.execute(f'ALTER TABLE {table} ADD COLUMN {col} {typ}')

def digest(v):return hashlib.sha256(v.encode()).hexdigest()
def password_hash(p,salt=None):
    salt=salt or secrets.token_hex(16);return salt+':'+hashlib.scrypt(p.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
def verify(p,stored):
    try:return hmac.compare_digest(password_hash(p,stored.split(':')[0]),stored)
    except (ValueError,TypeError):return False

def limited(key,maxn,period):
    now=int(time.time())
    with db() as c:
        c.execute('BEGIN IMMEDIATE'); c.execute('DELETE FROM limits WHERE start<?',(now-86400,));r=c.execute('SELECT * FROM limits WHERE key=?',(key,)).fetchone()
        if r and now-r['start']<period:
            if r['count']>=maxn:return True
            c.execute('UPDATE limits SET count=count+1 WHERE key=?',(key,))
        else:c.execute('INSERT OR REPLACE INTO limits VALUES(?,?,1)',(key,now))
    return False

def field(d,k,n,required=False):
    x=d.get(k,'')
    if not isinstance(x,str):raise ValueError('Campo inválido: '+k)
    x=x.strip()
    if len(x)>n or (required and not x):raise ValueError('Confira o campo '+k+'.')
    return x

def image_bytes(s):
    if not isinstance(s,str):raise ValueError('Envie um banner.')
    m=re.fullmatch(r'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)',s)
    if not m:raise ValueError('Formato de banner inválido.')
    try:
        raw=base64.b64decode(m[2],validate=True)
        if len(raw)>5*1024*1024:raise ValueError()
        with Image.open(io.BytesIO(raw)) as im:
            if im.format not in ('JPEG','PNG','WEBP') or im.width*im.height>20_000_000:raise ValueError()
            im=ImageOps.exif_transpose(im).convert('RGB');im.thumbnail((1600,1600));out=io.BytesIO();im.save(out,'JPEG',quality=88);return out.getvalue()
    except Exception:raise ValueError('Banner inválido ou muito grande.')

def business_fields(d):
    vals=[field(d,'student',120,True),field(d,'name',100,True),field(d,'category',80,True),field(d,'description',280),field(d,'whatsapp',13,True),field(d,'instagram',30)]
    if vals[2] not in CATS or not re.fullmatch(r'55[1-9][0-9]{9,10}',vals[4]) or (vals[5] and not re.fullmatch(r'[A-Za-z0-9_.]{1,30}',vals[5])):raise ValueError('Confira categoria, WhatsApp e Instagram.')
    return vals

def session(e):
    try:
        c=SimpleCookie();c.load(e.get('HTTP_COOKIE',''));token=c['connect_session'].value
        if not re.fullmatch(r'[A-Za-z0-9_-]{43}',token):return None
        with db() as con:r=con.execute('SELECT * FROM sessions WHERE token_hash=? AND expires>?',(digest(token),int(time.time()))).fetchone()
        return r
    except (KeyError,ValueError):return None

def cookie(value,maxage):return ('Set-Cookie',f'connect_session={value}; Path={PREFIX or "/"}; HttpOnly; SameSite=Strict; Max-Age={maxage}'+('; Secure' if SECURE else ''))
def payload(e):
    if e.get('CONTENT_TYPE','').split(';')[0]!='application/json':raise ValueError('Formato inválido.')
    n=int(e.get('CONTENT_LENGTH') or 0)
    if not 0<n<=7*1024*1024:raise ValueError('Tamanho inválido.')
    d=json.loads(e['wsgi.input'].read(n))
    if not isinstance(d,dict):raise ValueError('Dados inválidos.')
    return d

def audit(c,u,a,subject):c.execute('INSERT INTO audit(username,action,subject,created) VALUES(?,?,?,?)',(u,a,subject,int(time.time())))

def application(e,start):
    def res(status,data,ctype='application/json; charset=utf-8',extra=()):
        if not isinstance(data,bytes):data=json.dumps(data,ensure_ascii=False).encode()
        headers=[('Content-Type',ctype),('Content-Length',str(len(data))),('Cache-Control','no-store'),('X-Content-Type-Options','nosniff'),('Referrer-Policy','no-referrer'),('X-Frame-Options','DENY'),('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")]+list(extra)
        start(status,headers);return [data]
    def err(status,msg):return res(status,{'error':msg})
    p=e.get('PATH_INFO','/');method=e.get('REQUEST_METHOD','GET');ip=e.get('REMOTE_ADDR','unknown');now=int(time.time())
    if PREFIX and p==PREFIX:return res('308 Permanent Redirect',b'',extra=[('Location',PREFIX+'/')])
    if PREFIX and p.startswith(PREFIX+'/'):p=p[len(PREFIX):]
    try:
        if method=='GET':
            if p in ('/','/index.html'):
                t=(ROOT/'index.html').read_text();
                if CODE:t=t.replace('<!--STUDENT_CODE-->','<label>Código de acesso da turma<input name="student_code" required maxlength="80" autocomplete="off"></label>')
                if PUBLIC:
                    bid=parse_qs(e.get('QUERY_STRING','')).get('negocio',[''])[0]
                    if re.fullmatch(r'[a-f0-9]{32}',bid):
                        with db() as c:r=c.execute('SELECT name,description FROM businesses WHERE id=? AND active=1',(bid,)).fetchone()
                        if r:
                            title=html.escape(r['name']+' | UNITEKE Connect',quote=True);desc=html.escape(r['description'] or 'Conheça este negócio da comunidade UNITEKE.',quote=True);url=html.escape(PUBLIC+'/?negocio='+bid,quote=True);img=html.escape(PUBLIC+'/banner/'+bid,quote=True);t=t.replace('</head>',f'<meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:url" content="{url}"><meta property="og:image" content="{img}"></head>')
                return res('200 OK',t.encode(),'text/html; charset=utf-8')
            if p=='/admin':return res('200 OK',(ROOT/'admin.html').read_bytes(),'text/html; charset=utf-8')
            if p=='/logo.webp':return res('200 OK',(ROOT/'logo.webp').read_bytes(),'image/webp')
            if p=='/api/businesses':
                with db() as c:rows=[dict(r) for r in c.execute('SELECT id,name,category,description,whatsapp,instagram FROM businesses WHERE active=1 ORDER BY created DESC')]
                for r in rows:r['banner']='banner/'+r['id']
                return res('200 OK',rows)
            if re.fullmatch(r'/banner/[a-f0-9]{32}',p):
                with db() as c:r=c.execute('SELECT banner FROM businesses WHERE id=? AND active=1',(p[8:],)).fetchone()
                return res('200 OK',r[0],'image/jpeg') if r else err('404 Not Found','Não encontrado.')
            if p=='/api/admin':
                s=session(e)
                if not s:return err('401 Unauthorized','Entre no painel.')
                with db() as c:
                    businesses=[dict(r) for r in c.execute('SELECT id,student,name,category,description,whatsapp,instagram,created,active,consent_at FROM businesses ORDER BY created DESC')];reports=[dict(r) for r in c.execute('SELECT r.*,b.name AS business_name FROM reports r JOIN businesses b ON b.id=r.business_id ORDER BY r.created DESC')]
                return res('200 OK',{'username':s['username'],'csrf':s['csrf'],'businesses':businesses,'reports':reports})
            if re.fullmatch(r'/api/admin/banner/[a-f0-9]{32}',p):
                if not session(e):return err('401 Unauthorized','Entre no painel.')
                with db() as c:r=c.execute('SELECT banner FROM businesses WHERE id=?',(p.rsplit('/',1)[1],)).fetchone()
                return res('200 OK',r[0],'image/jpeg') if r else err('404 Not Found','Não encontrado.')
            return err('404 Not Found','Não encontrado.')
        if method!='POST':return err('405 Method Not Allowed','Método não permitido.')
        if e.get('HTTP_SEC_FETCH_SITE')=='cross-site':return err('403 Forbidden','Origem inválida.')
        origin=e.get('HTTP_ORIGIN','')
        if origin and PUBLIC:
            u=urlsplit(PUBLIC)
            if origin!=u.scheme+'://'+u.netloc:return err('403 Forbidden','Origem inválida.')
        d=payload(e)
        if p=='/api/login':
            u=field(d,'username',80,True);pw=field(d,'password',256,True)
            if limited('login-ip:'+ip,15,900) or limited('login-user:'+digest(u.lower()),10,900):return err('429 Too Many Requests','Muitas tentativas. Aguarde 15 minutos.')
            with db() as c:
                r=c.execute('SELECT password FROM admins WHERE username=?',(u,)).fetchone()
                valid=verify(pw,r[0] if r else '0'*32+':'+'0'*128)
                if not (r and valid):return err('401 Unauthorized','Usuário ou senha incorretos.')
                token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(32);c.execute('DELETE FROM sessions WHERE expires<?',(now,));c.execute('INSERT INTO sessions VALUES(?,?,?,?)',(digest(token),u,csrf,now+28800));audit(c,u,'login','')
            return res('200 OK',{'ok':True},extra=[cookie(token,28800)])
        if p.startswith('/api/admin/') or p=='/api/logout':
            s=session(e)
            if not s:return err('401 Unauthorized','Sessão expirada.')
            if not hmac.compare_digest(e.get('HTTP_X_CSRF_TOKEN',''),s['csrf']):return err('403 Forbidden','Solicitação inválida.')
            u=s['username']
            with db() as c:
                if p=='/api/logout':c.execute('DELETE FROM sessions WHERE token_hash=?',(s['token_hash'],));return res('200 OK',{'ok':True},extra=[cookie('',0)])
                if p=='/api/admin/report':
                    rid=d.get('id');
                    if not isinstance(rid,int):raise ValueError('Denúncia inválida.')
                    c.execute('UPDATE reports SET resolved=1 WHERE id=?',(rid,));audit(c,u,'resolve-report',str(rid));return res('200 OK',{'ok':True})
                bid=field(d,'id',32,True)
                if not c.execute('SELECT 1 FROM businesses WHERE id=?',(bid,)).fetchone():return err('404 Not Found','Negócio não encontrado.')
                if p=='/api/admin/status':
                    active=d.get('active')
                    if type(active)!=bool:raise ValueError('Status inválido.')
                    c.execute('UPDATE businesses SET active=? WHERE id=?',(int(active),bid));audit(c,u,'publish' if active else 'hide',bid)
                elif p=='/api/admin/delete':c.execute('DELETE FROM reports WHERE business_id=?',(bid,));c.execute('DELETE FROM businesses WHERE id=?',(bid,));audit(c,u,'delete',bid)
                elif p=='/api/admin/edit':
                    vals=business_fields(d);c.execute('UPDATE businesses SET student=?,name=?,category=?,description=?,whatsapp=?,instagram=? WHERE id=?',(*vals,bid))
                    if d.get('banner'):c.execute('UPDATE businesses SET banner=? WHERE id=?',(image_bytes(d['banner']),bid))
                    audit(c,u,'edit',bid)
                else:return err('404 Not Found','Não encontrado.')
            return res('200 OK',{'ok':True})
        if p=='/api/businesses':
            if limited('submit:'+ip,8,3600):return err('429 Too Many Requests','Limite de cadastros atingido. Tente mais tarde.')
            if d.get('website') or d.get('consent') is not True:raise ValueError('Confirme a autorização.')
            if CODE and not hmac.compare_digest(field(d,'student_code',80),CODE):raise ValueError('Código da turma incorreto.')
            vals=business_fields(d);banner=image_bytes(d.get('banner'));bid=secrets.token_hex(16)
            with db() as c:
                c.execute('BEGIN IMMEDIATE')
                if c.execute('SELECT 1 FROM businesses WHERE lower(name)=lower(?) AND whatsapp=?', (vals[1],vals[4])).fetchone():return err('409 Conflict','Já existe um cadastro com este nome e WhatsApp. Solicite alteração à secretaria.')
                c.execute('INSERT INTO businesses(id,student,name,category,description,whatsapp,instagram,banner,created,active,consent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(bid,*vals,banner,now,int(not REVIEW),now))
            return res('201 Created',{'id':bid,'pending':REVIEW})
        if p=='/api/report':
            if limited('report:'+ip,10,3600):return err('429 Too Many Requests','Limite de denúncias atingido.')
            bid=field(d,'id',32,True);reason=field(d,'reason',500,True)
            with db() as c:
                if not c.execute('SELECT 1 FROM businesses WHERE id=? AND active=1',(bid,)).fetchone():return err('404 Not Found','Negócio não encontrado.')
                c.execute('INSERT INTO reports(business_id,reason,created) VALUES(?,?,?)',(bid,reason,now))
            return res('201 Created',{'ok':True})
        return err('404 Not Found','Não encontrado.')
    except (ValueError,TypeError,UnicodeError) as ex:return err('400 Bad Request',str(ex)[:200])
    except Exception:
        import traceback;traceback.print_exc();return err('500 Internal Server Error','Não foi possível concluir. Tente novamente.')

init()
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['serve','admin','backup']);parser.add_argument('value',nargs='?');parser.add_argument('--port',type=int,default=8000);a=parser.parse_args()
    if a.command=='admin':
        if not a.value or not re.fullmatch(r'[A-Za-z0-9_.@-]{3,80}',a.value):parser.error('Informe um usuário válido.')
        pw=getpass.getpass('Senha (mínimo 12 caracteres): ')
        if len(pw)<12 or len(pw)>256 or pw!=getpass.getpass('Repita a senha: '):parser.error('Senha inválida ou não coincide.')
        with db() as c:c.execute('INSERT OR REPLACE INTO admins VALUES(?,?)',(a.value,password_hash(pw)));c.execute('DELETE FROM sessions WHERE username=?',(a.value,))
        print('Administrador configurado.')
    elif a.command=='backup':
        if not a.value:parser.error('Informe arquivo de destino.')
        with db() as c,sqlite3.connect(a.value) as out:c.backup(out)
        print('Backup realizado.')
    else:
        from wsgiref.simple_server import make_server
        print(f'Teste local: http://127.0.0.1:{a.port}{PREFIX}/');make_server('127.0.0.1',a.port,application).serve_forever()
