const http = require('http');

async function go() {
  // 1. Register a user
  const email = `test_${Date.now()}@test.com`;
  
  console.log('Registering user: ' + email);
  let res = await fetch('http://127.0.0.1:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  });
  let data = await res.json();
  const token = data.access_token;
  console.log('Got token: ' + (token ? 'yes' : 'no') + ', response:', data);
  
  if (!token) return;

  // 2. Submit TAM survey
  console.log('Submitting TAM survey...');
  res = await fetch('http://127.0.0.1:3000/api/tam-surveys', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      survey_data: { "1": 3, "2": 4 },
      open_forum_feedback: "Great app!"
    })
  });
  data = await res.json();
  console.log('TAM survey response status:', res.status);
  console.log('TAM survey response body:', data);
}

go().catch(console.error);
