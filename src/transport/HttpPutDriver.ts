import {
  UploadDriver,
  UploadDriverContext,
  UploadDriverHandlers,
  UploadSession,
} from '../transport/types';
import { DynamicValue, resolveDynamicValue } from '../utils';

/**
 * Options for HTTP PUT/POST uploads.
 */
export interface HttpPutDriverOptions {
  /** URL endpoint where the file will be PUT/POSTed */
  url: string;
  /** HTTP method: 'PUT' (default) or 'POST' */
  method?: 'PUT' | 'POST';
  /**
   * Optional headers to send with each request. May be supplied statically or as
   * a (possibly async) factory so credentials are resolved per request.
   */
  headers?: DynamicValue<Record<string, string>>;
  /** Field name for multipart form data (if using POST with FormData). If set, uses multipart; otherwise uses raw body. */
  fieldName?: string;
  /** Request timeout in milliseconds. Defaults to 0 (no explicit timeout). */
  timeoutMs?: number;
}

/**
 * HTTP driver for uploads.
 * Supports simple PUT or POST to a given endpoint.
 * Note: Does NOT support resumability — each upload restarts from 0.
 */
export class HttpPutDriver implements UploadDriver<never> {
  readonly name = 'httpPut';
  readonly resumable = false;
  private options: HttpPutDriverOptions;

  constructor(options: HttpPutDriverOptions) {
    this.options = {
      method: 'PUT',
      ...options,
    };
  }

  createSession(
    ctx: UploadDriverContext<never>,
    handlers: UploadDriverHandlers<never>
  ): UploadSession {
    return new HttpPutSession(ctx, handlers, this.options);
  }
}

/**
 * A single HTTP PUT/POST upload session.
 */
class HttpPutSession implements UploadSession {
  private ctx: UploadDriverContext<never>;
  private handlers: UploadDriverHandlers<never>;
  private options: HttpPutDriverOptions;
  private xhr?: XMLHttpRequest;
  private aborted = false;

  constructor(
    ctx: UploadDriverContext<never>,
    handlers: UploadDriverHandlers<never>,
    options: HttpPutDriverOptions
  ) {
    this.ctx = ctx;
    this.handlers = handlers;
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.ctx.signal.aborted) {
      throw new Error('Upload was aborted');
    }

    // Resolve headers at request time so a retried request can pick up fresh
    // credentials rather than replaying a token captured at construction.
    const resolvedHeaders = await resolveDynamicValue(this.options.headers);

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this.xhr = xhr;

      // Progress tracking. For multipart bodies, `event.loaded` includes the
      // form-data envelope (boundaries + part headers), so scale it back onto the
      // file size to keep the reported fraction honest instead of overshooting.
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (!event.lengthComputable) return;
        const bytes =
          this.options.fieldName && event.total > 0
            ? Math.round((event.loaded / event.total) * this.ctx.size)
            : event.loaded;
        this.handlers.onProgress(Math.min(bytes, this.ctx.size));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Success: extract URL from response header or body
          const location = xhr.getResponseHeader('Location') || this.options.url;
          this.handlers.onSuccess({
            url: location,
            response: xhr.response,
          });
          resolve();
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText || 'Upload failed'}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));

      xhr.onabort = () => {
        if (!this.aborted) {
          reject(new Error('Upload aborted'));
        }
      };

      xhr.ontimeout = () => reject(new Error('Upload timeout'));

      // Handle abort signal
      this.ctx.signal.addEventListener(
        'abort',
        () => {
          this.aborted = true;
          xhr.abort();
        },
        { once: true }
      );

      // Set up the request
      const method = this.options.method || 'PUT';
      xhr.open(method, this.options.url);

      if (this.options.timeoutMs) {
        xhr.timeout = this.options.timeoutMs;
      }

      // Set headers
      if (resolvedHeaders) {
        for (const [key, value] of Object.entries(resolvedHeaders)) {
          xhr.setRequestHeader(key, value);
        }
      }

      // Prepare body
      let body: XMLHttpRequestBodyInit;

      if (this.options.fieldName) {
        // Multipart form data for POST
        const formData = new FormData();
        formData.append(this.options.fieldName, this.ctx.file);
        body = formData;
      } else {
        // Raw file body (for PUT or POST without form data)
        body = this.ctx.file;
      }

      try {
        xhr.send(body);
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  async pause(): Promise<void> {
    if (this.xhr) {
      this.xhr.abort();
    }
  }
}

/**
 * Factory function to create an HttpPutDriver.
 */
export function httpPut(options: HttpPutDriverOptions): UploadDriver<never> {
  return new HttpPutDriver(options);
}
