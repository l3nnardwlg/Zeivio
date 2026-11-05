export type ElementKind = 'text' | 'image' | 'shape' | 'icon' | 'chart';
export type ShapeKind = 'rectangle' | 'ellipse' | 'line';
export interface SceneElement {
  id: string;
  kind: ElementKind;
  x: number; y: number; width: number; height: number;
  text?: string; src?: string; shape?: ShapeKind; icon?: string;
  groupId?: string; fontFamily?: string;
  fill?: string; color?: string; fontSize?: number; fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right'; borderRadius?: number;
  opacity?: number; rotation?: number; locked?: boolean; hidden?: boolean;
  data?: number[];
}
export interface Scene {
  version: 1;
  background: string;
  foreground: string;
  elements: SceneElement[];
  notes?: string;
}
export interface SlideData {
  id: string; title: string; subtitle?: string | null; content?: string | null;
  type: 'CONTENT' | 'POLL' | 'QA'; orderIndex: number; design?: string | null;
  options?: string | null; votes?: {optionIndex:number}[];
}
export const PALETTES = [
  { name:'Minimal', background:'#FFFFFF', foreground:'#172033', accent:'#6E56FF' },
  { name:'Midnight', background:'#111827', foreground:'#F9FAFB', accent:'#8B9DFF' },
  { name:'Nordic', background:'#EDEDE6', foreground:'#25362F', accent:'#4D7167' },
  { name:'Editorial', background:'#F4EDE3', foreground:'#262424', accent:'#D47A56' },
  { name:'Neon', background:'#101012', foreground:'#F5F5F5', accent:'#C5FF5C' },
  { name:'Ocean', background:'#073B4C', foreground:'#FFFFFF', accent:'#2AD8B6' },
];
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export function makeElement(kind: ElementKind, extra: Partial<SceneElement> = {}): SceneElement {
  const base: SceneElement = { id: crypto.randomUUID(), kind, x: 15, y: 25, width: 55, height: 20, color:'#172033', fill:'#7657FF', fontSize: 5, fontWeight: 500, textAlign:'left', opacity:1 };
  if (kind === 'text') Object.assign(base, { text: 'Text hier bearbeiten', fill:'transparent' });
  if (kind === 'image') Object.assign(base, { x:28, y:15, width:44, height:58, src:'' });
  if (kind === 'shape') Object.assign(base, { x:35, y:35, width:30, height:30, shape:'rectangle' });
  if (kind === 'icon') Object.assign(base, { x:42, y:33, width:16, height:30, icon:'★', fontSize:18 });
  if (kind === 'chart') Object.assign(base, { x:20, y:20, width:60, height:55, data:[40,75,55,90] });
  return { ...base, ...extra };
}
export function makeScene(template = 'title', title = 'Neue Präsentation'): Scene {
  const scene: Scene = { version:1, background:'#FFFFFF', foreground:'#172033', elements:[] };
  const heading = makeElement('text', { text:title, x:9, y:20, width:82, height:28, fontSize:7.5, fontWeight:700 });
  const body = makeElement('text', { text:'Untertitel bearbeiten oder weitere Elemente hinzufügen', x:10, y:52, width:80, height:17, fontSize:3.1 });
  if (template === 'blank') return scene;
  if (template === 'section') { scene.background='#111827'; scene.foreground='#FFFFFF'; heading.color='#FFFFFF'; heading.y=35; heading.textAlign='center'; return { ...scene,elements:[heading] }; }
  if (template === 'split') { heading.x=8; heading.y=20; heading.width=40; body.x=8; body.y=55; body.width=40; return { ...scene,elements:[heading,body,makeElement('shape',{x:53,y:9,width:39,height:82,fill:'#C9C0FF',borderRadius:5})] }; }
  if (template === 'quote') { heading.text='„'+title+'“';heading.fontSize=6;heading.textAlign='center';heading.y=31;body.text='— Autor';body.textAlign='center';body.y=67;return {...scene,elements:[heading,body]}; }
  if (template === 'image') { heading.x=7;heading.y=8;heading.width=85;heading.height=18;heading.fontSize=5;return {...scene,elements:[heading,makeElement('image',{x:7,y:30,width:86,height:62})]}; }
  if (template === 'data') {heading.y=8;heading.fontSize=5;return {...scene,elements:[heading,makeElement('chart',{x:15,y:30,width:70,height:58})]};}
  if (template === 'agenda') {heading.text='Agenda';body.text='01 · Einführung\\n02 · Übersicht\\n03 · Ergebnisse';body.y=43;body.height=40;body.fontSize=4.5;return {...scene,elements:[heading,body]};}
  if (template === 'poll') {heading.text=title;heading.y=14;heading.fontSize=6;body.text='Teilnehmen über den Präsentationscode';body.y=68;return {...scene,elements:[heading,body]};}
  return { ...scene,elements:[heading,body] };
}
const hex = (value:unknown,fallback:string) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
export function parseScene(slide: Pick<SlideData,'design'|'title'|'subtitle'|'content'>): Scene {
  let raw: any = {};
  try { raw = JSON.parse(slide.design || '{}') ?? {}; } catch {}
  if (raw.version === 1 && Array.isArray(raw.elements)) {
    return {
      version: 1, background: hex(raw.background, '#FFFFFF'), foreground: hex(raw.foreground,'#172033'),
      notes: typeof raw.notes === 'string' ? raw.notes : '',
      elements: raw.elements.filter((e: any) => e && typeof e.id === 'string' && ['text','image','shape','icon','chart'].includes(e.kind)).map((e:any) => ({
        ...e, x:clamp(Number(e.x)||0,0,100), y:clamp(Number(e.y)||0,0,100),
        width:clamp(Number(e.width)||1,1,100), height:clamp(Number(e.height)||1,1,100)
      }))
    };
  }
  const scene = makeScene('title', slide.title || 'Folie');
  scene.elements.forEach((element,index)=>{element.id=`legacy-${index}`;});
  scene.background = hex(raw.background,'#FFFFFF'); scene.foreground = hex(raw.foreground,'#172033');
  scene.elements.forEach(element => { element.color = scene.foreground; });
  if (slide.subtitle || slide.content) scene.elements[1].text = [slide.subtitle,slide.content].filter(Boolean).join('\\n');
  if (typeof raw.imageUrl === 'string' && raw.imageUrl) scene.elements.push(makeElement('image',{id:'legacy-image',src:raw.imageUrl,x:55,y:28,width:38,height:56}));
  return scene;
}
export function mediaSource(source: string): string {
  if (!source) return '';
  if (/^https:\/\//i.test(source)) return source;
  if (/^\/api\/media\/[a-zA-Z0-9-]+\.(png|jpg|jpeg|webp|gif)$/i.test(source)) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    return base.replace(/\/api\/?$/, '') + source;
  }
  return '';
}
export function validScene(scene: Scene): boolean {
  return Array.isArray(scene.elements) && scene.elements.length <= 150 && JSON.stringify(scene).length < 100000;
}
