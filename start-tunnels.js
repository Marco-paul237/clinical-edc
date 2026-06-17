const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Read config details
const dotenvPath = path.resolve(__dirname, '.env');
let envConfig = {};
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      envConfig[parts[0].trim()] = parts[1].trim();
    }
  });
}

// Get authtoken from argument, env file, or environment
const authtoken = process.argv[2] || envConfig['NGROK_AUTHTOKEN'] || process.env.NGROK_AUTHTOKEN || '';

// Create ngrok.yml config file
const ngrokConfigPath = path.resolve(__dirname, 'ngrok.yml');
let configContent = `version: "3"\n`;
if (authtoken) {
  configContent += `agent:\n  authtoken: ${authtoken}\n`;
}
configContent += `tunnels:
  frontend:
    proto: http
    addr: 3000
    domain: antitrust-deed-survival.ngrok-free.dev
`;

fs.writeFileSync(ngrokConfigPath, configContent);
console.log('[NGROK] Generated configuration: ngrok.yml');

if (!authtoken) {
  console.warn('\n⚠️  WARNING: No ngrok authtoken provided.');
  console.warn('Free ngrok accounts require an authtoken to run multiple tunnels simultaneously.');
  console.warn('Please run the script as: node start-tunnels.js <YOUR_AUTHTOKEN>');
  console.warn('Or add NGROK_AUTHTOKEN=<token> to your root .env file.\n');
}

console.log('[NGROK] Spawning tunnel via npx ngrok...');
const ngrokProcess = spawn('npx', ['ngrok', 'start', '--config', 'ngrok.yml', '--all'], {
  stdio: 'ignore',
  detached: true
});

// ngrokProcess.unref();

const cleanupAndExit = (code) => {
  try {
    ngrokProcess.kill();
  } catch (e) {}
  if (fs.existsSync(ngrokConfigPath)) {
    try { fs.unlinkSync(ngrokConfigPath); } catch (e) {}
  }
  process.exit(code);
};

// Function to fetch active tunnels from ngrok local API
const fetchTunnels = () => {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// Poll the ngrok local API until tunnels are established
let attempts = 0;
const maxAttempts = 15;

console.log('[NGROK] Waiting for tunnels to establish...');

const pollInterval = setInterval(async () => {
  attempts++;
  try {
    const tunnelInfo = await fetchTunnels();
    const frontendTunnel = tunnelInfo.tunnels.find(t => t.name === 'frontend');

    if (frontendTunnel) {
      clearInterval(pollInterval);
      process.stdin.resume();
      console.log('\n======================================================');
      console.log('🎉 NGROK SECURE TUNNEL ESTABLISHED SUCCESSFULLY!');
      console.log('======================================================\n');
      console.log(`Frontend UI tunnel  : ${frontendTunnel.public_url}`);
      console.log('Note: Backend API calls are automatically proxied locally');
      console.log('via Next.js rewrites on port 3000 to port 5001.');
      console.log('No separate backend tunnel is required.\n');
      console.log('------------------------------------------------------');
      console.log('Clinicians can now access the LibreClinica portal globally at:');
      console.log(`🔗 ${frontendTunnel.public_url}\n`);
      console.log('Press Ctrl+C to close tunnel and exit.');
    } else {
      process.stdout.write('.');
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        console.error('\n[NGROK] Failed to establish tunnel. Check ngrok auth token.');
        cleanupAndExit(1);
      }
    }
  } catch (err) {
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      console.error('\n❌ Error: Failed to contact ngrok API. Ensure npx ngrok is installed and running.');
      console.error('Try running the tunnels manually:');
      console.error('  npx ngrok http 3000   (in one terminal)');
      console.error('  npx ngrok http 5001   (in another terminal)');
      cleanupAndExit(1);
    }
    process.stdout.write('.');
  }
}, 1500);

process.on('SIGINT', () => {
  console.log('\n[NGROK] Closing secure tunnel...');
  cleanupAndExit(0);
});
