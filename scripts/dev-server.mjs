import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../', import.meta.url)));
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const srv=http.createServer(async(req,res)=>{
  try{
    const decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const full=resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
    if (!full.startsWith(root+sep)) {res.writeHead(403);res.end('Forbidden');return;}
    const info=await stat(full);if(!info.isFile())throw Error('not a file');
    const bytes=await readFile(full);res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
srv.listen(port,'0.0.0.0',()=>console.log(`Arcana development server http://localhost:${port}`));
