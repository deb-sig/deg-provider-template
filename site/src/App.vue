<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import RulesEditor from './RulesEditor.vue';
import RulesCards from './RulesCards.vue';
import BillTable from './BillTable.vue';
import CodeBlock from './CodeBlock.vue';
import { parse, stringify } from 'yaml';
import { detectLocale, translate } from './i18n.mjs';
import { providerName, displayTag, names } from './presentation.mjs';
import { selectRelease, parseRoute, knownIssueForRelease } from './catalog.mjs';
import { buildBundleText, buildShareFiles, shareToMirato } from './share.mjs';
const repo='https://github.com/deb-sig/deg-provider-template';
const readSaved=(key)=>{try{return localStorage.getItem(key);}catch{return null;}};
const locale=ref(detectLocale(readSaved('template-hub-locale'),navigator.languages));
const theme=ref(readSaved('deg-theme-mode')||'system');
const t=(key)=>translate(locale.value,key);
const name=(p)=>providerName(p,locale.value);
const tag=(v)=>displayTag(v,locale.value);
const index=ref(null), issues=ref(null), catalogError=ref(''), route=ref(parseRoute(location.hash));
const query=ref(''), category=ref('all'), format=ref('all');
const reqName=ref(''), reqFormat=ref('CSV'), reqHeaders=ref(''), reqSample=ref('');
const resources=ref(null), resourceError=ref(''), notice=ref('');
const assetUrl=(p)=>`${import.meta.env.BASE_URL}${p}`;
const href=(p,v=p.latest)=>`#/template/${encodeURIComponent(p.id)}/${encodeURIComponent(v)}`;
const buildIssue=(title,platform,fmt,headers,sample)=>repo+'/issues/new?title='+encodeURIComponent(title)+'&body='+encodeURIComponent([
 '### '+t('issuePlatform'), platform||'', '',
 '### '+t('issueFormat'), fmt||t('unknown'), '',
 '### '+t('issueHeaders'), headers&&headers.length?headers.join(','):t('issueHeadersHint'), '',
 '### '+t('issueSample'), (sample&&sample.trim())||t('issueSampleHint'), '',
 '### '+t('issueExpected'), t('issueExpectedHint'), '',
 '<!-- '+t('issuePrivacy')+' -->'].join('\n'));
