const mongoose = require('mongoose');
const EventEmitter = require('events');

class TenantConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.connections = new Map();
    this.maxConnections = options.maxConnections || 100;
    this.connectionTimeout = options.connectionTimeout || 10000;
    this.idleTimeout = options.idleTimeout || 300000; // 5 minutes
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Cleanup idle connections every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 120000);
    
    // Graceful shutdown handler
    process.on('SIGTERM', () => this.closeAllConnections());
    process.on('SIGINT', () => this.closeAllConnections());
  }

  async getConnection(databaseName, retryCount = 0) {
    try {
      let connectionInfo = this.connections.get(databaseName);
      
      // Check if connection exists and is healthy
      if (connectionInfo && this.isConnectionHealthy(connectionInfo.connection)) {
        connectionInfo.lastUsed = Date.now();
        return connectionInfo.connection;
      }

      // Remove stale connection
      if (connectionInfo) {
        this.removeConnection(databaseName);
      }

      // Check connection limit
      if (this.connections.size >= this.maxConnections) {
        this.evictOldestConnection();
      }

      // Create new connection
      const connection = await this.createConnection(databaseName);
      
      this.connections.set(databaseName, {
        connection,
        created: Date.now(),
        lastUsed: Date.now()
      });

      this.emit('connectionCreated', databaseName);
      return connection;

    } catch (error) {
      this.emit('connectionError', databaseName, error);
      
      if (retryCount < this.retryAttempts) {
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.getConnection(databaseName, retryCount + 1);
      }
      
      throw new Error(`Failed to connect to tenant database ${databaseName}: ${error.message}`);
    }
  }

  async createConnection(databaseName) {
    const mongoUri = process.env.MONGODB_URI.replace(
      /\/[^\/]*\?/, 
      `/${databaseName}?`
    );

    const connection = mongoose.createConnection(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxIdleTimeMS: 30000
    });

    // Setup connection event handlers
    connection.on('error', (err) => {
      console.error(`Tenant DB error for ${databaseName}:`, err);
      this.removeConnection(databaseName);
    });

    connection.on('disconnected', () => {
      console.log(`Tenant DB disconnected: ${databaseName}`);
      this.removeConnection(databaseName);
    });

    // Wait for connection to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.connectionTimeout);

      connection.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      connection.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return connection;
  }

  isConnectionHealthy(connection) {
    return connection && 
           connection.readyState === 1 && 
           !connection._closeCalled;
  }

  removeConnection(databaseName) {
    const connectionInfo = this.connections.get(databaseName);
    if (connectionInfo) {
      try {
        connectionInfo.connection.close();
      } catch (error) {
        console.error(`Error closing connection for ${databaseName}:`, error);
      }
      this.connections.delete(databaseName);
      this.emit('connectionRemoved', databaseName);
    }
  }

  evictOldestConnection() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, info] of this.connections.entries()) {
      if (info.lastUsed < oldestTime) {
        oldestTime = info.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.removeConnection(oldestKey);
    }
  }

  cleanupIdleConnections() {
    const now = Date.now();
    const toRemove = [];

    for (const [key, info] of this.connections.entries()) {
      if (now - info.lastUsed > this.idleTimeout) {
        toRemove.push(key);
      }
    }

    toRemove.forEach(key => this.removeConnection(key));
    
    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} idle tenant connections`);
    }
  }

  async closeAllConnections() {
    console.log('Closing all tenant database connections...');
    
    const closePromises = Array.from(this.connections.entries()).map(
      ([key, info]) => {
        return new Promise((resolve) => {
          try {
            info.connection.close(() => resolve());
          } catch (error) {
            console.error(`Error closing connection ${key}:`, error);
            resolve();
          }
        });
      }
    );

    await Promise.all(closePromises);
    this.connections.clear();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    console.log('All tenant connections closed');
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      maxConnections: this.maxConnections,
      connections: Array.from(this.connections.entries()).map(([key, info]) => ({
        database: key,
        created: new Date(info.created).toISOString(),
        lastUsed: new Date(info.lastUsed).toISOString(),
        healthy: this.isConnectionHealthy(info.connection)
      }))
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
const tenantPool = new TenantConnectionPool({
  maxConnections: process.env.DISABLE_CRON === 'true' ? 10 : 100, // lower limit for CF Workers
  connectionTimeout: 10000,
  idleTimeout: 300000,
  retryAttempts: 3,
  retryDelay: 1000
});

module.exports = tenantPool;