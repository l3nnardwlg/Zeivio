const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('zeivio_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Ein unerwarteter Fehler ist aufgetreten');
  }

  return data as T;
}

export async function uploadMedia(file: File): Promise<{url:string}> {
  const allowed=['image/png','image/jpeg','image/webp','image/gif'];
  if(!allowed.includes(file.type)) throw new Error('Bitte PNG, JPEG, WebP oder GIF auswählen.');
  if(file.size>5*1024*1024) throw new Error('Bild darf maximal 5 MB groß sein.');
  const token=typeof window!=='undefined'?localStorage.getItem('zeivio_token'):null;
  if(!token) throw new Error('Bitte erneut anmelden.');
  const response=await fetch(`${API_BASE_URL}/media`,{
    method:'POST',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':file.type},
    body:file
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||'Upload fehlgeschlagen');
  return data as {url:string};
}
