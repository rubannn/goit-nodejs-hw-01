# file-organizer

CLI-застосунок на Node.js для аналізу директорій, пошуку дублікатів, сортування файлів по категоріях та очищення старих файлів.

## Можливості

- `scan` — рекурсивно сканує директорію та показує статистику по файлах
- `duplicates` — шукає дублікати за SHA-256 хешем
- `organize` — копіює файли в цільову директорію та сортує їх по категоріях
- `cleanup` — знаходить файли старші за вказану кількість днів і працює в режимах dry run / delete
- архітектура побудована на `EventEmitter`
- для великих файлів у `organize` використовується `pipeline()` і streams

## Встановлення

### 1. Клонувати або завантажити проєкт

```bash
git clone <repo-url>
cd goit-nodejs-hw-01
```

### 2. Встановити залежності

```bash
npm install
```

У проєкті використовується:

- `commander` — для CLI-інтерфейсу

### 3. Перевірити, що CLI запускається

```bash
node file-organizer.js --help
```

## Базові приклади запуску

Сканування поточної папки:

```bash
node file-organizer.js scan .
```

Пошук дублікатів:

```bash
node file-organizer.js duplicates /path/to/directory
```

Сортування файлів у нову директорію:

```bash
node file-organizer.js organize /source/directory --output /target/directory
```

Попередній перегляд cleanup без видалення:

```bash
node file-organizer.js cleanup /path/to/directory --older-than 90
```

Видалення старих файлів:

```bash
node file-organizer.js cleanup /path/to/directory --older-than 90 --confirm
```

## Детальні приклади команд

### `scan`

Синтаксис:

```bash
node file-organizer.js scan <directory>
```

Аргументи:

- `<directory>` — директорія для рекурсивного сканування

Приклади:

```bash
node file-organizer.js scan .
node file-organizer.js scan ./Downloads
node file-organizer.js scan "C:\Users\student\Downloads"
```

Що робить команда:

- рахує загальну кількість файлів
- рахує сумарний розмір
- групує файли за розширенням
- показує розподіл за віком
- виводить топ-3 найбільших файли
- знаходить найстаріший файл

### `duplicates`

Синтаксис:

```bash
node file-organizer.js duplicates <directory>
```

Аргументи:

- `<directory>` — директорія, у якій потрібно шукати дублікати

Приклади:

```bash
node file-organizer.js duplicates .
node file-organizer.js duplicates ./Downloads
node file-organizer.js duplicates "C:\Users\student\Downloads"
```

Що робить команда:

- рекурсивно обходить директорію
- для кожного файлу рахує SHA-256 через `fs.createReadStream()`
- групує файли з однаковим хешем
- показує групи дублікатів
- рахує "wasted space"

### `organize`

Синтаксис:

```bash
node file-organizer.js organize <source> --output <target>
```

Також підтримується альтернативний виклик:

```bash
node file-organizer.js organize <source> <target>
```

Аргументи:

- `<source>` — директорія, з якої беруться файли
- `--output <target>` — цільова директорія для відсортованих файлів
- `<target>` — альтернативний позиційний варіант цільової директорії

Приклади:

```bash
node file-organizer.js organize ./Downloads --output ./Organized
node file-organizer.js organize "C:\Users\student\Downloads" --output "D:\Sorted"
node file-organizer.js organize ./Downloads ./Organized
```

Що робить команда:

- створює категорії:
  - `Documents`
  - `Images`
  - `Archives`
  - `Code`
  - `Videos`
  - `Other`
- копіює, а не переміщує файли
- не перезаписує однакові імена, а створює `file(1).ext`, `file(2).ext`
- для файлів від `10 MB` використовує streams

Відповідність категорій:

```js
const categories = {
  Documents: ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.pptx'],
  Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
  Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
  Code: ['.js', '.py', '.java', '.cpp', '.html', '.css', '.json'],
  Videos: ['.mp4', '.avi', '.mkv', '.mov', '.webm'],
  Other: []
};
```

