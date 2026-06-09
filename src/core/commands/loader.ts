import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import chokidar, { type FSWatcher } from 'chokidar';
import { transformSync } from 'esbuild';
import type { Logger } from '@/core/logger/pino.js';

type LoaderConfig = {
  folder: string;
  syntaxCheck?: boolean;
  recursive?: boolean;
  watch?: boolean;
  logger?: Logger;
};
export class FileLoader<T> {
  private folder: string;
  private logger?: Logger;
  private syntaxCheck: boolean;
  private recursive: boolean;
  private watcher: FSWatcher | null = null;
  private items = new Map<string, T>();
  private onChangeCallback?: () => void;

  constructor(config: LoaderConfig) {
    this.folder = config.folder;
    this.logger = config.logger;
    this.syntaxCheck = config.syntaxCheck ?? true;
    this.recursive = config.recursive ?? true;

    if (config.watch) {
      this.startWatcher();
    }
  }

  private getFiles(dir = this.folder, base = this.folder): { path: string; rel: string }[] {
    const entries = readdirSync(dir, { withFileTypes: true });

    return entries.flatMap((entry) => {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && this.recursive) {
        return this.getFiles(fullPath, base);
      }

      if (entry.isFile() && /\.(js|ts)$/.test(entry.name)) {
        return [
          {
            path: fullPath,
            rel: relative(base, fullPath).replace(/\\/g, '/'),
          },
        ];
      }

      return [];
    });
  }

  private validateSyntax(relPath: string, code: string): boolean {
    if (!this.syntaxCheck) return true;

    try {
      transformSync(code, {
        loader: 'ts', // change to ts
        format: 'esm',
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger?.error(`Syntax error in ${relPath}: ${msg}`);
      return false;
    }
  }

  private async loadOne(
    filePath: string,
    relPath: string = relative(this.folder, filePath).replace(/\\/g, '/'),
    shouldLog = true,
  ): Promise<T | null> {
    if (!/\.(js|ts)$/.test(filePath)) return null;

    if (this.items.has(relPath)) {
      if (shouldLog) {
        this.logger?.info(`Skipped (already loaded): ${relPath}`);
      }
      return this.items.get(relPath) ?? null;
    }

    try {
      const code = readFileSync(filePath, 'utf-8');

      if (!this.validateSyntax(relPath, code)) {
        return null;
      }

      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(`${fileUrl}?t=${Date.now()}`);

      let loadedItem: T | null = null;

      if (module.default != null) {
        loadedItem = module.default as T;
      } else {
        for (const key of Object.keys(module)) {
          const value = module[key];
          if ((value && typeof value === 'object') || typeof value === 'function') {
            loadedItem = value as T;
            break;
          }
        }
      }

      if (!loadedItem) {
        this.logger?.warn(`No valid export found in ${relPath}`);
        return null;
      }

      this.items.set(relPath, loadedItem);

      if (shouldLog) {
        this.logger?.info(`Loaded: ${relPath}`);
      }

      return loadedItem;
    } catch (err) {
      this.logger?.error({ err }, `Failed to load ${relPath}`);
      this.items.delete(relPath);
      return null;
    }
  }

  private startWatcher(): void {
    this.logger?.info(`Watching folder: ${this.folder}`);

    this.watcher = chokidar.watch(this.folder, {
      persistent: true,
      ignoreInitial: true,
      ignored: /(^|[/\\])\../,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
      depth: this.recursive ? Infinity : 0,
    });

    this.watcher
      .on('add', (file: string) => {
        if (/\.(js|ts)$/.test(file)) {
          const rel = relative(this.folder, file).replace(/\\/g, '/');
          this.logger?.info(`Adding: ${rel}`);
          this.loadOne(file, rel).then(() => this.onChangeCallback?.());
        }
      })
      .on('change', (file: string) => {
        if (/\.(js|ts)$/.test(file)) {
          const rel = relative(this.folder, file).replace(/\\/g, '/');
          this.logger?.info(`Reloading: ${rel}`);
          this.items.delete(rel);
          this.loadOne(file, rel).then(() => this.onChangeCallback?.());
        }
      })
      .on('unlink', (file: string) => {
        const rel = relative(this.folder, file).replace(/\\/g, '/');
        const _oldObject = this.items.get(rel);
        if (this.items.delete(rel)) {
          this.logger?.info(`Unloaded: ${rel}`);
          this.onChangeCallback?.();
        }
      })
      .on('error', (err: unknown) => this.logger?.error({ err }, 'Watcher error'));
  }

  public stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger?.info('Watcher stopped');
    }
  }

  public async loadAll(): Promise<Map<string, T>> {
    const files = this.getFiles();
    this.logger?.info(`Loading ${files.length} file(s)...`);

    await Promise.all(files.map(({ path, rel }) => this.loadOne(path, rel, false)));

    this.logger?.info(`Loaded ${this.items.size} file(s)`);
    return this.items;
  }

  public get(relPath: string): T | undefined {
    return this.items.get(relPath);
  }

  public getAll(): T[] {
    return Array.from(this.items.values());
  }

  public has(relPath: string): boolean {
    return this.items.has(relPath);
  }

  public get size(): number {
    return this.items.size;
  }

  public clear(): void {
    this.items.clear();
    this.logger?.info('All loaded items cleared');
  }

  /**
   * Register a callback to be invoked whenever items are added, changed, or removed.
   */
  public onChange(cb: () => void): void {
    this.onChangeCallback = cb;
  }
}