const reportUrl=(id='',rev='')=>buildIssue('[Template] '+id+(rev?'@'+rev:'')+' — ', id, release.value?.meta?.fileFormat?.toUpperCase()||'', release.value?.meta?.sourceHeaders||[]);
const requestUrl=()=>buildIssue('[Template request] '+(reqName.value||''), reqName.value, reqFormat.value, reqHeaders.value.split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean), reqSample.value);
const providers=computed(()=>index.value?.providers||[]);
const categories=computed(()=>['all',...new Set(providers.value.map(p=>p.category))]);
const formats=computed(()=>[...new Set(providers.value.flatMap(p=>p.formats))].sort());
const filtered=computed(()=>providers.value.filter(p=>(category.value==='all'||p.category===category.value)&&(format.value==='all'||p.formats.includes(format.value))&&[p.id,p.name,...Object.values(names[p.id]||{}),...p.tags,...p.tags.map(tag),...p.formats].join(' ').toLowerCase().includes(query.value.trim().toLowerCase())));
const provider=computed(()=>providers.value.find(p=>p.id===route.value.id));
const selection=computed(()=>{if(route.value.page!=='detail')return {};if(!provider.value)return {error:'notFound'};try{return {release:selectRelease(provider.value,route.value.revision)};}catch{return {error:'unknownRevision'};}});
const release=computed(()=>selection.value.release);
const knownIssue=computed(()=>release.value?knownIssueForRelease(release.value,issues.value?.records):null);
const command=computed(()=>{if(!release.value)return '';const id=provider.value.id; const reference=`${id}@${release.value.revision}`;return `double-entry-generator config init ${reference} -o ${id}-rules.yaml\ndouble-entry-generator import ${reference} --rules ${id}-rules.yaml ./your-statement.${release.value.meta.fileFormat.toLowerCase()}`;});
const rulesDoc=computed(()=>{try{return parse(resources.value?.rules||'')||{};}catch{return {};}});
const templateRules=computed(()=>Array.isArray(rulesDoc.value.templateRules)?rulesDoc.value.templateRules:[]);
const templateRulesRaw=computed(()=>templateRules.value.length?stringify({templateRules:templateRules.value}):'');
const downloads=computed(()=>{if(!release.value)return [];const a=release.value.artifacts;return [{...a.template,label:'template'},{...a.rules,label:'rules'},...a.bills.map(b=>({...b,label:'bill'})),...(a.expected?[{...a.expected,label:'expected'}]:[])];});
let controller;let generation=0;
async function loadResources(){
 controller?.abort();const token=++generation;controller=new AbortController();resources.value=null;shareFiles.value=[];shareText.value='';resourceError.value='';notice.value='';
 if(!release.value)return;
 const r=release.value, signal=controller.signal;
 async function fetchBytes(a){const response=await fetch(assetUrl(a.publicPath),{signal});if(!response.ok)throw Error('loadError');const bytes=await response.arrayBuffer();if(bytes.byteLength!==a.bytes)throw Error('loadError');if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',bytes);const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');if(hex!==a.sha256)throw Error('loadError');}return bytes;}
 try{
  const a=r.artifacts;const bill=a.bills[0];
  const isText=bill&&/\.(csv|tsv)$/i.test(bill.path);
  const isSheet=bill&&/\.xlsx?$/i.test(bill.path);
  const billSource=isText?bill:(isSheet?bill.preview:null);
  const utf8=new TextDecoder('utf-8',{fatal:true});
  const [template,rules,expected,billBytes]=await Promise.all([fetchBytes(a.template),fetchBytes(a.rules),a.expected?fetchBytes(a.expected):null,billSource?fetchBytes(billSource):null]);
  const billText=billBytes?(isSheet?utf8:new TextDecoder(r.meta.encoding||'utf-8',{fatal:true})).decode(billBytes):null;
  if(token!==generation)return;
  resources.value={template:utf8.decode(template),rules:utf8.decode(rules),expected:expected?utf8.decode(expected):null,bill:billText,billType:!bill?'noSample':(isText||(isSheet&&billSource))?'text':'excel',billConverted:!!(isSheet&&billSource)};
  shareFiles.value=buildShareFiles(resources.value,{id:r.id,revision:r.revision});
  shareText.value=buildBundleText(resources.value,{id:r.id,revision:r.revision});
 }catch(e){if(token===generation && e.name!=='AbortError')resourceError.value='loadError';}
}
watch([route,index],loadResources);
async function loadCatalog(){catalogError.value='';try{const res=await fetch(assetUrl('provider-index.json'));if(!res.ok)throw Error();const data=await res.json();if(data.schemaVersion!==2||!Array.isArray(data.providers))throw Error();index.value=data;}catch{catalogError.value='loadError';}try{const res=await fetch(assetUrl('known-issues.json'));if(res.ok)issues.value=await res.json();}catch{}}
function changeRevision(event){location.hash=href(provider.value,event.target.value);}
function navigate(){route.value=parseRoute(location.hash);window.scrollTo(0,0);}
function setLocale(){try{localStorage.setItem('template-hub-locale',locale.value);}catch{notice.value='storageError';}}
const media=window.matchMedia('(prefers-color-scheme: dark)');
function setTheme(){document.body.classList.toggle('dark',theme.value==='dark'||(theme.value==='system'&&media.matches));try{localStorage.setItem('deg-theme-mode',theme.value);}catch{}}
watch(theme,setTheme,{immediate:true});
watch([locale,route,provider],()=>{document.documentElement.lang=locale.value;document.title=`${route.value.page==='detail'&&provider.value?name(provider.value):t(route.value.page==='contribute'?'contribute':'market')} · Template Commons`;},{immediate:true});
async function copy(){try{await navigator.clipboard.writeText(command.value);notice.value='copied';}catch{notice.value='copyError';}}
// 「分享到 Mirato」：把页面已校验 sha256 的 template.yaml + rules.yaml 作为两个文件交给系统分享面板。
// 文件类型必须是浏览器白名单内的（见 share.mjs 顶部说明，.yaml 不在其中）→ 一律 text/plain，靠内容辨认。
const shareFiles=ref([]);
const shareText=ref('');
// 可见性：有内容且浏览器有分享能力就显示。文件分享被设备拒绝时由 shareToMirato 自动回落文本，
// 所以这里不再只看 canShareFiles（实测有设备 canShare 为真但 share 被拒）。
const shareAvailable=computed(()=>!!shareText.value&&typeof navigator?.share==='function');
async function shareMirato(){
 const r=release.value;if(!r||!shareText.value)return;
 const status=await shareToMirato(navigator,{files:shareFiles.value,text:shareText.value},`${provider.value.id}@${r.revision}`);
 // 成功与用户取消都不出提示：分享面板本身就是反馈。只在真的失败时给一行。
 notice.value=(status==='error'||status==='blocked')?'shareError':'';
}
onMounted(()=>{loadCatalog();window.addEventListener('hashchange',navigate);media.addEventListener('change',setTheme);});
onUnmounted(()=>{controller?.abort();window.removeEventListener('hashchange',navigate);media.removeEventListener('change',setTheme);});
</script>
<template>
<header class="site-header"><a class="brand" href="#/"><span aria-hidden="true">▤</span><strong>Template Commons</strong><small>{{t('tagline')}}</small></a>
<nav :aria-label="t('navigation')"><a href="#/">{{t('market')}}</a><a href="#/contribute">{{t('contribute')}} ↗</a><a :href="repo" target="_blank" rel="noopener">GitHub ↗</a>
<select id="language" data-testid="language-select" v-model="locale" :aria-label="t('language')" @change="setLocale"><option value="en">English</option><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option></select>
<select v-model="theme" :aria-label="t('theme')"><option v-for="mode in ['system','light','dark']" :key="mode" :value="mode">{{t(mode)}}</option></select></nav></header>
<main>
<div v-if="catalogError" class="panel" role="alert"><h1>{{t(catalogError)}}</h1><button @click="loadCatalog">{{t('retry')}}</button></div>
<p v-else-if="!index" role="status">{{t('loading')}}</p>
<template v-else-if="route.page==='market'">
<section class="intro"><div><span class="eyebrow">{{t('community')}}</span><h1>{{t('hero')}}</h1><p>{{t('intro')}}</p></div><div class="stamp"><strong>{{providers.length}}</strong>{{t('templates')}}<br><small>{{formats.join(' · ')}}</small></div></section>
<div class="toolbar"><input id="search" data-testid="search" v-model="query" type="search" :aria-label="t('search')" :placeholder="t('search')"><select id="format" data-testid="format-filter" v-model="format" :aria-label="t('format')"><option value="all">{{t('allFormats')}}</option><option v-for="f in formats" :key="f">{{f}}</option></select></div>
<div class="chips"><button v-for="c in categories" :key="c" :class="{active:category===c}" :aria-pressed="category===c" @click="category=c">{{t(c)}} <small>{{c==='all'?providers.length:providers.filter(p=>p.category===c).length}}</small></button></div>
<p class="muted" role="status">{{filtered.length}} {{t('results')}}</p><section class="grid"><a v-for="p in filtered" :key="p.id" class="card" :href="href(p)"><div class="top"><span>{{t(p.category)}}</span><span>{{p.id}}</span></div><h3>{{name(p)}}</h3><p>{{p.tags.map(tag).join(' · ')}}</p><div class="bottom"><span>{{p.formats.join(' / ')}} · {{p.releases[p.latest].meta.defaultCurrency||t('unknown')}}</span><span>{{t('details')}} ↗</span></div></a><p v-if="!filtered.length" class="empty">{{t('empty')}}</p></section>
<section class="banner"><div><h2>{{t('banner')}}</h2><p>{{t('bannerText')}}</p></div><a class="button" href="#/contribute">{{t('contribute')}} →</a></section>
</template>
<template v-else-if="route.page==='contribute'">
<div class="crumb"><a href="#/">{{t('market')}}</a> / {{t('contribute')}}</div><span class="eyebrow">{{t('community')}}</span><h1>{{t('contributeHero')}}</h1><p class="muted">{{t('contributeIntro')}}</p>
<section class="steps"><article class="panel"><span class="number">01</span><h2>{{t('issueTitle')}}</h2><p>{{t('issueText')}}</p><label>{{t('issuePlatform')}}<input v-model="reqName" :placeholder="t('issuePlatformHint')"></label>
<label>{{t('issueFormat')}}<select v-model="reqFormat"><option value="CSV">CSV</option><option value="XLS">XLS</option><option value="XLSX">XLSX</option><option value="">{{t('unknown')}}</option></select></label>
<label>{{t('issueHeaders')}}<textarea v-model="reqHeaders" rows="2" :placeholder="t('issueHeadersHint')"></textarea></label>
<label>{{t('issueSample')}}<textarea v-model="reqSample" rows="3" :placeholder="t('issueSampleHint')"></textarea></label>
<a class="button primary" :href="requestUrl()" target="_blank" rel="noopener">{{t('issue')}} ↗</a></article><article class="panel"><span class="number">02</span><h2>{{t('forkTitle')}}</h2><p>{{t('forkText')}}</p><div class="actions"><a class="button" :href="repo+'/fork'" target="_blank" rel="noopener">{{t('fork')}} ↗</a><a class="button" :href="repo+'/compare'" target="_blank" rel="noopener">{{t('compare')}} ↗</a></div></article><article class="panel"><span class="number">03</span><h2>{{t('maintain')}}</h2><p>{{t('maintainText')}}</p><div class="actions"><a class="button" :href="repo+'/issues'" target="_blank" rel="noopener">{{t('issues')}} ↗</a><a class="button" :href="repo+'/pulls'" target="_blank" rel="noopener">{{t('pulls')}} ↗</a></div></article></section><div class="privacy">{{t('privacy')}}</div><section class="panel"><h2>{{t('checklist')}}</h2><p>{{t('checklistText')}}</p><a class="button" :href="repo" target="_blank" rel="noopener">{{t('repo')}} ↗</a></section>
</template>
<template v-else-if="route.page==='detail' && release">
<div class="crumb"><a href="#/">{{t('market')}}</a> / {{t(provider.category)}} / {{name(provider)}}</div><div class="detail-head"><div><span class="eyebrow">{{provider.id}} · {{provider.tags.map(tag).join(' / ')}}</span><h1>{{name(provider)}}</h1><p class="muted">{{release.meta.fileFormat.toUpperCase()}} · {{t('statement')}}</p></div><a class="button" :href="reportUrl(provider.id,release.revision)" target="_blank" rel="noopener">{{t('report')}} ↗</a></div>
<div class="status"><span :class="{failure:knownIssue}">{{t('verification')}}: {{t(knownIssue?'failed':'unverified')}}</span><span>{{t('mirato')}}: {{t('unverified')}}</span></div>
<div v-if="knownIssue" class="notice failure"><strong>{{t('failed')}}</strong><p>{{t('historical')}}</p><a :href="assetUrl('known-issues.json')" target="_blank" rel="noopener">{{t('evidence')}} ↗</a></div>
<div class="samples"><h2>{{t('samples')}}</h2><p class="muted">{{t('sampleNote')}}</p>
<div v-if="resourceError" class="panel" role="alert">{{t(resourceError)}} <button @click="loadResources">{{t('retry')}}</button></div>
<p v-else-if="!resources" role="status">{{t('loading')}}</p>
<template v-else><div class="pair"><div><h3>{{t('bill')}}</h3><BillTable :bill="resources.bill" :bill-type="resources.billType" :converted="resources.billConverted===true" :t="t" /></div><div><h3>{{t('expected')}}</h3><CodeBlock :text="resources.expected||''" /><small v-if="!resources.expected">{{t('noSample')}}</small></div></div></template>
</div>
<div class="columns"><div>
<section class="panel use-panel"><h2>{{t('use')}}</h2><p>{{t('useNote')}}</p><pre>{{command}}</pre><button @click="copy">{{t('copy')}}</button><button v-if="shareAvailable" data-testid="share-mirato" @click="shareMirato">{{t('shareToMirato')}}</button></section>
<template v-if="resources">
<RulesCards :title="t('templateRulesTitle')" :rules="templateRules" :raw="templateRulesRaw" :t="t" />
<details class="panel"><summary>{{t('source')}}</summary><h3>{{t('template')}}</h3><CodeBlock :text="resources.template" lang="text" /><h3>{{t('headers')}}</h3><CodeBlock :text="(release.meta.sourceHeaders||[]).join('\n')" lang="text" /></details>
<RulesEditor :key="provider.id" :provider="provider" :starter="resources.rules" :t="t" />
</template>
</div><aside><section class="panel"><label for="revision">{{t('revision')}}</label><select id="revision" data-testid="revision-select" :value="release.revision" @change="changeRevision"><option v-for="v in provider.versions" :key="v" :value="v">{{v}}</option></select><dl><dt>{{t('currency')}}</dt><dd>{{release.meta.defaultCurrency||t('unknown')}}</dd><dt>{{t('encoding')}}</dt><dd>{{release.meta.encoding||t('unknown')}}</dd><dt>{{t('schema')}}</dt><dd>{{release.meta.schema||t('unknown')}}</dd></dl><p class="muted">{{t('releaseNote')}}</p><div class="actions"><a v-for="a in downloads" :key="a.path" class="button" :href="assetUrl(a.publicPath)" download>{{t('download')}} · {{t(a.label)}}</a><a class="button" :href="assetUrl(release.manifestPath)" download>{{t('manifest')}}</a></div><small>{{t('starterNote')}}</small></section>
<section class="panel"><h3>SHA-256</h3><p>{{t('hashNote')}}</p><dl v-for="a in downloads" :key="a.path"><dt>{{t(a.label)}} · {{a.bytes}} B</dt><dd><code>{{a.sha256}}</code></dd></dl></section><section class="panel"><h3>{{t('contribute')}}</h3><a :href="repo+'/tree/main/'+encodeURIComponent(provider.id)+'/'+encodeURIComponent(release.revision)" target="_blank" rel="noopener">{{t('repo')}} ↗</a><p><a href="#/contribute">{{t('contribute')}} →</a></p></section></aside></div>
</template>
<section v-else class="panel" role="alert"><h1>{{t(selection.error||route.error||'notFound')}}</h1><a class="button" href="#/">{{t('back')}}</a></section>
<p v-if="notice" role="status" class="notice">{{t(notice)}}</p>
</main><footer><span>{{t('footer')}}</span><span>{{t('independent')}} · <a :href="repo" target="_blank" rel="noopener">deb-sig/deg-provider-template</a> · <a :href="assetUrl('LICENSE')">Apache-2.0</a></span></footer>
</template>
