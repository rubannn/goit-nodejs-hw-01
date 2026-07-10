import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';

export class Scanner extends EventEmitter {
  async run(directoryPath) {
    this.emit('scan-start', { directoryPath });

    const result = {
      command: 'scan',
      directory: directoryPath,
      status: 'pending',
      message: '',
    };

    try {
      const resolvedDirectory = path.resolve(directoryPath);
      const directoryStats = await fs.stat(resolvedDirectory);

      if (!directoryStats.isDirectory()) {
        throw new Error(`Path is not a directory: ${directoryPath}`);
      }

      const filePaths = [];
      await this.collectFilePaths(resolvedDirectory, filePaths);

      const files = [];
      const totalFiles = filePaths.length;
      let processedFiles = 0;

      for (const filePath of filePaths) {
        let stats;

        try {
          stats = await fs.stat(filePath);
        } catch (error) {
          throw new Error(`Failed to read file stats "${filePath}": ${error.message}`);
        }

        const extension = path.extname(filePath).toLowerCase() || '[no extension]';
        const fileData = {
          name: path.basename(filePath),
          path: filePath,
          extension,
          size: stats.size,
          modifiedAt: stats.mtime,
        };

        files.push(fileData);
        processedFiles += 1;
        this.emit('file-found', {
          ...fileData,
          progress: {
            current: processedFiles,
            total: totalFiles,
          },
        });
      }

      const report = this.buildReport(resolvedDirectory, files);

      result.directory = resolvedDirectory;
      result.report = report;
      result.status = 'success';
      result.message = `Processed ${report.totalFiles} files.`;
      this.emit('scan-complete', result);
      return result;
    } catch (error) {
      result.status = 'error';
      result.message = error.message;
      this.emit('scan-error', error);
      throw error;
    }
  }

  async collectFilePaths(directoryPath, filePaths) {
    let entries;

    try {
      entries = await fs.readdir(directoryPath, { withFileTypes: true });
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

  buildReport(directoryPath, files) {
    const now = Date.now();
    const byExtension = new Map();
    const ageGroups = {
      last7Days: 0,
      last30Days: 0,
      olderThan90Days: 0,
    };

    let totalSize = 0;
    let oldestFile = null;

    for (const file of files) {
      totalSize += file.size;

      const currentExtension = byExtension.get(file.extension) ?? {
        extension: file.extension,
        count: 0,
        totalSize: 0,
      };

      currentExtension.count += 1;
      currentExtension.totalSize += file.size;
      byExtension.set(file.extension, currentExtension);

      const ageInDays = (now - file.modifiedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays <= 7) {
        ageGroups.last7Days += 1;
      }

      if (ageInDays <= 30) {
        ageGroups.last30Days += 1;
      }

      if (ageInDays > 90) {
        ageGroups.olderThan90Days += 1;
      }

      if (!oldestFile || file.modifiedAt < oldestFile.modifiedAt) {
        oldestFile = file;
      }
    }

    const largestFiles = [...files]
      .sort((firstFile, secondFile) => secondFile.size - firstFile.size)
      .slice(0, 3);

    const fileTypes = [...byExtension.values()].sort((firstType, secondType) => {
      if (secondType.totalSize !== firstType.totalSize) {
        return secondType.totalSize - firstType.totalSize;
      }

      return firstType.extension.localeCompare(secondType.extension);
    });

    return {
      directory: directoryPath,
      totalFiles: files.length,
      totalSize,
      fileTypes,
      ageGroups,
      largestFiles,
      oldestFile,
    };
  }
}
