import axios from 'axios';

async function checkIP() {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    console.log('Your current public IP address is:', response.data.ip);
  } catch (error) {
    console.error('Error checking IP:', error);
  }
}

checkIP(); 