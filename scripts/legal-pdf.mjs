// Сборка юридических документов из markdown в PDF.
//
// Источник истины — файлы в legal/*.md, вывод — front/public/legal/*.pdf,
// откуда Vite копирует их в бандл как есть. Оба артефакта коммитятся:
// в production образ собирается на сервере из git, и несобранного PDF
// там взяться неоткуда.
//
// Запускается на хосте: `npm run legal:pdf`. В сборку образов не входит.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import { marked } from 'marked'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'legal')
const FONTS = path.join(SRC, 'fonts')
const OUT = path.join(ROOT, 'front', 'public', 'legal')

const DOCS = [
  { md: 'privacy-policy.md', pdf: 'privacy-policy.pdf' },
  { md: 'user-agreement.md', pdf: 'user-agreement.pdf' },
  { md: 'consent-cookies.md', pdf: 'consent-cookies.pdf' },
  { md: 'consent-user-data.md', pdf: 'consent-user-data.pdf' },
]

/** A4 в пунктах; поля — 25 мм ≈ 71 pt */
const PAGE = { width: 595.28, height: 841.89 }
const MARGINS = { top: 71, bottom: 71, left: 71, right: 71 }
const CONTENT_WIDTH = PAGE.width - MARGINS.left - MARGINS.right

const SIZE = { title: 19, section: 13.5, subsection: 11.5, body: 10.5, footer: 8.5, table: 9.5 }
const COLOR = { text: '#111111', muted: '#666666', link: '#1a4fa0', rule: '#cccccc' }
/** Межстрочный интервал сверх кегля: юридический текст читают долго */
const LINE_GAP = 3.2

/** Отступ текста пункта от маркера списка */
const LIST_INDENT = 16

/**
 * Дата создания зафиксирована намеренно. По умолчанию pdfkit пишет в
 * CreationDate/ModDate текущий момент, и тогда каждый прогон даёт другие
 * байты: PDF коммитится, и git показывал бы изменение без единой правки
 * текста. Дата редакции — человекочитаемая, она живёт первой строкой markdown.
 */
const FIXED_DATE = new Date(Date.UTC(2000, 0, 1))

function main() {
  fs.mkdirSync(OUT, { recursive: true })
  for (const doc of DOCS) {
    build(path.join(SRC, doc.md), path.join(OUT, doc.pdf))
  }
}

function build(srcPath, outPath) {
  const markdown = fs.readFileSync(srcPath, 'utf8')
  const tokens = marked.lexer(markdown)
  const title = findTitle(tokens) ?? path.basename(srcPath, '.md')

  const doc = new PDFDocument({
    size: 'A4',
    margins: MARGINS,
    // Нумерация «N из M» знает общее число страниц только когда они все
    // отрисованы, поэтому подвал проставляется вторым проходом по буферу
    bufferPages: true,
    lang: 'ru-RU',
    displayTitle: true,
    info: {
      Title: title,
      Author: 'Квартирник',
      Subject: title,
      Creator: 'scripts/legal-pdf.mjs',
      Producer: 'PDFKit',
      CreationDate: FIXED_DATE,
      ModDate: FIXED_DATE,
    },
  })

  doc.registerFont('body', path.join(FONTS, 'PTSerif-Regular.ttf'))
  doc.registerFont('bold', path.join(FONTS, 'PTSerif-Bold.ttf'))
  doc.registerFont('italic', path.join(FONTS, 'PTSerif-Italic.ttf'))

  // Закладка второго уровня цепляется к последнему разделу; на первом
  // подразделе документа раздела ещё нет, поэтому null — допустимое состояние
  let section = null
  for (const token of tokens) {
    section = renderBlock(doc, token, section)
  }

  paginate(doc)

  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)
  doc.end()
  stream.on('finish', () => {
    const size = fs.statSync(outPath).size
    console.log(`${path.relative(ROOT, outPath)} — ${(size / 1024).toFixed(0)} КБ`)
  })
}

/** Заголовок первого уровня идёт в метаданные документа и в имя закладки */
function findTitle(tokens) {
  const heading = tokens.find((token) => token.type === 'heading' && token.depth === 1)
  return heading ? plainText(heading.tokens) : null
}

