const { exec } = require('child_process');

const backendPort = process.argv[process.argv.indexOf('-p') + 1] || 3000;

// Start the backend server
const backendCommand = `npm start -- --port ${backendPort}`;
const backendProcess = exec(backendCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
});

// Handle process exit events
process.on('exit', () => {
  // Stop the backend process when the script exits
  backendProcess.kill();
});
