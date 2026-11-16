
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// ==================================
// 1. SERVER CONFIGURATION
// ==================================

const PORT = process.env.PORT || 3000;

const OLLAMA_URL = process.env.OLLAMA_URL ||
  'http://127.0.0.1:11434';

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ||
  'llama3';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ==================================
// 2. NORXY SYSTEM PROMPT
// ==================================

const SYSTEM_PROMPT = `
Kamu adalah NORXY, Product Specialist Assistant.

Tugas utama:
Membantu teknisi menyelesaikan
permasalahan teknis di lapangan.

Karakter:
- Ramah dan profesional.
- Sabar menghadapi teknisi pemula.
- Menggunakan bahasa Indonesia.
- Menjelaskan istilah teknis dengan sederhana.

Metode troubleshooting:
1. Identifikasi gejala kerusakan.
2. Analisis kemungkinan penyebab.
3. Berikan pemeriksaan secara bertahap.
4. Jelaskan alat yang dibutuhkan.
5. Berikan rekomendasi perbaikan.
6. Jelaskan kapan harus menghubungi teknisi senior.

Ketentuan:
- Jangan mengarang informasi dari manual produk.
- Bedakan fakta dan dugaan diagnosis.
- Jangan menyarankan tindakan yang membahayakan.
- Utamakan keselamatan teknisi.
- Jangan langsung menyimpulkan kerusakan
  sebelum pemeriksaan dilakukan.


ATURAN GAYA KOMUNIKASI:

1. Berikan jawaban secara singkat, natural, dan langsung ke inti pembicaraan.
2. Sesuaikan panjang jawaban dengan kebutuhan dan kompleksitas pertanyaan pengguna.
3. Jika pengguna hanya menyapa seperti "halo", "hai", atau "selamat pagi", cukup balas sapaan secara ramah dalam satu kalimat.
4. Jangan memperkenalkan identitas, fungsi, dan kemampuan NORXY secara panjang lebar kecuali pengguna secara eksplisit menanyakannya.
5. Jangan memberikan informasi yang tidak diminta oleh pengguna.
6. Jika pengguna menyampaikan masalah teknis, tanyakan informasi yang diperlukan secara bertahap sebelum memberikan diagnosis.
7. Hindari mengulang informasi yang sudah disampaikan sebelumnya.
8. Gunakan bahasa Indonesia yang sederhana, profesional, dan mudah dipahami teknisi pemula.

Kamu adalah asisten teknis, bukan sekadar chatbot.
`;

// ==================================
// 3. HEALTH CHECK API
// ==================================

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    application: 'NORXY Backend',
    model: OLLAMA_MODEL,
    timestamp: new Date().toISOString()
  });
});

// ==================================
// 4. CHAT API
// ==================================

app.get('/', (req, res) => {
  res.json({
    application: 'NORXY Product Specialist Assistant',
    status: 'ONLINE',
    message: 'NORXY Backend is running successfully.',
    ai_engine: 'Ollama',
    model: OLLAMA_MODEL,
    version: '1.0.0'
  });
});

app.post(['/','/chat'], async (req, res) => {

  // Catat waktu awal request
  const requestStart = Date.now();

  const timestamp = new Date().toLocaleTimeString('id-ID');

  console.log('\n================================');
  console.log(`[${timestamp}] NORXY menerima pesan`);
  console.log('================================');

  try {

    const { message, history = [] } = req.body;

    // Validasi pesan
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'Pesan tidak boleh kosong.'
      });
    }

    console.log(`[USER] ${message}`);

    // Batasi history
    const previousMessages = Array.isArray(history)
      ? history.slice(-12)
      : [];

    // Konversi history ke format Ollama
    const formattedHistory = previousMessages
      .filter(item =>
        item &&
        typeof item.message === 'string' &&
        ['user', 'robot'].includes(item.sender)
      )
      .map(item => ({
        role: item.sender === 'robot'
          ? 'assistant'
          : 'user',
        content: item.message
      }));

    formattedHistory.push({
      role: 'user',
      content: message.trim()
    });

    // Catat waktu mulai Ollama
    const ollamaStart = Date.now();

    console.log('\n[OLLAMA] Memulai proses AI...');
    console.log(`[MODEL] ${OLLAMA_MODEL}`);

    // Request ke Ollama
    const ollamaResponse = await fetch(
      `${OLLAMA_URL}/api/chat`,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          model: OLLAMA_MODEL,

          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT
            },
            ...formattedHistory
          ],

          stream: false,

          options: {
            num_predict: 256
          }
          
        })
      }
    );

    const data = await ollamaResponse.json();

    // Hitung waktu response Ollama
    const ollamaDuration = (
      Date.now() - ollamaStart
    ) / 1000;

    console.log('\n[OLLAMA] Proses selesai');
    console.log(`[OLLAMA TIME] ${ollamaDuration.toFixed(2)} detik`);

    // Periksa respons Ollama
    if (!ollamaResponse.ok) {
      throw new Error(
        data.error || 'Ollama gagal memproses pesan.'
      );
    }

    // Hitung total waktu backend
    const totalDuration = (
      Date.now() - requestStart
    ) / 1000;

    console.log('\n[ NORXY RESPONSE ]');
    console.log(`[AI] ${data.message.content}`);
    console.log(`[TOTAL TIME] ${totalDuration.toFixed(2)} detik`);
    console.log('[STATUS] SUCCESS');
    console.log('================================\n');

    return res.json({
      response: data.message.content,
      model: OLLAMA_MODEL,
      ollama_time: ollamaDuration,
      total_time: totalDuration
    });

  } catch (error) {

    const totalDuration = (
      Date.now() - requestStart
    ) / 1000;

    console.error('\n[NORXY ERROR]');
    console.error(`[ERROR] ${error.message}`);
    console.error(`[TOTAL TIME] ${totalDuration.toFixed(2)} detik`);
    console.error('[STATUS] FAILED');
    console.log('================================\n');

    return res.status(500).json({
      error: 'NORXY mengalami gangguan.',
      detail: error.message,
      total_time: totalDuration
    });

  }

});


// ==================================
// 5. START SERVER
// ==================================

app.listen(PORT, '0.0.0.0', () => {

  console.log('================================');
  console.log('       NORXY BACKEND');
  console.log('================================');
  console.log(`Server : http://localhost:${PORT}`);
  console.log(`Model  : ${OLLAMA_MODEL}`);
  console.log('Status : Running');
  console.log('================================');

});
