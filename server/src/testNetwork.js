import net from 'net';

const servers = [
  'ac-wztlrwz-shard-00-00.nzukjl1.mongodb.net',
  'ac-wztlrwz-shard-00-01.nzukjl1.mongodb.net',
  'ac-wztlrwz-shard-00-02.nzukjl1.mongodb.net'
];

async function testConnection(host) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 5000; // 5 seconds timeout
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log(`✅ Successfully connected to ${host}:27017`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log(`❌ Connection to ${host}:27017 timed out`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (error) => {
      console.log(`❌ Error connecting to ${host}:27017:`, error.message);
      resolve(false);
    });
    
    socket.connect(27017, host);
  });
}

async function testAllServers() {
  console.log('Testing network connectivity to MongoDB servers...');
  for (const server of servers) {
    await testConnection(server);
  }
}

testAllServers(); 