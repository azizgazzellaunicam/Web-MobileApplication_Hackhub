class BaseRepository {
  constructor(database) {
    this.database = database;
  }

  async one(sql, params = []) {
    const [rows] = await this.database.execute(sql, params);
    return rows[0];
  }

  async all(sql, params = []) {
    const [rows] = await this.database.execute(sql, params);
    return rows;
  }

  async run(sql, params = []) {
    const [result] = await this.database.execute(sql, params);
    return {
      lastInsertRowid: result.insertId,
      changes: result.affectedRows,
    };
  }

  async transaction(action) {
    if (typeof this.database.getConnection !== 'function') {
      return action(this);
    }

    const connection = await this.database.getConnection();
    const repository = new this.constructor(connection);
    try {
      await connection.beginTransaction();
      const result = await action(repository);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = { BaseRepository };
