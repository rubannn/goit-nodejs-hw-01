import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { pipeline } from 'stream/promises';

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;

const CATEGORIES = {
  Documents: ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.pptx'],
  Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
  Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
  Code: ['.js', '.py', '.java', '.cpp', '.html', '.css', '.json'],
  Videos: ['.mp4', '.avi', '.mkv', '.mov', '.webm'],
  Other: [],
};

export class Organizer extends EventEmitter {
  async run(sourceDirectory, targetDirectory) {
    this.emit('organize-start', { sourceDirectory, targetDirectory, categories: Object.keys(CATEGORIES) });

    const result = {
      command: 'organize',
      source: sourceDirectory,
      target: targetDirectory,
      status: 'pending',
      message: '',
    };

    try {
      const resolvedSource = path.resolve(sourceDirectory);
      const resolvedTarget = path.resolve(targetDirectory);
      const sourceStats = await fsPromises.stat(resolvedSource);

      if (!sourceStats.isDirectory()) {
        throw new Error(`Path is not a directory: ${sourceDirectory}`);
      }

      await fsPromises.mkdir(resolvedTarget, { recursive: true });
      const categoryDirectories = await this.createCategoryDirectories(resolvedTarget);

      const filePaths = [];
      await this.collectFilePaths(resolvedSource, filePaths, resolvedTarget);

      const summary = this.createEmptySummary(resolvedTarget);
      const totalFiles = filePaths.length;
      let copiedFiles = 0;

      for (const filePath of filePaths) {
        const fileStats = await this.getFileStats(filePath);
        const category = this.detectCategory(filePath);
        const categoryDirectory = categoryDirectories.get(category);
        const targetPath = await this.resolveUniqueTargetPath(categoryDirectory, path.basename(filePath));

        this.emit('copy-start', {
          sourcePath: filePath,
          targetPath,
          category,
          progress: {
            current: copiedFiles,
            total: totalFiles,
          },
        });

        try {
          await this.copyFile(filePath, targetPath, fileStats.size);
        } catch (error) {
          this.emit('copy-error', { sourcePath: filePath, targetPath, category, error });
          throw error;
        }

        copiedFiles += 1;
        summary[category].count += 1;
        summary[category].totalSize += fileStats.size;

        this.emit('copy-complete', {
          sourcePath: filePath,
          targetPath,
          category,
          size: fileStats.size,
          progress: {
            current: copiedFiles,
            total: totalFiles,
          },
        });
      }

      const report = this.buildReport(resolvedSource, resolvedTarget, summary, copiedFiles);

      result.source = resolvedSource;
      result.target = resolvedTarget;
      result.report = report;
      result.status = 'success';
      result.message = `Copied ${report.totalCopiedFiles} files.`;
      this.emit('organize-complete', result);
      return result;
    } catch (error) {
      result.status = 'error';
      result.message = error.message;
      this.emit('organize-error', error);
      throw error;
    }
  }

  async createCategoryDirectories(targetDirectory) {
    const categoryDirectories = new Map();

    for (const category of Object.keys(CATEGORIES)) {
      const categoryDirectory = path.join(targetDirectory, category);
      await fsPromises.mkdir(categoryDirectory, { recursive: true });
      categoryDirectories.set(category, categoryDirectory);
      this.emit('folder-created', { category, directory: categoryDirectory });
    }

    return categoryDirectories;
  }

  async collectFilePaths(currentDirectory, filePaths, targetDirectory) {
    let entries;

    try {
      entries = await fsPromises.readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Failed to read directory "${currentDirectory}": ${error.message}`);
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (path.resolve(fullPath) === targetDirectory) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.collectFilePaths(fullPath, filePaths, targetDirectory);
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

  detectCategory(filePath) {
    const extension = path.extname(filePath).toLowerCase();

    for (const [category, extensions] of Object.entries(CATEGORIES)) {
      if (extensions.includes(extension)) {
        return category;
      }
    }

    return 'Other';
  }

  async resolveUniqueTargetPath(categoryDirectory, filename) {
    const parsedPath = path.parse(filename);
    let candidatePath = path.join(categoryDirectory, filename);
    let suffix = 1;

    while (await this.pathExists(candidatePath)) {
      candidatePath = path.join(
        categoryDirectory,
        `${parsedPath.name}(${suffix})${parsedPath.ext}`
      );
      suffix += 1;
    }

    return candidatePath;
  }

  async pathExists(targetPath) {
    try {
      await fsPromises.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(sourcePath, targetPath, size) {
    try {
      if (size >= LARGE_FILE_THRESHOLD) {
        await pipeline(fs.createReadStream(sourcePath), fs.createWriteStream(targetPath));
        return;
      }

      await fsPromises.copyFile(sourcePath, targetPath);
    } catch (error) {
      throw new Error(`Failed to copy "${sourcePath}" to "${targetPath}": ${error.message}`);
    }
  }

  createEmptySummary(targetDirectory) {
    return Object.fromEntries(
      Object.keys(CATEGORIES).map((category) => [
        category,
        {
          count: 0,
          totalSize: 0,
          targetDirectory: path.join(targetDirectory, category),
        },
      ])
    );
  }

  buildReport(sourceDirectory, targetDirectory, summary, totalCopiedFiles) {
    const categories = Object.entries(summary).map(([category, data]) => ({
      category,
      count: data.count,
      totalSize: data.totalSize,
      targetDirectory: data.targetDirectory,
    }));

    const totalCopiedSize = categories.reduce((total, category) => total + category.totalSize, 0);

    return {
      sourceDirectory,
      targetDirectory,
      categories,
      totalCopiedFiles,
      totalCopiedSize,
    };
  }
}
