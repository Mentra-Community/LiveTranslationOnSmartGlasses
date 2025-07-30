import { Express } from 'express';
import { LiveTranslationApp } from '../index';
import { router as translationsRouter, setupTranslationsAPI } from './translations.route';
import { router as healthRouter } from './health.route';

export function setupAPI(app: Express, translationApp: LiveTranslationApp) {
  // Setup route handlers with app instance
  setupTranslationsAPI(translationApp);
  
  // Mount routes
  app.use('/', translationsRouter);
  app.use('/', healthRouter);
}