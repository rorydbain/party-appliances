import { Readable } from 'node:stream';
export default async function proxy(req,res) {
  if(!['GET','HEAD','POST','DELETE'].includes(req.method)) {res.statusCode=405;return res.end();}
  const backend=process.env.FRAME_GALLERY_BACKEND;
  if(!backend || !/^https:\/\//.test(backend)) {res.statusCode=503;return res.end('Gallery is being prepared.');}
  const incoming=new URL(req.url,'https://gallery.invalid');
  const path=incoming.searchParams.get('__path')||'';incoming.searchParams.delete('__path');
  const target=new URL(backend);target.pathname='/'+path;target.search=incoming.search;
  const headers=new Headers({accept:req.headers.accept||'*/*'});
  for(const name of ['content-type','cookie','origin','range','if-range','if-none-match','if-modified-since']) if(req.headers[name]) headers.set(name,req.headers[name]);
  let body;if(['POST','DELETE'].includes(req.method)){if(req.body!==undefined){body=Buffer.isBuffer(req.body)?req.body:typeof req.body==='string'?req.body:req.headers['content-type']?.includes('application/x-www-form-urlencoded')?new URLSearchParams(req.body).toString():JSON.stringify(req.body);}else{const chunks=[];let n=0;for await(const chunk of req){n+=chunk.length;if(n>1024*1024){res.statusCode=413;return res.end();}chunks.push(chunk);}body=Buffer.concat(chunks);}}
  try {
    const response=await fetch(target,{method:req.method,headers,body,redirect:'manual'});
    res.statusCode=response.status;
    const contentType=response.headers.get('content-type')||'';
    for(const [key,value] of response.headers) if(!['content-security-policy','transfer-encoding','content-encoding','content-length','nel','report-to'].includes(key)) res.setHeader(key,value);
    res.setHeader('x-party-gallery','cloudflare-r2');
    if(contentType.includes('text/html')) {res.setHeader('Cache-Control','private, no-cache, max-age=0');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Site-Region',process.env.VERCEL_REGION||'local');}
    if(!response.body||req.method==='HEAD') return res.end();
    Readable.fromWeb(response.body).pipe(res);
  } catch {res.statusCode=502;res.end('Gallery temporarily unavailable.');}
}
