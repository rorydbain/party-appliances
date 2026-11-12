const json = value => JSON.stringify(String(value || '')).replace(/</g, '\\u003c');

export function uploadBody({ endpoint, event }) {
  return `<section class="upload-intro"><p class="muted">Add to the album</p><h1>Share your photos.</h1><p>Choose as many photographs as you like. Keep this page open while they upload; a failed photo can be retried without starting the rest again.</p></section>
  <section class="upload-panel">
    <div class="passcode"><label><span>Shared passcode</span><input id="passcode" type="password" autocomplete="current-password" placeholder="Enter the party passcode"></label><button id="remember" type="button">Continue</button></div>
    <div id="picker" class="hidden">
      <div id="drop" class="drop" role="button" tabindex="0"><div><strong>Drop photographs here</strong><p>or choose them from your phone or computer</p><label class="pick" for="files">Choose photos</label><input class="hidden" id="files" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif" multiple></div></div>
      <div class="upload-controls"><button id="start" type="button" disabled>Upload photos</button></div>
      <p id="summary" class="upload-summary" aria-live="polite"></p><div id="queue" class="queue"></div>
    </div>
  </section>
  <script>(()=>{
    const endpoint=${json(endpoint)},event=${json(event)},$=id=>document.getElementById(id);
    const passcode=$('passcode'),picker=$('picker'),files=$('files'),drop=$('drop'),queue=$('queue'),start=$('start'),summary=$('summary');
    const jobs=[];let running=0;
    passcode.value=sessionStorage.getItem('photo-upload-passcode')||'';
    function unlock(){if(!passcode.value.trim()){passcode.focus();return}sessionStorage.setItem('photo-upload-passcode',passcode.value);picker.classList.remove('hidden');$('remember').textContent='Passcode saved';}
    $('remember').onclick=unlock;passcode.onkeydown=e=>{if(e.key==='Enter')unlock()};if(passcode.value)unlock();
    function token(){return [...crypto.getRandomValues(new Uint8Array(16))].map(n=>n.toString(16).padStart(2,'0')).join('')}
    function row(job){const el=document.createElement('div');el.className='upload-row';el.innerHTML='<img alt=""><div><div class="upload-name"></div><div class="upload-status"></div></div><button class="retry hidden" type="button">Retry</button>';el.querySelector('.upload-name').textContent=job.file.name;const image=el.querySelector('img'),url=URL.createObjectURL(job.file);image.onload=()=>URL.revokeObjectURL(url);image.src=url;el.querySelector('.retry').onclick=()=>{job.state='queued';update(job,'Waiting');pump()};job.el=el;queue.append(el);update(job,'Waiting')}
    function update(job,text,failed=false){job.el.querySelector('.upload-status').textContent=text;job.el.querySelector('.retry').classList.toggle('hidden',!failed);const done=jobs.filter(j=>j.state==='done').length,errors=jobs.filter(j=>j.state==='failed').length;summary.textContent=jobs.length?done+' of '+jobs.length+' uploaded'+(errors?' · '+errors+' need attention':''):'';start.disabled=!jobs.some(j=>j.state==='ready')}
    function add(list){for(const file of list){if(!file.type.startsWith('image/')&&!/\\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))continue;const job={file,token:token(),state:'ready'};jobs.push(job);row(job)}start.disabled=!jobs.some(j=>j.state==='ready')}
    files.onchange=()=>{add(files.files);files.value=''};drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag')};drop.ondragleave=()=>drop.classList.remove('drag');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag');add(e.dataTransfer.files)};drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();files.click()}};
    function loadImage(file){return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('This format could not be read by this browser'))};image.src=url})}
    async function jpeg(image,max,quality){const scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare this photograph')),'image/jpeg',quality))}
    async function prepare(job){update(job,'Preparing…');const image=await loadImage(job.file);const thumb=await jpeg(image,720,.82);let original;if(/image\\/jpeg/i.test(job.file.type)&&job.file.size<39*1024*1024)original=job.file;else original=await jpeg(image,6000,.92);return {original,thumb}}
    function send(job,prepared){return new Promise((resolve,reject)=>{const form=new FormData(),createdAt=job.file.lastModified?new Date(job.file.lastModified).toISOString():new Date().toISOString();form.set('metadata',JSON.stringify({id:'guest-'+job.token,token:job.token,event,kind:'photo',createdAt,originalName:job.file.name}));form.append('files',prepared.original,'original.jpg');form.append('files',prepared.thumb,'thumb.jpg');const xhr=new XMLHttpRequest();xhr.open('POST',endpoint);xhr.setRequestHeader('X-Upload-Password',passcode.value);xhr.upload.onprogress=e=>{if(e.lengthComputable)update(job,'Uploading · '+Math.round(e.loaded/e.total*100)+'%');else update(job,'Uploading…')};xhr.onerror=()=>reject(new Error('Network error — check your connection'));xhr.onload=()=>{let message='Upload failed';try{message=JSON.parse(xhr.responseText).error||message}catch{}if(xhr.status>=200&&xhr.status<300)resolve();else if(xhr.status===401)reject(new Error('The shared passcode is not correct'));else reject(new Error(message))};xhr.send(form)})}
    async function run(job){running++;job.state='uploading';try{const prepared=await prepare(job);await send(job,prepared);job.state='done';update(job,'Uploaded')}catch(error){job.state='failed';update(job,error.message||'Upload failed',true)}finally{running--;pump()}}
    function pump(){while(running<3){const job=jobs.find(j=>j.state==='queued');if(!job)break;run(job)}}
    start.onclick=()=>{for(const job of jobs)if(job.state==='ready'||job.state==='failed'){job.state='queued';update(job,'Waiting')}pump()};
  })()</script>`;
}
