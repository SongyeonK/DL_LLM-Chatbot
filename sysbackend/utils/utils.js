const SFTPClient = require('ssh2-sftp-client');
// const path = require('path');

// Function to upload file to DB server
async function uploadFileToDBServer(localFilePath, remoteFilePath) {
  const sftp = new SFTPClient();
  try {
    await sftp.connect({
      host: process.env.SFTP_HOST,
      port: 22,
      username: process.env.SFTP_USER,
      password: process.env.SFTP_PASSWORD,
      // Optionally, you can add privateKey and other SSH/SFTP options here
    });
    // console.log(`Connected to DB server: ${process.env.SFTP_HOST}`);

    await sftp.put(localFilePath, remoteFilePath);
    console.log(`File uploaded to DB server successfully: ${remoteFilePath}`);
  } catch (err) {
    console.error('Error uploading file to DB server:', err);
  } finally {
    await sftp.end();
  }
}

async function deleteRemoteFile(remoteFilePath) {
  const sftp = new SFTPClient();
  try {
    await sftp.connect({
      host: process.env.SFTP_HOST,
      port: 22,
      username: process.env.SFTP_USER,
      password: process.env.SFTP_PASSWORD,
      // Optionally, you can add privateKey and other SSH/SFTP options here
    });
    // console.log(`Connected to DB server: ${process.env.SFTP_HOST}`);

    await sftp.delete(remoteFilePath);
    console.log('Remote file deleted:', remoteFilePath);
  } catch (error) {
    console.error('Error deleting remote file:', error);
  } finally {
    await sftp.end();
  }
}

// CLOB을 문자열로 변환하는 함수
async function convertCLOBtoString(lob) {
  return new Promise((resolve, reject) => {
    if (lob === null) {
      resolve(null);
      return;
    }

    let clob = '';
    lob.setEncoding('utf8');

    lob.on('data', function(chunk) {
      clob += chunk;
    });

    lob.on('end', function() {
      resolve(clob);
    });

    lob.on('error', function(err) {
      reject(err);
    });
  });
}



module.exports = {  uploadFileToDBServer, deleteRemoteFile, convertCLOBtoString };