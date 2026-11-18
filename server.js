const express = require('express');
const yt = require('youtube-dl-exec');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

app.get('/api/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });

    try {
        // Usamos la API de Google para búsquedas rápidas (necesitas configurar la variable de entorno)
        const key = process.env.YOUTUBE_API_KEY;
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=5&key=${key}`;
        const response = await fetch(url);
        const data = await response.json();

        const tracks = (data.items || []).map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            cover: item.snippet.thumbnails.high?.url || '',
            type: 'video'
        }));
        res.json({ ok: true, tracks });
    } catch (e) {
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/download', async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    try {
        // Extraer audio con yt-dlp. Asegúrate de tener yt-dlp en el path.
        const url = await yt.exec(`https://youtube.com/watch?v=${id}`, ['-f', 'bestaudio', '-g']);

        // Obtenemos info básica para el cliente
        const info = await yt.exec(`https://youtube.com/watch?v=${id}`, ['--print', 'title', '--print', 'uploader', '--print', 'thumbnail']);
        const [title, artist, cover] = info.stdout.trim().split('\n');

        res.json({
            ok: true,
            title,
            artist,
            cover,
            directUrl: url.stdout.trim(),
            format: 'mp3'
        });
    } catch (e) {
        res.status(500).json({ error: 'Download extraction failed' });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
