import { DataSource } from 'typeorm';
import { getDbConfig } from './config/dbConfig';

const dataSource = new DataSource(getDbConfig());

if (!dataSource.isInitialized) {
  void dataSource.initialize();
}

export default dataSource;
