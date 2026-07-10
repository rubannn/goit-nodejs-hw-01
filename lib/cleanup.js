import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';

export class Cleanup extends EventEmitter {
  async run(directoryPath, options = {}) {
    this.emit('cleanup-start', {
      directoryPath,
      olderThanDays: options.olderThanDays,
      confirm: options.confirm ?? false,
    });

    const result = {
      command: 'cleanup',
      directory: directoryPath,
      olderThanDays: options.olderThanDays,
      confirm: options.confirm ?? false,
      status: 'pending',
      message: '',
    };

    try {
      if (!Number.isFinite(result.olderThanDays) || result.olderThanDays < 0) {
        throw new Error('Option --older-than must be a valid non-negative number.');
      }

      const resolvedDirectory = path.resolve(directoryPath);
      const directoryStats = await fs.stat(resolvedDirectory);

      if (!directoryStats.isDirectory()) {
        throw new Error(`Path is not a directory: ${directoryPath}`);
      }

      const filePaths = [];
      await this.collectFilePaths(resolvedDirectory, filePaths);

      const oldFiles = [];

      for (const filePath of filePaths) {
        const fileStats = await this.getFileStats(filePath);
        const daysOld = this.calculateDaysOld(fileStats.mtime);

        if (daysOld <= result.olderThanDays) {
          continue;
        }

        const fileData = {
          name: path.basename(filePath),
          path: filePath,
          size: fileStats.size,
          modifiedAt: fileStats.mtime,
          daysOld,
        };

        oldFiles.push(fileData);
        this.emit('file-found', fileData);
      }

      let deletedFiles = 0;
      let deletedSize = 0;
      const previewReport = this.buildReport(
        resolvedDirectory,
        oldFiles,
        filePaths.length,
        result.confirm,
        deletedFiles,
        deletedSize
      );

      this.emit('cleanup-ready', previewReport);

      if (result.confirm) {
        for (const file of oldFiles) {
          try {
            await fs.unlink(file.path);
          } catch (error) {
            throw new Error(`Failed to delete "${file.path}": ${error.message}`);
          }

          deletedFiles += 1;
          deletedSize += file.size;
          this.emit('file-deleted', {
            file,
            progress: {
              current: deletedFiles,
              total: oldFiles.length,
            },
          });
        }
      }

      const report = this.buildReport(
        resolvedDirectory,
        oldFiles,
        filePaths.length,
        result.confirm,
        deletedFiles,
        deletedSize
      );

      result.directory = resolvedDirectory;
      result.report = report;
      result.status = 'success';
      result.message = result.confirm
        ? `Deleted ${report.deletedFiles} file(s).`
        : `Found ${report.matchedFiles} file(s) eligible for cleanup.`;
      this.emit('cleanup-complete', result);
      return result;
    } catch (error) {
      result.status = 'error';
      result.message = error.message;
      this.emit('cleanup-error', error);
      throw error;
    }
  }

  async collectFilePaths(currentDirectory, filePaths) {
    let entries;

    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Failed to read directory "${currentDirectory}": ${error.message}`);
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await this.collectFilePaths(fullPath, filePaths);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      filePaths.push(fullPath);
    }
  }

  async getFileStats(filePath) {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      throw new Error(`Failed to read file stats "${filePath}": ${error.message}`);
    }
  }

  calculateDaysOld(modifiedAt) {
    const ageInMs = Date.now() - modifiedAt.getTime();
    return ageInMs / (1000 * 60 * 60 * 24);
  }

  buildReport(directory, oldFiles, scannedFiles, confirm, deletedFiles, deletedSize) {
    const totalMatchedSize = oldFiles.reduce((total, file) => total + file.size, 0);

    return {
      directory,
      scannedFiles,
      matchedFiles: oldFiles.length,
      matchedSize: totalMatchedSize,
      confirm,
      deletedFiles,
      deletedSize,
      files: oldFiles.sort((firstFile, secondFile) => secondFile.daysOld - firstFile.daysOld),
    };
  }
}
