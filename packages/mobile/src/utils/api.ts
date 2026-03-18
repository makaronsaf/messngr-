import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:4000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  }

  setToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  get(url: string, config?: any) { return this.client.get(url, config); }
  post(url: string, data?: any, config?: any) { return this.client.post(url, data, config); }
  patch(url: string, data?: any) { return this.client.patch(url, data); }
  delete(url: string) { return this.client.delete(url); }

  async upload(url: string, formData: FormData, onProgress?: (pct: number) => void) {
    return this.client.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
  }
}

export const api = new ApiClient();
