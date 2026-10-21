import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { startLanguage } from './app/core/i18n/i18n';

// The page starts in its language, with that language's translations already loaded, so nothing is drawn in English first.
startLanguage()
  .then(() => bootstrapApplication(AppComponent, appConfig))
  .catch((err) => console.error(err));
