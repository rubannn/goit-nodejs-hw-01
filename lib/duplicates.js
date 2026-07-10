import { EventEmitter } from 'events';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

export class DuplicateFinder extends EventEmitter {
  async run(directoryPath) {
    this.emit('search-start', { directoryPath });

    const result = {
      command: 'duplicates',
      directory: directoryPath,
      status: 'pending',
      message: '',
    };

    try {
      const resolvedDirectory = path.resolve(directoryPath);
      const directoryStats = await fsPromises.stat(resolvedDirectory);

      if (!directoryStats.isDirectory()) {
        throw new Error(`Path is not a directory: ${directoryPath}`);
      }

      const filePaths = [];
      await this.collectFilePaths(resolvedDirectory, filePaths);

      const hashes = new Map();
      const totalFiles = filePaths.length;
      let processedFiles = 0;

      for (const filePath of filePaths) {
        const fileStats = await this.getFileStats(filePath);
        const hash = await this.calculateHash(filePath);
        const currentGroup = hashes.get(hash) ?? [];

        currentGroup.push({
          path: filePath,
          name: path.basename(filePath),
          size: fileStats.size,
        });
        hashes.set(hash, currentGroup);

        processedFiles += 1;
        this.emit('file-processed', {
          path: filePath,
          hash,
          size: fileStats.size,
          progress: {
            current: processedFiles,
            total: totalFiles,
          },
        });
      }

      const report = this.buildReport(resolvedDirectory, filePaths.length, hashes);

      result.directory = resolvedDirectory;
      result.report = report;
      result.status = 'success';
      result.message = `Processed ${report.totalFiles} files. Found ${report.duplicateGroups.length} duplicate group(s).`;
      this.emit('duplicates-found', result);
      return result;
    } catch (error) {
      result.status = 'error';
      result.message = error.message;
      this.emit('search-error', error);
      throw error;
    }
  }

  async collectFilePaths(directoryPath, filePaths) {
    let entries;

    try {
      entries = await fsPromises.readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Failed to read directory "${directoryPath}": ${error.message}`);
    }

    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);

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
      return await fsPromises.stat(filePath);
    } catch (error) {
      throw new Error(`Failed to read file stats "${filePath}": ${error.message}`);
    }
  }

  calculateHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (error) => {
        reject(new Error(`Failed to hash "${filePath}": ${error.message}`));
      });
    });
  }

  buildReport(directoryPath, totalFiles, hashes) {
    const duplicateGroups = [];
    let totalWastedSpace = 0;
    let duplicateFiles = 0;

    for (const [hash, files] of hashes.entries()) {
      if (files.length < 2) {
        continue;
      }

      const fileSize = files[0]?.size ?? 0;
      const wastedSpace = fileSize * (files.length - 1);

      duplicateFiles += files.length;
      totalWastedSpace += wastedSpace;
      duplicateGroups.push({
        hash,
        files,
        fileSize,
        wastedSpace,
      });
    }

    duplicateGroups.sort((firstGroup, secondGroup) => secondGroup.wastedSpace - firstGroup.wastedSpace);

    return {
      directory: directoryPath,
      totalFiles,
      duplicateFiles,
      duplicateGroups,
      totalWastedSpace,
    };
  }
}
