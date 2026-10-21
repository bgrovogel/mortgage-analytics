import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { saveFile } from '../files/save-file';

/** "Download your data": everything the account holds, saved as a JSON file on the person's device. */
@Injectable({ providedIn: 'root' })
export class AccountExportService {
  private readonly http = inject(HttpClient);

  /** Asks the API for the account's data and saves it as a file, under the name the API suggests. */
  download(): Observable<void> {
    return this.http.get('/api/v1/account/export', { observe: 'response', responseType: 'blob' }).pipe(
      map((response) => {
        const name = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'mortgage-analytics-data.json';
        saveFile(name, response.body as Blob, 'application/json');
      }),
    );
  }
}
