const https = require('https');

https.get('https://saavn.dev/api/search/songs?query=love', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Saavn response success:', !!json.data);
      if (json.data && json.data.results) {
        console.log('Results count:', json.data.results.length);
        console.log('First result:', json.data.results[0].name, json.data.results[0].downloadUrl);
      }
    } catch(e) {
      console.log('Failed to parse:', e);
    }
  });
}).on('error', (e) => {
  console.log('Error:', e.message);
});
