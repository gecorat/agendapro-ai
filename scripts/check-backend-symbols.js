// Verificador de simbolos no resueltos en el backend.
//
// POR QUE EXISTE: esbuild solo valida SINTAXIS. Un helper usado sin importar parsea
// perfecto y revienta en runtime con ReferenceError — y si la llamada esta dentro de un
// try/catch, el error se traga y la funcion "anda" pero no hace nada. Asi se cayeron los
// recordatorios, la alerta de cita pendiente y la cancelacion por link sin que nada avisara.
//
// Antes de analizar se eliminan comentarios y literales de texto, si no las palabras en
// castellano de los prompts y comentarios dan falsos positivos.
const fs=require("fs"),path=require("path");
function walk(d,out=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p,out);else if(/\.ts$/.test(p))out.push(p);}return out;}

function stripNonCode(src){
  let out="", i=0, n=src.length;
  while(i<n){
    const c=src[i], c2=src.slice(i,i+2);
    if(c2==="//"){ while(i<n && src[i]!=="\n") i++; continue; }
    if(c2==="/*"){ i+=2; while(i<n && src.slice(i,i+2)!=="*/") i++; i+=2; continue; }
    if(c==='"'||c==="'"){ const q=c; i++; while(i<n && src[i]!==q){ if(src[i]==="\\")i++; i++; } i++; out+=' "" '; continue; }
    if(c==="`"){ // template: se conserva SOLO el interior de ${...}, que si es codigo
      i++;
      while(i<n && src[i]!=="`"){
        if(src[i]==="\\"){ i+=2; continue; }
        if(src.slice(i,i+2)==="${"){ i+=2; let d=1,start=i;
          while(i<n&&d>0){ if(src[i]==="{")d++; else if(src[i]==="}")d--; if(d>0)i++; }
          out+=" "+stripNonCode(src.slice(start,i))+" "; i++; continue; }
        i++;
      }
      i++; out+=' "" '; continue;
    }
    out+=c; i++;
  }
  return out;
}

const GLOBALS=new Set(["console","JSON","Math","Date","Promise","Object","Array","String","Number","Boolean","Error","Map","Set","RegExp","fetch","Request","Response","URL","URLSearchParams","crypto","isNaN","parseInt","parseFloat","setTimeout","clearTimeout","encodeURIComponent","decodeURIComponent","Deno","globalThis","TextEncoder","TextDecoder","atob","btoa","Intl","AbortController","structuredClone","Headers","FormData","Blob","File","Uint8Array","Symbol","BigInt","WeakMap","Proxy","Reflect","queueMicrotask"]);
const CSS_FNS=["rgba","rgb","hsl","hsla","url","calc","var","translate","scale","linear-gradient"];
const KEYWORDS=new Set(["if","for","while","switch","catch","return","typeof","await","new","function","import","export","do","else","throw","of","in","instanceof","delete","void","yield","async","case","default"]);

let problems=[];
for(const f of walk("base44")){
  const raw=fs.readFileSync(f,"utf8");
  const code=stripNonCode(raw);
  const declared=new Set(GLOBALS);
  for(const m of raw.matchAll(/import\s*\{([^}]*)\}\s*from/g)) m[1].split(",").forEach(x=>{const nm=x.trim().split(/\s+as\s+/).pop(); if(nm)declared.add(nm);});
  for(const m of raw.matchAll(/import\s+(\w+)\s+from/g)) declared.add(m[1]);
  for(const m of code.matchAll(/(?:const|let|var)\s+([\w$]+)/g)) declared.add(m[1]);
  for(const m of code.matchAll(/function\s+([\w$]+)/g)) declared.add(m[1]);
  for(const m of code.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) m[1].split(",").forEach(x=>{const nm=x.trim().split(":").pop().trim().split("=")[0].trim(); if(/^[\w$]+$/.test(nm))declared.add(nm);});
  for(const m of code.matchAll(/(?:const|let|var)\s*\[([^\]]*)\]\s*=/g)) m[1].split(",").forEach(x=>{const nm=x.trim(); if(/^[\w$]+$/.test(nm))declared.add(nm);});
  for(const m of code.matchAll(/\(([^)]*)\)\s*=>/g)) m[1].split(",").forEach(x=>{const nm=x.trim().split(/[:=]/)[0].trim().replace(/^\.\.\./,""); if(/^[\w$]+$/.test(nm))declared.add(nm);});
  for(const m of code.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g)) m[1].split(",").forEach(x=>{const nm=x.trim().split(/[:=]/)[0].trim().replace(/^\.\.\./,""); if(/^[\w$]+$/.test(nm))declared.add(nm);});
  for(const m of code.matchAll(/catch\s*\(\s*([\w$]+)/g)) declared.add(m[1]);
  for(const m of code.matchAll(/for\s*\(\s*(?:const|let|var)\s+([\w$]+)/g)) declared.add(m[1]);
  for(const m of code.matchAll(/([\w$]+)\s*:\s*(?:async\s*)?(?:function|\()/g)) declared.add(m[1]);

  for(const m of code.matchAll(/(^|[^.\w$])([a-zA-Z_$][\w$]*)\s*\(/gm)){
    const name=m[2];
    if(KEYWORDS.has(name) || CSS_FNS.includes(name)) continue;
    if(!declared.has(name)) problems.push(`${f}: ${name}()`);
  }
}
const uniq=[...new Set(problems)];
if(uniq.length){ console.log("SIMBOLOS NO RESUELTOS:\n"+uniq.join("\n")); process.exit(1); }
console.log("OK: ningun simbolo sin resolver en base44/ ("+walk("base44").length+" archivos)");
