import { EventEmitter } from 'events';

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
      message: 'Cleanup module is connected. Old-file detection and deletion will be added next.',
    };

    try {
      if (!Number.isFinite(result.olderThanDays)) {
        throw new Error('Option --older-than must be a valid number.');
      }

      result.status = 'success';
      this.emit('cleanup-complete', result);
      return result;
    } catch (error) {
      result.status = 'error';
      result.message = error.message;
      this.emit('cleanup-error', error);
      throw error;
    }
  }
}
