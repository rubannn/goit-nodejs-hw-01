import { Command } from 'commander';
import path from 'path';
import { Scanner } from './lib/scanner.js';
import { DuplicateFinder } from './lib/duplicates.js';
import { Organizer } from './lib/organizer.js';
import { Cleanup } from './lib/cleanup.js';

const program = new Command();

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function drawProgressBar(current, total, width = 20) {
  if (total === 0) {
    return `${'░'.repeat(width)} 0/0`;
  }

  const percentage = current / total;
  const filled = Math.round(percentage * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

  return `${bar} ${current}/${total}`;
}

function formatTypeLabel(extension) {
  return extension === '[no extension]' ? '(other)' : extension;
}

function formatDaysAgo(date) {
  const dayInMs = 1000 * 60 * 60 * 24;
  const days = Math.floor((Date.now() - date.getTime()) / dayInMs);

  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function renderSection(title, kind = 'section') {
  const divider = '═'.repeat(Math.max(title.length, 10));

  if (kind === 'group') {
    console.log(divider);
    console.log(title);
    return;
  }

  console.log(title);
  console.log(divider);
}

function shortenHash(hash, length = 12) {
  if (hash.length <= length) {
    return hash;
  }

  return `${hash.slice(0, length)}...`;
}

function toDisplayPath(filePath, basePath) {
  const relativePath = path.relative(basePath, filePath) || path.basename(filePath);
  return relativePath.replaceAll('\\', '/');
}

program
  .name('file-organizer')
  .description('CLI tool for scanning, organizing, finding duplicates, and cleaning files.')
  .version('1.0.0');

program
  .command('scan')
  .argument('<directory>', 'Directory to scan')
  .description('Scan a directory and collect file statistics')
  .action(async (directory) => {
    const scanner = new Scanner();
    let lastProgressLine = '';

    scanner.on('scan-start', ({ directoryPath }) => {
      console.log(`\n\n📁 Scanning: ${directoryPath}`);
    });

    scanner.on('file-found', ({ progress }) => {
      const progressLine = `Processing... ${drawProgressBar(progress.current, progress.total)} files`;

      if (progressLine !== lastProgressLine) {
        process.stdout.write(`\r${progressLine}`);
        lastProgressLine = progressLine;
      }
    });

    scanner.on('scan-complete', (result) => {
      const { report } = result;
      const fileTypeLabels = report.fileTypes.map((fileType) => formatTypeLabel(fileType.extension));
      const typeLabelWidth = Math.max(...fileTypeLabels.map((label) => label.length), '(other)'.length);
      const typeCountWidth = Math.max(
        ...report.fileTypes.map((fileType) => String(fileType.count).length),
        String(report.totalFiles).length
      );
      const largestNameWidth = Math.max(
        ...report.largestFiles.map((file) => file.name.length),
        'No files found.'.length
      );

      if (lastProgressLine) {
        process.stdout.write('\n');
      } else {
        console.log(`Processing... ${drawProgressBar(0, 0)} files`);
      }

      console.log('');
      console.log('');
      renderSection('📊 Scan Results:');
      console.log('');
      console.log(`\tTotal files: ${report.totalFiles}`);
      console.log(`\tTotal size: ${formatBytes(report.totalSize)}`);
      console.log('');
      renderSection('By File Type:');

      if (report.fileTypes.length === 0) {
        console.log('  No files found.');
      } else {
        report.fileTypes.forEach((fileType) => {
          const label = formatTypeLabel(fileType.extension);
          console.log(
            `\t${label.padEnd(typeLabelWidth)}  ${String(fileType.count).padStart(typeCountWidth)} files  ${formatBytes(fileType.totalSize)}`
          );
        });
      }

      console.log('');
      renderSection('File Age:');
      console.log(`\tLast 7 days:    ${report.ageGroups.last7Days} files`);
      console.log(`\tLast 30 days:   ${report.ageGroups.last30Days} files`);
      console.log(`\tOlder than 90:  ${report.ageGroups.olderThan90Days} files`);
      console.log('');
      renderSection('Largest files:');

      if (report.largestFiles.length === 0) {
        console.log('  No files found.');
      } else {
        report.largestFiles.forEach((file, index) => {
          console.log(
            `\t${index + 1}. ${file.name.padEnd(largestNameWidth)}  ${formatBytes(file.size)}`
          );
        });
      }

      console.log('');

      if (report.oldestFile) {
        console.log(
          `Oldest file: ${report.oldestFile.name} (modified ${formatDaysAgo(report.oldestFile.modifiedAt)})`
        );
      } else {
        console.log('Oldest file: no files found.');
      }
    });

    scanner.on('scan-error', (error) => {
      if (lastProgressLine) {
        process.stdout.write('\n');
      }

      console.error(`Scan failed: ${error.message}`);
    });

    await scanner.run(directory);
  });

program
  .command('duplicates')
  .argument('<directory>', 'Directory to inspect')
  .description('Find duplicate files by content hash')
  .action(async (directory) => {
    const duplicateFinder = new DuplicateFinder();
    let lastProgressLine = '';

    duplicateFinder.on('search-start', ({ directoryPath }) => {
      console.log(`\n\n🔍 Searching for duplicates in: ${directoryPath}`);
    });

    duplicateFinder.on('file-processed', ({ progress }) => {
      const progressLine = `Calculating hashes... ${drawProgressBar(progress.current, progress.total)} files`;

      if (progressLine !== lastProgressLine) {
        process.stdout.write(`\r${progressLine}`);
        lastProgressLine = progressLine;
      }
    });

    duplicateFinder.on('duplicates-found', (result) => {
      const { report } = result;

      if (lastProgressLine) {
        process.stdout.write('\n');
      } else {
        console.log(`Calculating hashes... ${drawProgressBar(0, 0)} files`);
      }

      console.log('');
      console.log('');
      console.log(
        `Found ${report.duplicateGroups.length} duplicate group(s) (${formatBytes(report.totalWastedSpace)} wasted):`
      );
      console.log('');

      if (report.duplicateGroups.length === 0) {
        console.log('No duplicate files found.');
        return;
      }

      report.duplicateGroups.forEach((group, index) => {
        console.log('');
        renderSection(
          `Group ${index + 1} (${group.files.length} copies, ${formatBytes(group.fileSize)} each):`,
          'group'
        );
        console.log(`\tSHA-256: ${shortenHash(group.hash)}`);
        console.log('');

        group.files.forEach((file) => {
          console.log(`\t📄 ${toDisplayPath(file.path, report.directory)}`);
        });

        console.log(`\n\tWasted space: ${formatBytes(group.wastedSpace)}`);
      });

      console.log('');
      renderSection(`💾 Total wasted space: ${formatBytes(report.totalWastedSpace)}`, 'group');
    });

    duplicateFinder.on('search-error', (error) => {
      if (lastProgressLine) {
        process.stdout.write('\n');
      }

      console.error(`Duplicate search failed: ${error.message}`);
    });

    await duplicateFinder.run(directory);
  });

program
  .command('organize')
  .argument('<source>', 'Source directory')
  .argument('<target>', 'Target directory')
  .description('Copy files into category folders')
  .action(async (source, target) => {
    const organizer = new Organizer();

    organizer.on('organize-start', ({ sourceDirectory, targetDirectory }) => {
      console.log(`Organizing files from ${sourceDirectory} to ${targetDirectory}`);
    });

    organizer.on('organize-complete', (result) => {
      console.log(`Organize finished for: ${result.source}`);
      console.log(`Status: ${result.status}`);
      console.log(result.message);
    });

    await organizer.run(source, target);
  });

program
  .command('cleanup')
  .argument('<directory>', 'Directory to clean')
  .requiredOption('--older-than <days>', 'Delete files older than a given number of days')
  .option('--confirm', 'Actually delete files instead of dry run', false)
  .description('Find old files and optionally delete them')
  .action(async (directory, options) => {
    const cleanup = new Cleanup();

    cleanup.on('cleanup-start', ({ directoryPath, olderThanDays, confirm }) => {
      console.log(
        `Cleanup started in ${directoryPath}. Threshold: ${olderThanDays} days. Confirm: ${confirm}`
      );
    });

    cleanup.on('cleanup-complete', (result) => {
      console.log(`Cleanup finished for: ${result.directory}`);
      console.log(`Status: ${result.status}`);
      console.log(result.message);
    });

    await cleanup.run(directory, {
      olderThanDays: Number(options.olderThan),
      confirm: options.confirm,
    });
  });

await program.parseAsync(process.argv);
