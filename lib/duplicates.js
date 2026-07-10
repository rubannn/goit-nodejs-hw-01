import { EventEmitter } from 'events';

export class DuplicateFinder extends EventEmitter {
  async run(directoryPath) {
    this.emit('search-start', { directoryPath });

    const result = {
      command: 'duplicates',
      directory: directoryPath,
      status: 'pending',
      message: 'Duplicate finder module is connected. Hashing and grouping will be added next.',
    };

    try {
      result.status = 'success';
      this.emit('duplicates-found', result);
      return result;
    } catch (error) {
      result.status = 'error';
      result.message = error.message;
      this.emit('search-error', error);
      throw error;
    }
  }
}