function renderBlock(doc, token, section) {
  switch (token.type) {
    case 'heading':
      return renderHeading(doc, token, section)
    case 'paragraph':
      renderInline(doc, token.tokens, { align: 'justify' })
      doc.moveDown(0.45)
      return section
    case 'list':
      renderList(doc, token)
      return section
    case 'table':
      renderTable(doc, token)
      return section
    case 'hr':
      renderRule(doc)
      return section
    case 'blockquote':
      for (const child of token.tokens) renderBlock(doc, child, section)
      return section
    case 'space':
      return section
    default:
      // Неизвестный блок лучше показать сырым текстом, чем молча потерять
      if (token.text) {
        doc.font('body').fontSize(SIZE.body).fillColor(COLOR.text).text(token.text)
        doc.moveDown(0.45)
      }
      return section
  }
}

function renderHeading(doc, token, section) {
  const text = plainText(token.tokens)

  if (token.depth === 1) {
    doc.font('bold').fontSize(SIZE.title).fillColor(COLOR.text)
    doc.text(text, { align: 'center', lineGap: 2 })
    doc.moveDown(0.7)
    doc.outline.addItem(text)
    return section
  }

  const size = token.depth === 2 ? SIZE.section : SIZE.subsection
  // Заголовок последней строкой страницы выглядит как обрыв: если под ним
  // не помещается хотя бы пара строк текста, начинаем страницу заранее
  keepWithNext(doc, size + LINE_GAP + (SIZE.body + LINE_GAP) * 2)
  doc.moveDown(token.depth === 2 ? 0.75 : 0.5)
  doc.font('bold').fontSize(size).fillColor(COLOR.text)
  doc.text(text, { align: 'left', lineGap: 1.5 })
  doc.moveDown(0.3)

  if (token.depth === 2) {
    const item = doc.outline.addItem(text)
    return item
  }
  if (section) section.addItem(text)
  return section
}

function renderList(doc, token) {
  token.items.forEach((item, index) => {
    const marker = token.ordered ? `${(token.start || 1) + index}.` : '—'
    const inline = itemInlineTokens(item)

    keepWithNext(doc, (SIZE.body + LINE_GAP) * 2)
    const top = doc.y
    doc.font('body').fontSize(SIZE.body).fillColor(COLOR.text)
    doc.text(marker, MARGINS.left, top, { width: LIST_INDENT, lineBreak: false })
    // Маркер и текст пункта — одна строка: возвращаем каретку на её начало
    doc.y = top
    renderInline(doc, inline, {
      align: 'left',
      x: MARGINS.left + LIST_INDENT,
      width: CONTENT_WIDTH - LIST_INDENT,
    })
    doc.moveDown(0.2)
  })
  doc.moveDown(0.35)
}

/** Пункт списка приходит обёрнутым в блок `text`; инлайн лежит внутри него */
function itemInlineTokens(item) {
  const nested = item.tokens ?? []
  const inline = []
  for (const token of nested) {
    if (token.type === 'text' && token.tokens) inline.push(...token.tokens)
    else if (token.type === 'text') inline.push({ type: 'text', text: token.text })
    else if (token.tokens) inline.push(...token.tokens)
  }
  return inline.length > 0 ? inline : [{ type: 'text', text: item.text ?? '' }]
}

/**
 * Таблица средствами pdfkit.
 *
 * Шрифт задаётся на каждой ячейке, и это не перестраховка: `defaultStyle.font`
 * до ячеек не доходит вовсе — в стили строки и колонки pdfkit пропускает
 * только размеры (`ROW_FIELDS`/`COLUMN_FIELDS`), а `config.font` собирается
 * заново из col/row/cell. Ячейка без своего шрифта рисуется тем, что активно
 * на документе, то есть жирным от предыдущего заголовка.
 *
 * Сам шрифт — объект `{ src, size }`, а не строка: строку deepMerge растащит
 * посимвольно и `src` окажется пустым.
 */
function renderTable(doc, token) {
  const bodyFont = { src: 'body', size: SIZE.table }
  const header = token.header.map((cell) => ({
    text: plainText(cell.tokens),
    font: { src: 'bold', size: SIZE.table },
    backgroundColor: '#f4f4f4',
  }))
  const rows = token.rows.map((row) =>
    row.map((cell) => ({ text: plainText(cell.tokens), font: bodyFont })),
  )

  // Колонки одинаковой ширины рвут длинные слова посреди строки: последний
  // столбец у нас содержит связный текст и должен быть заметно шире первых.
  const columns = token.header.length
  const columnStyles =
    columns === 3
      ? [{ width: CONTENT_WIDTH * 0.28 }, { width: CONTENT_WIDTH * 0.26 }, { width: '*' }]
      : undefined

  keepWithNext(doc, 120)
  doc.moveDown(0.2)
  doc.font('body').fontSize(SIZE.table).fillColor(COLOR.text)
  doc.table({
    data: [header, ...rows],
    maxWidth: CONTENT_WIDTH,
    ...(columnStyles ? { columnStyles } : {}),
    defaultStyle: {
      textColor: COLOR.text,
      padding: 5,
      border: 0.5,
      borderColor: COLOR.rule,
      textOptions: { lineGap: 1.5 },
    },
  })
  doc.moveDown(0.6)
}

