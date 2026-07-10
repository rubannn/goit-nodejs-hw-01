import { Command } from 'commander';
import { Scanner } from './lib/scanner.js';
import { DuplicateFinder } from './lib/duplicates.js';
import { Organizer } from './lib/organizer.js';
import { Cleanup } from './lib/cleanup.js';

const program = new Command();

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

    scanner.on('scan-start', ({ directoryPath }) => {
      console.log(`Starting scan: ${directoryPath}`);
    });

    scanner.on('scan-complete', (result) => {
      console.log(`Scan finished for: ${result.directory}`);
      console.log(`Status: ${result.status}`);
      console.log(result.message);
    });

    await scanner.run(directory);
  });

program
  .command('duplicates')
  .argument('<directory>', 'Directory to inspect')
  .description('Find duplicate files by content hash')
  .action(async (directory) => {
    const duplicateFinder = new DuplicateFinder();

    duplicateFinder.on('search-start', ({ directoryPath }) => {
      console.log(`Searching duplicates in: ${directoryPath}`);
    });

    duplicateFinder.on('duplicates-found', (result) => {
      console.log(`Duplicate search finished for: ${result.directory}`);
      console.log(`Status: ${result.status}`);
      console.log(result.message);
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
