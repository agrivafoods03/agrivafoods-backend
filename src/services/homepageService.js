import { Homepage } from '../models/Homepage.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';

export class HomepageService {
  static async getHomepage() {
    if (checkDbConnection()) {
      let config = await Homepage.findOne();
      if (!config) {
        config = await Homepage.create(memoryStore.homepage);
      }
      return config;
    } else {
      return memoryStore.homepage;
    }
  }

  static async updateHomepage(data) {
    if (checkDbConnection()) {
      let config = await Homepage.findOne();
      if (!config) {
        config = await Homepage.create(data);
      } else {
        Object.assign(config, data);
        await config.save();
      }
      return config;
    } else {
      memoryStore.homepage = {
        ...memoryStore.homepage,
        ...data,
        updatedAt: new Date().toISOString()
      };
      return memoryStore.homepage;
    }
  }
}
