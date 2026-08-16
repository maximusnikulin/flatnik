import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { Inject } from '@nestjs/common'
import { readFile, stat } from 'node:fs/promises'
import { seoConfig } from '../config/seo.config'

/** Сколько ждём vite в разработке, прежде чем считать шаблон недоступным */
const DEV_FETCH_TIMEOUT_MS = 3000

/**
 * Шаблон index.html, в который подставляется серверная разметка.
 *
 * Читать его нужно у сборки фронта, а не хранить у себя: имена файлов бандла
 * содержат хеши и меняются с каждой сборкой.
 */
@Injectable()
export class IndexTemplateService {
  private readonly logger = new Logger(IndexTemplateService.name)
  private cached: { html: string; mtimeMs: number } | null = null

  constructor(
    @Inject(seoConfig.KEY)
    private readonly config: ConfigType<typeof seoConfig>,
  ) {}

  /** Текущий шаблон; бросает ServiceUnavailable, если фронт ещё не выложен */
  async load(): Promise<string> {
    const source = this.config.indexHtml
    return source.startsWith('http://') || source.startsWith('https://')
      ? this.loadOverHttp(source)
      : this.loadFromFile(source)
  }

  private async loadFromFile(path: string): Promise<string> {
    try {
      // stat на каждый запрос — намеренно. Том со статикой перезаписывает
      // сборка фронта, а контейнер бэкенда при этом не пересоздаётся: вечный
      // кеш продолжил бы ссылаться на файлы бандла, которых уже нет.
      const stats = await stat(path)
      if (this.cached?.mtimeMs === stats.mtimeMs) {
        return this.cached.html
      }
      const html = await readFile(path, 'utf8')
      this.cached = { html, mtimeMs: stats.mtimeMs }
      return html
    } catch (error: unknown) {
      // Штатная ситуация при первом старте: бэкенд поднялся раньше, чем сборка
      // фронта скопировала файлы. Гейтвей подменит ответ обычной страницей.
      this.logger.warn(`Шаблон ${path} недоступен: ${describe(error)}`)
      throw new ServiceUnavailableException('Шаблон страницы недоступен')
    }
  }

  private async loadOverHttp(url: string): Promise<string> {
    // Без кеша: в разработке vite отдаёт шаблон уже со своим клиентом и
    // обновлениями, а нагрузка тут — один разработчик
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(DEV_FETCH_TIMEOUT_MS) })
      if (!response.ok) {
        throw new Error(`ответ ${response.status}`)
      }
      return await response.text()
    } catch (error: unknown) {
      this.logger.warn(`Шаблон с ${url} недоступен: ${describe(error)}`)
      throw new ServiceUnavailableException('Шаблон страницы недоступен')
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
