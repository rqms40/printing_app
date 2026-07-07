const API_BASE = import.meta.env.VITE_API_URL ?? 'http://192.168.40.201:3000/api';

function getToken(): string | null {
  return localStorage.getItem('adminToken');
}

export async function getPresignedUrl(fileId: number): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE}/files/${fileId}/presigned-url`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch presigned URL: ${res.status}`);
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