### `cleanup`

Синтаксис:

```bash
node file-organizer.js cleanup <directory> --older-than <days>
node file-organizer.js cleanup <directory> --older-than <days> --confirm
```

Аргументи:

- `<directory>` — директорія для перевірки
- `--older-than <days>` — поріг віку файлів у днях
- `--confirm` — якщо вказано, знайдені файли будуть реально видалені

Приклади:

```bash
node file-organizer.js cleanup ./Downloads --older-than 90
node file-organizer.js cleanup ./Downloads --older-than 365
node file-organizer.js cleanup ./Downloads --older-than 90 --confirm
```

Що робить команда:

- знаходить файли старші за вказану кількість днів
- без `--confirm` тільки показує список файлів
- з `--confirm` видаляє знайдені файли
- показує summary з кількістю та розміром знайдених або видалених файлів

## NPM scripts

У `package.json` є короткі скрипти:

```bash
npm run scan -- /path/to/directory
npm run duplicates -- /path/to/directory
npm run organize -- /source/directory --output /target/directory
npm run cleanup -- /path/to/directory --older-than 90
```

## Make-команди

У проєкті є `Makefile` для короткого запуску команд:

```bash
make help
make scan
make duplicates
make organize
make cleanup
make cleanup-confirm
```

Повні назви команд:

| Команда                | Псевдонім | Опис                                                               |
| ---------------------- | --------- | ------------------------------------------------------------------ |
| `make help`            | —         | показує коротку довідку по всіх Make-командах                      |
| `make scan`            | `make s`  | запускає аналіз директорії та показує статистику по файлах         |
| `make duplicates`      | `make d`  | шукає дублікати файлів у вказаній директорії                       |
| `make organize`        | `make o`  | копіює файли з джерела у цільову папку та сортує їх по категоріях  |
| `make cleanup`         | `make c`  | показує, які старі файли будуть видалені, без фактичного видалення |
| `make cleanup-confirm` | `make cc` | реально видаляє файли старші за вказану кількість днів             |

Параметри передаються окремо через змінні:

```bash
make scan DIR=/path/to/directory
make duplicates DIR=/path/to/directory
make organize SOURCE=/source/directory TARGET=/target/directory
make cleanup DIR=/path/to/directory DAYS=90
make cleanup-confirm DIR=/path/to/directory DAYS=90
```

Значення за замовчуванням:

```bash
DIR=/path/to/directory
SOURCE=/source/directory
TARGET=/target/directory
DAYS=90
```

## Структура проєкту

```text
goit-nodejs-hw-01/
├── file-organizer.js
├── package.json
├── package-lock.json
├── README.md
├── Makefile
├── help.txt
└── lib/
    ├── scanner.js
    ├── duplicates.js
    ├── organizer.js
    └── cleanup.js
```

Опис файлів:

- `file-organizer.js` — точка входу CLI та форматування консольного виводу
- `package.json` — конфігурація проєкту та npm scripts
- `Makefile` — короткі команди для запуску
- `help.txt` — довідка для `make help`
- `lib/scanner.js` — логіка `scan`
- `lib/duplicates.js` — логіка `duplicates`
- `lib/organizer.js` — логіка `organize`
- `lib/cleanup.js` — логіка `cleanup`

## Технічні деталі реалізації

- використовується `commander` для CLI
- команди реалізовані як окремі класи на базі `EventEmitter`
- `duplicates` використовує `SHA-256`
- `organize` використовує:
  - `fs.copyFile()` для малих файлів
  - `pipeline()` для великих файлів
- `cleanup` підтримує безпечний dry run режим

## Довідка

Загальна довідка:

```bash
node file-organizer.js --help
```

Довідка по окремій команді:

```bash
node file-organizer.js scan --help
node file-organizer.js duplicates --help
node file-organizer.js organize --help
node file-organizer.js cleanup --help
```
