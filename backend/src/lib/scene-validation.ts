export function validateScene(value: unknown): string | null {
  if(value === null) return null;
  if(typeof value !== 'string' || value.length > 100000) return 'Design must be a JSON string of at most 100 KB';
  try {
    const scene: unknown=JSON.parse(value);
    if(!scene || typeof scene!=='object' || Array.isArray(scene)) return 'Invalid scene';
    const data=scene as Record<string,unknown>;
    if(data.version !== 1) return null; // Legacy presentation styles remain supported
    if(typeof data.background!=='string' || !/^#[0-9a-fA-F]{6}$/.test(data.background)) return 'Invalid background';
    if(!Array.isArray(data.elements) || data.elements.length>150) return 'Too many elements';
    for(const item of data.elements){
      if(!item || typeof item!=='object')return 'Invalid scene element';
      const el=item as Record<string,unknown>;
      if(typeof el.id!=='string' || el.id.length>100 || !['text','image','shape','icon','chart'].includes(String(el.kind)))return 'Invalid element';
      for(const key of ['x','y','width','height']){
        if(typeof el[key]!=='number' || !Number.isFinite(el[key]) || (el[key] as number)<0 || (el[key] as number)>100)return 'Invalid element geometry';
      }
      if((el.width as number)<1||(el.height as number)<1)return 'Invalid element size';
      if(el.src!==undefined && (typeof el.src!=='string' || el.src.length>2048 || !(el.src===''||/^https:\/\//.test(el.src)||/^\/api\/media\/[a-zA-Z0-9-]+\.(png|jpg|jpeg|gif|webp)$/.test(el.src))))return 'Invalid image URL';
      if(el.text!==undefined && (typeof el.text!=='string'||el.text.length>12000))return 'Element text too long';
    }
    return null;
  }catch{return 'Design must be valid JSON';}
}