function renderRule(doc) {
  doc.moveDown(0.4)
  doc
    .moveTo(MARGINS.left, doc.y)
    .lineTo(MARGINS.left + CONTENT_WIDTH, doc.y)
    .lineWidth(0.5)
    .strokeColor(COLOR.rule)
    .stroke()
  doc.moveDown(0.6)
}

/**
 * Абзац с инлайновым оформлением. pdfkit склеивает куски флагом `continued`,
 * и опции при этом наследуются от первого вызова — кроме `link`, который
 * не сбрасывается сам и «протекает» на соседний кусок. Поэтому он передаётся
 * явно каждый раз, в том числе как null.
 */
function renderInline(doc, tokens, options = {}) {
  const runs = flattenInline(tokens)
  if (runs.length === 0) return

  const { x, width, align = 'left' } = options
  const textOptions = {
    align,
    lineGap: LINE_GAP,
    ...(width === undefined ? {} : { width }),
  }

  runs.forEach((run, index) => {
    const isLast = index === runs.length - 1
    doc
      .font(run.bold ? 'bold' : run.italic ? 'italic' : 'body')
      .fontSize(SIZE.body)
      .fillColor(run.href ? COLOR.link : COLOR.text)

    const opts = {
      ...textOptions,
      // Последний кусок обязан закрыть цепочку, иначе следующий блок
      // допишется в тот же абзац
      continued: !isLast,
      link: run.href ?? null,
      underline: Boolean(run.href),
    }

    if (index === 0 && x !== undefined) doc.text(run.text, x, doc.y, opts)
    else doc.text(run.text, opts)
  })
}

/** Дерево инлайновых токенов marked → плоский список кусков с флагами */
function flattenInline(tokens, inherited = {}) {
  const runs = []
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'strong':
        runs.push(...flattenInline(token.tokens, { ...inherited, bold: true }))
        break
      case 'em':
        runs.push(...flattenInline(token.tokens, { ...inherited, italic: true }))
        break
      case 'link':
        runs.push(...flattenInline(token.tokens, { ...inherited, href: token.href }))
        break
      case 'codespan':
        runs.push({ ...inherited, text: token.text })
        break
      case 'br':
        runs.push({ ...inherited, text: '\n' })
        break
      case 'del':
        runs.push(...flattenInline(token.tokens, inherited))
        break
      default:
        if (token.tokens) runs.push(...flattenInline(token.tokens, inherited))
        else if (token.text) runs.push({ ...inherited, text: decodeEntities(token.text) })
    }
  }
  return runs.filter((run) => run.text !== '')
}

/** Инлайновый текст без оформления: заголовки, ячейки таблиц, закладки */
function plainText(tokens) {
  return flattenInline(tokens)
    .map((run) => run.text)
    .join('')
}

/** marked отдаёт в токенах HTML-сущности; в PDF они нужны символами */
function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

/** Начать новую страницу, если до нижнего поля осталось меньше `needed` */
function keepWithNext(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom
  if (doc.y + needed > bottom) doc.addPage()
}

/** Второй проход по буферу страниц: номер внизу каждой */
function paginate(doc) {
  const range = doc.bufferedPageRange()
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index)
    // Запись в нижнее поле сама добавила бы страницу — и цикл стал бы
    // бесконечным. На время вывода подвала поле обнуляем.
    const saved = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc
      .font('body')
      .fontSize(SIZE.footer)
      .fillColor(COLOR.muted)
      .text(
        `${index + 1} из ${range.count}`,
        MARGINS.left,
        doc.page.height - MARGINS.bottom + 26,
        { width: CONTENT_WIDTH, align: 'center', lineGap: 0, link: null, underline: false },
      )
    doc.page.margins.bottom = saved
  }
}

main()
